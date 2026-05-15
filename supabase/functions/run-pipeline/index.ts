import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEFAULTS: Record<string, { batch_size: number }> = {
  xray: { batch_size: 5 },
  ecg: { batch_size: 5 },
  dermatology: { batch_size: 5 },
  ct: { batch_size: 5 },
};

// ── Acquire lock ──
async function acquireLock(datasetType: string): Promise<boolean> {
  const { data } = await sb.from("pipeline_lock").select("is_running, started_at").eq("id", 1).single();
  if (data?.is_running) {
    // Stale lock: auto-release after 10 min
    const started = new Date(data.started_at || 0).getTime();
    if (Date.now() - started < 10 * 60 * 1000) return false;
  }
  const { error } = await sb.from("pipeline_lock").update({ is_running: true, started_at: new Date().toISOString(), dataset_type: datasetType, updated_at: new Date().toISOString() }).eq("id", 1);
  return !error;
}

async function releaseLock() {
  await sb.from("pipeline_lock").update({ is_running: false, dataset_type: null, updated_at: new Date().toISOString() }).eq("id", 1);
}

// ── Generate questions for one asset (inline — no external call needed) ──
async function generateQuestionsForAsset(asset: any): Promise<{ ok: boolean; count: number; error?: string }> {
  const prompt = `Você é professor de medicina (USP/UNIFESP/ENARE). Gere EXATAMENTE 3 questões sobre esta imagem.
DIAGNÓSTICO: ${asset.diagnosis}. TIPO: ${asset.image_type}. ESPECIALIDADE: ${asset.specialty} > ${asset.subtopic}.
REGRAS: enunciado ≥400 chars caso clínico, 5 alternativas ≥80 chars cada, explicação ≥300 chars, discussão médica, dicas de prova, armadilhas. 1 fácil, 1 média, 1 difícil. PT-BR. SEM markdown.
Retorne APENAS JSON: [{"statement":"...","options":["A)...","B)...","C)...","D)...","E)..."],"correct_index":0,"explanation":"...","discussion":"...","exam_tips":"...","pitfalls":"...","difficulty":"easy|medium|hard","exam_style":"USP"}]`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: asset.image_url } }] }],
        temperature: 0.7, max_tokens: 4000,
      }),
    });
    if (!resp.ok) return { ok: false, count: 0, error: `AI ${resp.status}` };

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { ok: false, count: 0, error: "No JSON in response" };

    const questions = JSON.parse(jsonMatch[0]);
    const clean = (t: string) => t.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").replace(/\\n/g, " ").replace(/\s{2,}/g, " ").trim();
    let inserted = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.statement || q.statement.length < 150 || !q.options || q.options.length < 5) continue;
      const code = `pipe_${asset.asset_code}_q${i}_${Date.now()}`;
      const diffs = ["easy", "medium", "hard"];
      const { error } = await sb.from("medical_image_questions").insert({
        asset_id: asset.id, question_code: code,
        statement: clean(q.statement),
        option_a: clean(q.options[0] || ""), option_b: clean(q.options[1] || ""),
        option_c: clean(q.options[2] || ""), option_d: clean(q.options[3] || ""), option_e: clean(q.options[4] || ""),
        correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
        explanation: clean(q.explanation || ""),
        discussion: q.discussion ? { text: clean(q.discussion) } : null,
        exam_tips: Array.isArray(q.exam_tips) ? q.exam_tips.map(clean) : q.exam_tips ? [clean(q.exam_tips)] : [],
        pitfalls: Array.isArray(q.pitfalls) ? q.pitfalls.map(clean) : q.pitfalls ? [clean(q.pitfalls)] : [],
        difficulty: diffs.includes(q.difficulty) ? q.difficulty : asset.difficulty || "medium",
        exam_style: q.exam_style || "USP", status: "needs_review", language_code: "pt-BR",
        senior_audit_score: 70, editorial_grade: "good",
      });
      if (!error) inserted++;
    }

    if (inserted > 0) {
      await sb.from("medical_image_assets").update({ question_generated: true }).eq("id", asset.id);
    }
    return { ok: inserted > 0, count: inserted };
  } catch (e) {
    return { ok: false, count: 0, error: (e as Error).message };
  }
}

// ── Main pipeline handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const datasetType = body.dataset_type || "xray";
    const mode = body.mode || "full_pipeline"; // assets_only, validate_only, questions_only, full_pipeline
    const batchSize = Math.min(body.batch_size || DEFAULTS[datasetType]?.batch_size || 5, 20);
    const maxErrors = body.max_errors || 3;
    const usePrioritization = body.use_prioritization !== false; // default on

    // Acquire lock
    const locked = await acquireLock(datasetType);
    if (!locked) {
      return new Response(JSON.stringify({ error: "Pipeline already running", status: "locked" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stats = { items_processed: 0, assets_created: 0, assets_validated: 0, questions_generated: 0, errors: 0, error_details: [] as string[], prioritization_used: usePrioritization };

    try {
      // Get progress
      const { data: progress } = await sb.from("pipeline_progress").select("*").eq("dataset_type", datasetType).single();

      // Fetch next batch of assets needing questions
      if (mode === "questions_only" || mode === "full_pipeline") {
        let query = sb
          .from("medical_image_assets")
          .select("id, asset_code, diagnosis, image_type, specialty, subtopic, difficulty, image_url")
          .eq("question_generated", false)
          .eq("is_active", true)
          .eq("quality_gate_passed", true)
          .eq("image_type", datasetType)
          .in("review_status", ["published", "needs_review"]);

        // If prioritization is enabled, order by exam-relevant diagnoses first
        if (usePrioritization) {
          const { data: config } = await sb
            .from("import_priority_config")
            .select("diagnosis_rankings")
            .eq("image_type", datasetType)
            .eq("is_active", true)
            .single();

          if (config?.diagnosis_rankings) {
            const rankings = config.diagnosis_rankings as { diagnosis: string; rank: number }[];
            const priorityDiagnoses = rankings.slice(0, 5).map(r => r.diagnosis);
            // Prioritize assets matching top-ranked diagnoses
            query = query.order("created_at", { ascending: true });
            // Filter to priority diagnoses first if available
            const { data: priorityAssets } = await sb
              .from("medical_image_assets")
              .select("id, asset_code, diagnosis, image_type, specialty, subtopic, difficulty, image_url")
              .eq("question_generated", false)
              .eq("is_active", true)
              .eq("quality_gate_passed", true)
              .eq("image_type", datasetType)
              .in("review_status", ["published", "needs_review"])
              .in("diagnosis", priorityDiagnoses)
              .order("created_at", { ascending: true })
              .limit(batchSize);

            if (priorityAssets && priorityAssets.length > 0) {
              console.log(`[pipeline] Using prioritized batch: ${priorityAssets.length} priority assets`);
              // Use priority assets, fall through to regular if not enough
              const remaining = batchSize - priorityAssets.length;
              let assets = [...priorityAssets];
              if (remaining > 0) {
                const usedIds = priorityAssets.map(a => a.id);
                const { data: extraAssets } = await sb
                  .from("medical_image_assets")
                  .select("id, asset_code, diagnosis, image_type, specialty, subtopic, difficulty, image_url")
                  .eq("question_generated", false)
                  .eq("is_active", true)
                  .eq("quality_gate_passed", true)
                  .eq("image_type", datasetType)
                  .in("review_status", ["published", "needs_review"])
                  .not("id", "in", `(${usedIds.join(",")})`)
                  .order("created_at", { ascending: true })
                  .limit(remaining);
                if (extraAssets) assets = [...assets, ...extraAssets];
              }
              // Process these prioritized assets
              for (const asset of assets) {
                if (stats.errors >= maxErrors) break;
                stats.items_processed++;
                console.log(`[pipeline] ${stats.items_processed}/${assets.length}: ${asset.asset_code} (priority)`);
                const result = await generateQuestionsForAsset(asset);
                if (result.ok) stats.questions_generated += result.count;
                else { stats.errors++; stats.error_details.push(`${asset.asset_code}: ${result.error}`); }
                if (stats.items_processed < assets.length) await new Promise(r => setTimeout(r, 2500));
              }
              // Skip the regular fetch below
              query = null as any;
            }
          }
        }

        // Regular (non-prioritized) fetch
        if (query) {
          const { data: assets } = await query.order("created_at", { ascending: true }).limit(batchSize);

          if (assets && assets.length > 0) {
            for (const asset of assets) {
              if (stats.errors >= maxErrors) break;
              stats.items_processed++;
              console.log(`[pipeline] ${stats.items_processed}/${assets.length}: ${asset.asset_code}`);
              const result = await generateQuestionsForAsset(asset);
              if (result.ok) stats.questions_generated += result.count;
              else { stats.errors++; stats.error_details.push(`${asset.asset_code}: ${result.error}`); }
              if (stats.items_processed < assets.length) await new Promise(r => setTimeout(r, 2500));
            }
          }
        }
      }

      // Update progress
      if (progress) {
        await sb.from("pipeline_progress").update({
          total_processed: (progress.total_processed || 0) + stats.items_processed,
          total_generated: (progress.total_generated || 0) + stats.questions_generated,
          last_run_at: new Date().toISOString(),
          status: stats.errors > 0 ? "partial" : "completed",
          last_processed_index: (progress.last_processed_index || 0) + stats.items_processed,
        }).eq("dataset_type", datasetType);
      }

      // Log execution
      await sb.from("pipeline_logs").insert({
        dataset_type: datasetType,
        mode,
        batch_size: batchSize,
        items_processed: stats.items_processed,
        assets_created: stats.assets_created,
        assets_validated: stats.assets_validated,
        questions_generated: stats.questions_generated,
        errors: stats.errors,
        error_details: stats.error_details.length > 0 ? stats.error_details : null,
        execution_time_ms: Date.now() - startTime,
      });

    } finally {
      await releaseLock();
    }

    return new Response(JSON.stringify({
      status: "completed",
      dataset_type: datasetType,
      mode,
      ...stats,
      execution_time_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await releaseLock();
    console.error("[pipeline-fatal]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
