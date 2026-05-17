import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Safety limits ──
const MAX_DIAGNOSES_PER_RUN = 3;
const MAX_QUESTIONS_PER_RUN = 15;
const MAX_ASSETS_PER_RUN = 5;
const MIN_ASSETS_PER_DIAGNOSIS = 1;
const MIN_QUESTIONS_PER_DIAGNOSIS = 3;
const COOLDOWN_MINUTES = 30;

// ── Supported image types with target diagnoses ──
const TARGET_DIAGNOSES: Record<string, string[]> = {
  xray: [
    "Pneumonia", "Derrame pleural", "Pneumotórax", "Edema pulmonar",
    "Atelectasia", "Nódulo pulmonar", "DPOC", "Tuberculose",
    "Cardiomegalia", "Fratura de costela", "Massa mediastinal",
    "Bronquiectasias", "Fibrose pulmonar", "Hemotórax",
  ],
  ecg: [
    "Fibrilação atrial", "Flutter atrial", "Infarto agudo do miocárdio",
    "Bloqueio AV", "Taquicardia ventricular", "Bradicardia sinusal",
    "Sobrecarga ventricular esquerda", "Wolff-Parkinson-White",
    "Bloqueio de ramo esquerdo", "Bloqueio de ramo direito",
    "Extrassístole ventricular", "Taquicardia supraventricular",
  ],
  dermatology: [
    "Melanoma", "Carcinoma basocelular", "Psoríase", "Dermatite atópica",
    "Urticária", "Escabiose", "Herpes zóster", "Impetigo",
    "Celulite", "Erisipela", "Lúpus eritematoso", "Líquen plano",
    "Pênfigo vulgar", "Eritema multiforme", "Sífilis secundária",
  ],
  ct: [
    "AVC isquêmico", "AVC hemorrágico", "Hemorragia subaracnoide",
    "Tumor cerebral", "Hidrocefalia", "Embolia pulmonar",
    "Apendicite", "Diverticulite", "Pancreatite aguda",
  ],
};

// ── STEP 1: Detect content gaps ──
interface Gap {
  diagnosis: string;
  image_type: string;
  current_assets: number;
  current_questions: number;
  missing_assets: number;
  missing_questions: number;
  priority: number;
}

async function detectContentGaps(imageType: string): Promise<Gap[]> {
  const targets = TARGET_DIAGNOSES[imageType] || [];
  if (targets.length === 0) return [];

  // Get current inventory
  const { data: assets } = await sb
    .from("medical_image_assets")
    .select("diagnosis, id, question_generated")
    .eq("image_type", imageType)
    .eq("is_active", true)
    .eq("quality_gate_passed", true);

  const assetMap = new Map<string, { count: number; withQuestions: number }>();
  for (const a of assets || []) {
    const key = a.diagnosis?.toLowerCase().trim();
    if (!key) continue;
    const curr = assetMap.get(key) || { count: 0, withQuestions: 0 };
    curr.count++;
    if (a.question_generated) curr.withQuestions++;
    assetMap.set(key, curr);
  }

  const gaps: Gap[] = [];
  for (const diagnosis of targets) {
    const key = diagnosis.toLowerCase().trim();
    const curr = assetMap.get(key) || { count: 0, withQuestions: 0 };

    // Count actual questions for this diagnosis
    const { count: questionCount } = await sb
      .from("medical_image_questions")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .in("asset_id", (assets || []).filter(a => a.diagnosis?.toLowerCase().trim() === key).map(a => a.id));

    const missingAssets = Math.max(0, MIN_ASSETS_PER_DIAGNOSIS - curr.count);
    const missingQuestions = Math.max(0, MIN_QUESTIONS_PER_DIAGNOSIS - (questionCount || 0));

    if (missingAssets > 0 || missingQuestions > 0) {
      // Priority: higher = more urgent
      // Prioritize diagnoses with zero content, then by exam relevance (order in target list)
      const examRelevance = 100 - (targets.indexOf(diagnosis) / targets.length) * 50;
      const contentUrgency = curr.count === 0 ? 50 : (missingQuestions > 0 ? 30 : 10);
      // Boost ECG priority (critically underrepresented with only 2 assets)
      const typeBoost = imageType === "ecg" ? 20 : 0;
      const priority = Math.round(examRelevance + contentUrgency + typeBoost);

      gaps.push({
        diagnosis,
        image_type: imageType,
        current_assets: curr.count,
        current_questions: questionCount || 0,
        missing_assets: missingAssets,
        missing_questions: missingQuestions,
        priority,
      });
    }
  }

  // Sort by priority descending
  gaps.sort((a, b) => b.priority - a.priority);
  return gaps;
}

// ── STEP 2: Generate questions for existing assets without questions ──
async function generateQuestionsForAsset(asset: any): Promise<{ ok: boolean; count: number; error?: string }> {
  const prompt = `Você é professor de medicina (USP/UNIFESP/ENARE). Gere EXATAMENTE 3 questões sobre esta imagem.
DIAGNÓSTICO: ${asset.diagnosis}. TIPO: ${asset.image_type}. ESPECIALIDADE: ${asset.specialty || asset.image_type} > ${asset.subtopic || asset.diagnosis}.
REGRAS: enunciado ≥400 chars caso clínico, 5 alternativas ≥80 chars cada, explicação ≥300 chars, discussão médica, dicas de prova, armadilhas. 1 fácil, 1 média, 1 difícil. PT-BR. SEM markdown.
Retorne APENAS JSON: [{"statement":"...","options":["A)...","B)...","C)...","D)...","E)..."],"correct_index":0,"explanation":"...","discussion":"...","exam_tips":"...","pitfalls":"...","difficulty":"easy|medium|hard","exam_style":"USP"}]`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: asset.image_url } }] }],
        temperature: 0.7, max_tokens: 4000,
      }),
    });
    if (!resp.ok) return { ok: false, count: 0, error: `AI ${resp.status}` };

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { ok: false, count: 0, error: "No JSON" };

    const questions = JSON.parse(jsonMatch[0]);
    const clean = (t: string) => t.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").replace(/\\n/g, " ").replace(/\s{2,}/g, " ").trim();
    let inserted = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.statement || q.statement.length < 150 || !q.options || q.options.length < 5) continue;
      const code = `gap_${asset.asset_code}_q${i}_${Date.now()}`;
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
        difficulty: diffs.includes(q.difficulty) ? q.difficulty : "medium",
        exam_style: q.exam_style || "USP", status: "published", language_code: "pt-BR",
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

// ── STEP 3: Main auto-gap pipeline ──
async function runAutoGapPipeline(imageTypes?: string[]): Promise<any> {
  const startTime = Date.now();
  const typesToProcess = imageTypes || Object.keys(TARGET_DIAGNOSES);

  // Check cooldown
  const { data: state } = await sb.from("gap_fill_state").select("*").eq("id", 1).single();
  if (state?.is_running) {
    const started = new Date(state.updated_at || 0).getTime();
    if (Date.now() - started < 10 * 60 * 1000) {
      return { status: "skipped", reason: "already_running" };
    }
  }
  if (state?.last_run_at) {
    const lastRun = new Date(state.last_run_at).getTime();
    if (Date.now() - lastRun < COOLDOWN_MINUTES * 60 * 1000) {
      return { status: "skipped", reason: "cooldown", next_run_in_minutes: Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - lastRun)) / 60000) };
    }
  }

  // Acquire lock
  await sb.from("gap_fill_state").update({
    is_running: true, updated_at: new Date().toISOString(),
  }).eq("id", 1);

  const results: any = { status: "completed", types_processed: [], total_gaps: 0, total_questions: 0, details: [] };

  try {
    let totalQuestionsGenerated = 0;

    for (const imageType of typesToProcess) {
      if (totalQuestionsGenerated >= MAX_QUESTIONS_PER_RUN) break;

      console.log(`[auto-gap] Detecting gaps for ${imageType}...`);
      const gaps = await detectContentGaps(imageType);

      if (gaps.length === 0) {
        console.log(`[auto-gap] No gaps for ${imageType}`);
        continue;
      }

      console.log(`[auto-gap] Found ${gaps.length} gaps for ${imageType}`);
      results.total_gaps += gaps.length;

      // Take top N gaps by priority
      const planned = gaps.slice(0, MAX_DIAGNOSES_PER_RUN);
      const typeDetail: any = { image_type: imageType, gaps_found: gaps.length, planned: planned.length, processed: [] };

      for (const gap of planned) {
        if (totalQuestionsGenerated >= MAX_QUESTIONS_PER_RUN) break;

        console.log(`[auto-gap] Processing gap: ${gap.diagnosis} (${imageType}) - missing ${gap.missing_questions} questions`);

        // Find assets that need questions for this diagnosis
        const { data: pendingAssets } = await sb
          .from("medical_image_assets")
          .select("id, asset_code, diagnosis, image_type, specialty, subtopic, difficulty, image_url")
          .eq("image_type", imageType)
          .eq("is_active", true)
          .eq("quality_gate_passed", true)
          .eq("question_generated", false)
          .ilike("diagnosis", `%${gap.diagnosis}%`)
          .not("image_url", "is", null)
          .limit(MAX_ASSETS_PER_RUN);

        if (!pendingAssets || pendingAssets.length === 0) {
          console.log(`[auto-gap] ⚠ Gap detected but NO ASSETS available for "${gap.diagnosis}" (${imageType}). Status: needs_assets. Create/import assets first.`);
          typeDetail.processed.push({ diagnosis: gap.diagnosis, status: "needs_assets", questions: 0, note: "Assets needed before questions can be generated" });
          continue;
        }

        let questionsForDiagnosis = 0;
        for (const asset of pendingAssets) {
          if (totalQuestionsGenerated >= MAX_QUESTIONS_PER_RUN) break;

          const result = await generateQuestionsForAsset(asset);
          if (result.ok) {
            questionsForDiagnosis += result.count;
            totalQuestionsGenerated += result.count;
            console.log(`[auto-gap] ✓ ${asset.asset_code}: ${result.count} questions`);
          } else {
            console.warn(`[auto-gap] ✗ ${asset.asset_code}: ${result.error}`);
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 2500));
        }

        typeDetail.processed.push({
          diagnosis: gap.diagnosis,
          status: questionsForDiagnosis > 0 ? "filled" : "failed",
          questions: questionsForDiagnosis,
          assets_processed: pendingAssets.length,
        });
      }

      results.types_processed.push(imageType);
      results.details.push(typeDetail);
    }

    results.total_questions = totalQuestionsGenerated;
    results.execution_time_ms = Date.now() - startTime;

    // Log execution
    await sb.from("gap_fill_logs").insert({
      image_type: typesToProcess.join(","),
      gaps_detected: results.total_gaps,
      gaps_planned: results.details.reduce((s: number, d: any) => s + d.planned, 0),
      diagnoses_processed: results.details.flatMap((d: any) => d.processed.map((p: any) => p.diagnosis)),
      questions_generated: totalQuestionsGenerated,
      execution_time_ms: Date.now() - startTime,
      status: totalQuestionsGenerated > 0 ? "completed" : "no_gaps",
      details: results,
    });

    // Update state
    await sb.from("gap_fill_state").update({
      is_running: false,
      last_run_at: new Date().toISOString(),
      total_runs: (state?.total_runs || 0) + 1,
      total_gaps_filled: (state?.total_gaps_filled || 0) + totalQuestionsGenerated,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

  } catch (err) {
    console.error("[auto-gap] Fatal:", err);
    results.status = "error";
    results.error = String(err);

    await sb.from("gap_fill_state").update({
      is_running: false, updated_at: new Date().toISOString(),
    }).eq("id", 1);
  }

  return results;
}

// ── HTTP handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const imageTypes = body.image_types ? (Array.isArray(body.image_types) ? body.image_types : [body.image_types]) : undefined;
    const mode = body.mode || "auto"; // auto | detect_only | force

    if (mode === "detect_only") {
      // Just return gaps without processing
      const allGaps: Gap[] = [];
      for (const t of imageTypes || Object.keys(TARGET_DIAGNOSES)) {
        const gaps = await detectContentGaps(t);
        allGaps.push(...gaps);
      }
      return new Response(JSON.stringify({ gaps: allGaps, total: allGaps.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "force") {
      // Reset cooldown
      await sb.from("gap_fill_state").update({ last_run_at: null, is_running: false }).eq("id", 1);
    }

    const result = await runAutoGapPipeline(imageTypes);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[auto-gap-handler]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
