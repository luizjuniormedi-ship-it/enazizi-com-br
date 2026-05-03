import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson, cleanQuestionText } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_QUESTIONS_PER_ASSET = 3;
const BATCH_SIZE = 3;
const MIN_STATEMENT = 400;
const MIN_EXPLANATION = 120;
const EXECUTION_TIMEOUT_MS = 120_000;
const STALE_RUN_MINUTES = 30;
const ENGLISH_PATTERN = /\b(the|is|are|was|were|this|that|which|what|patient|diagnosis|treatment|clinical|history)\b/gi;
import { isUrlSuspicious, validateImageVision } from "../_shared/vision-gate.ts";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// ── HARD DETERMINISTIC VALIDATION (inlined for edge function) ──
const BLOCK_PATTERNS = [
  "laptop","notebook","dashboard","screen","ui","interface","website",
  "landing-page","mockup","placeholder","shutterstock","unsplash","stock",
  "portrait","selfie","avatar","person","author","profile","headshot",
  "doctor","physician","nurse","team","staff","contributor",
  "office","room","illustration",
  "vector","cartoon","clipart","diagram","drawing"
];
const ENGLISH_WORDS_HARD = [
  "however","therefore","management","patient presents","follow-up",
  "rash","history of present illness","chief complaint","because",
  "imaging findings","treatment"
];

function normalizeText(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function wordCount(t: string): number { return t.split(/\s+/).filter(Boolean).length; }
function hasBlockedUrl(url?: string | null): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return BLOCK_PATTERNS.some(p => u.includes(p));
}
function isSafeAsset(asset: any): boolean {
  return (
    asset.is_active === true &&
    ["real_medical","validated_medical"].includes(asset.asset_origin || "") &&
    ["gold","silver"].includes(asset.validation_level || "") &&
    asset.review_status === "published" &&
    asset.integrity_status === "ok" &&
    Number(asset.clinical_confidence || 0) >= 0.9 &&
    !hasBlockedUrl(asset.image_url)
  );
}
function mentionsImageDependence(text: string): boolean {
  const t = text.toLowerCase();
  return ["achados do exame","exame realizado","ultrassonografia","radiografia","tomografia",
    "eletrocardiograma","dermatoscopia","fundo de olho","lâmina histológica","ao exame de imagem"
  ].some(x => t.includes(x));
}
function fakeMultimodalByContent(asset: any, q: any): boolean {
  const statement = normalizeText(q.statement).toLowerCase();
  const diagnosis = normalizeText(asset.diagnosis).toLowerCase();
  if (!mentionsImageDependence(statement)) return true;
  const textOnlySignals = [
    ["amenorreia","beta-hcg","sangramento vaginal"],
    ["prurido","escamas","couro cabeludo"],
    ["dor torácica","dispneia","sudorese"],
    ["palpitações","taquicardia","síncope"]
  ];
  if (textOnlySignals.some(g => g.every(t => statement.includes(t))) && !statement.includes("achado visual")) return true;
  const findingsText = Array.isArray(asset.clinical_findings)
    ? asset.clinical_findings.join(" ").toLowerCase()
    : normalizeText(asset.clinical_findings).toLowerCase();
  const someFindingReferenced = findingsText.length > 0 &&
    findingsText.split(/[;,]/).map((s:string)=>s.trim()).filter(Boolean)
      .some((f:string) => f.length >= 6 && statement.includes(f.slice(0, Math.min(f.length, 20)).trim()));
  if (!someFindingReferenced && diagnosis.length > 0 && !statement.includes(diagnosis.split(" ")[0])) return true;
  return false;
}
function validateQuestionHard(asset: any, q: any): { approved: boolean; blocked: boolean; score: number; mode: string; reasons: string[] } {
  const reasons: string[] = [];
  let structure = 0, image = 0, multimodal = 0, pedagogy = 0;

  if (!isSafeAsset(asset)) return { approved: false, blocked: true, score: 0, mode: "blocked", reasons: ["asset_inseguro"] };

  const opts = ["option_a","option_b","option_c","option_d","option_e"];
  if (!opts.every(k => normalizeText(q[k]).length > 0)) return { approved: false, blocked: true, score: 0, mode: "blocked", reasons: ["alternativas_incompletas"] };
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 4) return { approved: false, blocked: true, score: 0, mode: "blocked", reasons: ["correct_index_invalido"] };

  const st = normalizeText(q.statement), ex = normalizeText(q.explanation);
  if (st.length >= 400) structure += 10; else reasons.push("enunciado_curto");
  if (ex.length >= 120) structure += 5; else reasons.push("explicacao_curta");
  if (["easy","medium","hard"].includes(normalizeText(q.difficulty))) structure += 3;
  if (normalizeText(q.exam_style).length >= 3) structure += 2;
  const rm = q.rationale_map || {};
  if (["A","B","C","D","E"].every(k => normalizeText(rm[k]).length >= 10)) structure += 5; else reasons.push("rationale_incompleto");

  if (!hasBlockedUrl(asset.image_url)) image += 10;
  if (["gold","silver"].includes(asset.validation_level || "")) image += 5;
  if (["real_medical","validated_medical"].includes(asset.asset_origin || "")) image += 5;
  if (Number(asset.clinical_confidence || 0) >= 0.95) image += 5; else if (Number(asset.clinical_confidence || 0) >= 0.9) image += 3;

  if (mentionsImageDependence(st)) multimodal += 10; else reasons.push("nao_depende_de_imagem");
  if (!fakeMultimodalByContent(asset, q)) multimodal += 15; else reasons.push("fake_multimodal");

  const optVals = opts.map(k => normalizeText(q[k]).toLowerCase());
  if (new Set(optVals).size < 5) reasons.push("alternativas_repetidas");
  if (wordCount(st) < 65) reasons.push("caso_pouco_desenvolvido");
  const engCount = ENGLISH_WORDS_HARD.filter(w => `${st} ${ex}`.toLowerCase().includes(w)).length;
  if (engCount >= 2) reasons.push("vazamento_ingles");

  const pWeakCount = reasons.filter(r => ["enunciado_curto","explicacao_curta","caso_pouco_desenvolvido","alternativas_repetidas","rationale_incompleto","vazamento_ingles"].includes(r)).length;
  pedagogy = Math.max(0, 25 - pWeakCount * 5);

  const score = structure + image + multimodal + pedagogy;

  if (reasons.includes("fake_multimodal") || reasons.includes("nao_depende_de_imagem")) {
    return { approved: score >= 70, blocked: false, score, mode: "text_only", reasons };
  }
  if (score < 70) return { approved: false, blocked: true, score, mode: "blocked", reasons };
  return { approved: true, blocked: false, score, mode: "multimodal", reasons };
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(msg: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateQuestion(q: any): string[] {
  const errors: string[] = [];
  if (!q.statement || q.statement.length < MIN_STATEMENT) errors.push(`statement curto: ${q.statement?.length || 0}`);
  if (!q.explanation || q.explanation.length < MIN_EXPLANATION) errors.push(`explanation curta: ${q.explanation?.length || 0}`);
  for (const opt of ["option_a", "option_b", "option_c", "option_d", "option_e"]) {
    if (!q[opt] || q[opt].trim().length === 0) errors.push(`${opt} ausente`);
  }
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 4) errors.push("correct_index inválido");
  if (!q.rationale_map || typeof q.rationale_map !== "object") {
    errors.push("rationale_map ausente");
  } else {
    for (const key of ["A", "B", "C", "D", "E"]) {
      if (!q.rationale_map[key] || q.rationale_map[key].trim().length === 0) errors.push(`rationale_map.${key} vazio`);
    }
  }
  if (!q.difficulty || !["easy", "medium", "hard"].includes(q.difficulty)) errors.push("difficulty inválido");
  const fullText = `${q.statement || ""} ${q.explanation || ""}`;
  const eng = fullText.match(ENGLISH_PATTERN) || [];
  if (eng.length > 3) errors.push("conteúdo em inglês");
  return errors;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const executionStart = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // ── FAIL-SAFE 1: Auto-fail stale runs ──
  try {
    const { data: staleRuns } = await sb
      .from("question_generation_runs")
      .select("id")
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString());

    if (staleRuns && staleRuns.length > 0) {
      const ids = staleRuns.map(r => r.id);
      await sb.from("question_generation_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        notes: `Auto-fail: sem progresso por ${STALE_RUN_MINUTES}min`,
      }).in("id", ids);

      // Register alert for each stale run
      const staleAlerts = ids.map(id => ({
        run_id: id,
        alert_type: "run_failed",
        severity: "critical",
        message: `Run ${id} auto-failed: sem progresso por ${STALE_RUN_MINUTES} minutos`,
        details: { auto_failed: true, stale_minutes: STALE_RUN_MINUTES },
      }));
      try { await sb.from("pipeline_alerts").insert(staleAlerts); } catch (err) { console.warn("[auto-gen] stale alerts insert failed:", err); }

      console.log(`[auto-gen] Auto-failed ${ids.length} stale runs`);
    }
  } catch (e) {
    console.warn("[auto-gen] Stale run cleanup error:", e);
  }

  // ── Main pipeline in try/catch ──
  let runId: string | null = null;

  try {
    // Find eligible assets
    console.log("[auto-gen] Step 1: Finding eligible assets...");

    const { data: allAssets, error: assetErr } = await sb
      .from("medical_image_assets")
      .select("id, asset_code, image_type, specialty, subtopic, diagnosis, clinical_findings, distractors, difficulty, image_url, asset_origin, validation_level, review_status, integrity_status, clinical_confidence, is_active")
      .eq("is_active", true)
      .eq("review_status", "published")
      .gte("clinical_confidence", 0.9)
      .in("validation_level", ["gold", "silver"])
      .limit(50);

    if (assetErr) {
      console.error("[auto-gen] Asset query error:", assetErr);
      return errorResponse(`Asset query failed: ${assetErr.message}`);
    }

    if (!allAssets || allAssets.length === 0) {
      console.log("[auto-gen] No eligible assets found");
      return ok({ success: true, message: "Nenhum asset elegível", generated: 0 });
    }

    console.log(`[auto-gen] Step 2: Checking question counts for ${allAssets.length} assets...`);

    const targetAssets: any[] = [];
    for (const asset of allAssets) {
      // Timeout check
      if (Date.now() - executionStart > EXECUTION_TIMEOUT_MS) {
        console.warn("[auto-gen] Execution timeout during asset selection");
        break;
      }

      const { count } = await sb
        .from("medical_image_questions")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", asset.id)
        .in("status", ["published", "needs_review", "draft", "upgrading"]);

      if ((count || 0) < MAX_QUESTIONS_PER_ASSET) {
        targetAssets.push({ ...asset, existing_count: count || 0 });
      }
      if (targetAssets.length >= BATCH_SIZE) break;
    }

    if (targetAssets.length === 0) {
      console.log("[auto-gen] All assets already have enough questions");
      return ok({ success: true, message: "Todos os assets já têm 3 questões", generated: 0 });
    }

    console.log(`[auto-gen] Step 3: Creating run for ${targetAssets.length} assets...`);

    // Create run record
    const { data: run, error: runErr } = await sb
      .from("question_generation_runs")
      .insert({
        run_type: "auto_image_batch",
        status: "running",
        target_assets: targetAssets.length,
        processed_assets: 0,
        generated_questions: 0,
        failed_assets: 0,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runErr) {
      console.error("[auto-gen] Run creation error:", runErr);
      return errorResponse(`Run creation failed: ${runErr.message}`);
    }

    runId = run.id;
    let totalGenerated = 0;
    let totalFailed = 0;
    let processedAssets = 0;
    const results: any[] = [];

    for (const asset of targetAssets) {
      // ── FAIL-SAFE 2: Timeout per iteration ──
      if (Date.now() - executionStart > EXECUTION_TIMEOUT_MS) {
        console.warn("[auto-gen] Execution timeout reached, stopping batch");
        break;
      }

      const needed = MAX_QUESTIONS_PER_ASSET - (asset.existing_count || 0);
      if (needed <= 0) continue;

      // ── VISION GATE: fail-closed — retrato/não-clínico = rejeitado ──
      const urlCheck = isUrlSuspicious(asset.image_url);
      if (urlCheck.suspicious) {
        console.warn(`[auto-gen] ⛔ URL suspeita ${asset.asset_code}: ${urlCheck.reason}`);
        totalFailed++;
        processedAssets++;
        results.push({ asset: asset.asset_code, error: `url_suspicious:${urlCheck.reason}` });
        try { await sb.from("question_generation_runs").update({ processed_assets: processedAssets, failed_assets: totalFailed }).eq("id", runId); } catch (err) { console.warn("[auto-gen] heartbeat update failed (url_suspicious):", err); }
        continue;
      }

      const visionCheck = await validateImageVision(asset.image_url, asset.diagnosis || "", asset.image_type || "", LOVABLE_API_KEY);
      if (!visionCheck.valid) {
        console.warn(`[auto-gen] ⛔ Vision gate rejeitou ${asset.asset_code}: ${visionCheck.reason}`);
        totalFailed++;
        processedAssets++;
        results.push({ asset: asset.asset_code, error: `vision_gate:${visionCheck.reason}` });
        try { await sb.from("question_generation_runs").update({ processed_assets: processedAssets, failed_assets: totalFailed }).eq("id", runId); } catch (err) { console.warn("[auto-gen] heartbeat update failed (vision_gate):", err); }
        continue;
      }

      console.log(`[auto-gen] Step 4: Generating ${needed} questions for ${asset.asset_code}...`);

      try {
        const findings = Array.isArray(asset.clinical_findings) ? asset.clinical_findings.join(", ") : String(asset.clinical_findings || "");
        const distractors = Array.isArray(asset.distractors) ? asset.distractors.join(", ") : String(asset.distractors || "");

        const difficulties = ["medium", "hard", "hard"].slice(0, needed);
        const types = [
          "diagnóstico direto (caso clássico)",
          "diagnóstico diferencial (caso atípico)",
          "conduta/manejo clínico",
        ].slice(0, needed);

        const prompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês.

Você é um examinador de prova de Residência Médica nível USP/ENARE.

GERE EXATAMENTE ${needed} questão(ões) médica(s) sobre a imagem descrita abaixo.

== ASSET DE IMAGEM ==
Tipo: ${asset.image_type}
Especialidade: ${asset.specialty || "N/A"}
Subtema: ${asset.subtopic || "N/A"}  
Diagnóstico: ${asset.diagnosis}
Achados clínicos: ${findings || "N/A"}
Distratores: ${distractors || "N/A"}
Dificuldade do asset: ${asset.difficulty || "medium"}

== QUESTÕES A GERAR ==
${difficulties.map((d, i) => `Q${i + 1}: ${types[i]} - difficulty: ${d}`).join("\n")}

== REGRAS ABSOLUTAS ==
1. Enunciado >= 400 caracteres: identificação do paciente, contexto clínico, HDA, exame físico, conexão com achados da imagem, pergunta
2. 5 alternativas plausíveis (NUNCA absurdas), apenas 1 correta
3. Explicação >= 120 caracteres justificando a correta e explicando por que as erradas estão incorretas
4. rationale_map com chaves A-E, cada uma explicando por que correta/incorreta
5. Paciente com perfil brasileiro único (nome, idade, contexto social)
6. A imagem DEVE ser essencial para responder — sem ela, a questão não pode ser resolvida
7. PROIBIDO: frases como "observe a imagem" ou "veja a figura". Integrar achados naturalmente
8. PROIBIDO: texto em inglês, alternativas absurdas, enunciado curto
9. Cada questão DEVE ter perspectiva clínica diferente das demais
10. exam_style: ENARE ou USP

Retorne APENAS um JSON array válido (sem markdown):
[{"statement":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","option_e":"...","correct_index":0,"explanation":"...","rationale_map":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"difficulty":"...","exam_style":"ENARE"}]`;

        const response = await aiFetch({
          messages: [{ role: "user", content: prompt }],
          model: "openai/gpt-5-mini",
          maxTokens: 8192,
          timeoutMs: 60000,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`AI ${response.status}: ${errText.slice(0, 200)}`);
        }

        const aiData = await response.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        let parsed = parseAiJson(rawContent);
        if (!Array.isArray(parsed)) parsed = [parsed];

        let assetGenerated = 0;
        for (const q of parsed) {
          if (q.invalid) {
            console.warn(`[auto-gen] AI rejected for ${asset.asset_code}: ${q.reason}`);
            continue;
          }

          for (const f of ["statement", "option_a", "option_b", "option_c", "option_d", "option_e", "explanation"]) {
            if (typeof q[f] === "string") q[f] = cleanQuestionText(q[f]);
          }

          if (!q.difficulty) q.difficulty = asset.difficulty || "medium";
          if (!q.exam_style) q.exam_style = "ENARE";

          const errors = validateQuestion(q);
          if (errors.length > 0) {
            console.warn(`[auto-gen] Validation failed for ${asset.asset_code}: ${errors.join("; ")}`);
            totalFailed++;
            continue;
          }

          // ── HARD DETERMINISTIC VALIDATION ──
          const hardResult = validateQuestionHard(asset, q);
          console.log(`[auto-gen] Hard validation for ${asset.asset_code}: score=${hardResult.score} mode=${hardResult.mode} approved=${hardResult.approved} reasons=${hardResult.reasons.join(",")}`);

          if (hardResult.blocked || !hardResult.approved) {
            console.warn(`[auto-gen] ❌ BLOCKED by hard validation: ${asset.asset_code} (score=${hardResult.score}, reasons=${hardResult.reasons.join(",")})`);
            totalFailed++;
            continue;
          }

          const prefix = (asset.image_type || "img").toUpperCase().slice(0, 4);
          const seq = Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5);
          const questionCode = `${prefix}-AUTO-${seq}`;

          // ── ENFORCE EDITORIAL GRADE ──
          if (!q.editorial_grade || !["excellent", "good"].includes(q.editorial_grade)) {
            console.warn(`[auto-gen] editorial_grade missing/invalid for ${asset.asset_code}, defaulting to "good"`);
            q.editorial_grade = "good";
          }

          const { error: insertErr } = await sb.from("medical_image_questions").insert({
            asset_id: asset.id,
            question_code: questionCode,
            statement: q.statement,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            option_e: q.option_e,
            correct_index: q.correct_index,
            explanation: q.explanation,
            rationale_map: q.rationale_map,
            difficulty: q.difficulty,
            exam_style: q.exam_style,
            editorial_grade: q.editorial_grade,
            status: "needs_review",
            question_mode: hardResult.mode,
            hard_validation_score: hardResult.score,
            hard_validation_reasons: hardResult.reasons,
          });

          if (insertErr) {
            console.error(`[auto-gen] Insert error for ${asset.asset_code}:`, insertErr);
            totalFailed++;
          } else {
            assetGenerated++;
            totalGenerated++;
          }
        }

        processedAssets++;
        results.push({ asset: asset.asset_code, needed, generated: assetGenerated });

        // ── FAIL-SAFE 3: Heartbeat — update run progress after each asset ──
        await sb.from("question_generation_runs").update({
          processed_assets: processedAssets,
          generated_questions: totalGenerated,
          failed_assets: totalFailed,
        }).eq("id", runId);

        // Rate limit between assets
        await new Promise(r => setTimeout(r, 1000));

      } catch (e) {
        console.error(`[auto-gen] Error processing ${asset.asset_code}:`, e);
        totalFailed++;
        processedAssets++;
        results.push({ asset: asset.asset_code, error: (e as Error).message });

        // Update progress even on failure
        try {
          await sb.from("question_generation_runs").update({
            processed_assets: processedAssets,
            failed_assets: totalFailed,
          }).eq("id", runId);
        } catch (err) {
          console.warn("[auto-gen] failure heartbeat update failed:", err);
        }
      }
    }

    // ── Final run update ──
    const durationMs = Date.now() - executionStart;
    const finalStatus = totalGenerated > 0 ? (totalFailed > 0 ? "partial" : "completed") : "failed";
    await sb.from("question_generation_runs").update({
      status: finalStatus,
      processed_assets: processedAssets,
      generated_questions: totalGenerated,
      failed_assets: totalFailed,
      finished_at: new Date().toISOString(),
      notes: `Auto-batch: ${totalGenerated} geradas, ${totalFailed} falharam (${durationMs}ms)`,
    }).eq("id", runId);

    // ── OPERATIONAL ALERTS ──
    const alerts: { alert_type: string; severity: string; message: string; details: any }[] = [];

    if (finalStatus === "failed") {
      alerts.push({
        alert_type: "run_failed",
        severity: "critical",
        message: `Run ${runId} falhou: 0 questões geradas de ${processedAssets} assets processados`,
        details: { run_id: runId, processed: processedAssets, duration_ms: durationMs },
      });
    }

    if (totalGenerated === 0 && finalStatus !== "failed") {
      alerts.push({
        alert_type: "run_sterile",
        severity: "warning",
        message: `Run ${runId} concluída sem gerar questões (${processedAssets} assets processados)`,
        details: { run_id: runId, processed: processedAssets, duration_ms: durationMs },
      });
    }

    if (totalFailed > 0) {
      alerts.push({
        alert_type: "partial_failure",
        severity: "warning",
        message: `Run ${runId}: ${totalFailed} asset(s) falharam durante geração`,
        details: { run_id: runId, failed: totalFailed, generated: totalGenerated, duration_ms: durationMs },
      });
    }

    if (alerts.length > 0) {
      const rows = alerts.map(a => ({ ...a, run_id: runId }));
      try { await sb.from("pipeline_alerts").insert(rows); } catch (err) { console.warn("[auto-gen] Alert insert error:", err); }
    }

    console.log(`[auto-gen] Done: ${totalGenerated} generated, ${totalFailed} failed in ${durationMs}ms, ${alerts.length} alerts`);

    return ok({
      success: true,
      generated: totalGenerated,
      failed: totalFailed,
      assets_processed: processedAssets,
      execution_ms: Date.now() - executionStart,
      results,
    });

  } catch (e) {
    // ── FAIL-SAFE 4: Global catch persists error ──
    console.error("[auto-gen] FATAL:", e);

    if (runId) {
      try {
        await sb.from("question_generation_runs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          notes: `FATAL: ${(e as Error).message?.slice(0, 200)}`,
        }).eq("id", runId);
      } catch (err) {
        console.warn("[auto-gen] FATAL run update failed:", err);
      }
    }

    return errorResponse((e as Error).message);
  }
});
