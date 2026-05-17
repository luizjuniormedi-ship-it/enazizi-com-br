const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { asset, question, question_id, mode } = body;

    // mode: "single" (audit one) or "batch" (audit all published)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (mode === "batch") {
      return await auditBatch(supabase);
    }

    if (!asset || !question) {
      return new Response(JSON.stringify({ error: "asset and question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await auditSingle(asset, question);

    // If question_id provided, persist result
    if (question_id && result) {
      await persistAudit(supabase, question_id, result);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Audit error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function auditSingle(asset: any, question: any) {
  const prompt = buildAuditPrompt(asset, question);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI API error: ${res.status}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";

  // Extract JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  return normalizeAuditResult(parsed);
}

function normalizeAuditResult(p: any): any {
  // Extract score from nested or flat structures
  const score = typeof p.final_score === "number" ? p.final_score
    : typeof p["ETAPA 6 — SCORE FINAL"] === "number" ? p["ETAPA 6 — SCORE FINAL"]
    : extractNestedScore(p);

  const strength = p.multimodal_strength || p["ETAPA 1 — FORÇA MULTIMODAL"]
    || p.step_1_force_multimodal?.classification || "unknown";
  const pedValue = p.pedagogical_value || p["ETAPA 2 — VALOR PEDAGÓGICO"]
    || p.step_2_valor_pedagogico?.classification || "unknown";
  const examLevel = p.exam_level || p["ETAPA 3 — NÍVEL DE PROVA"]
    || p.step_3_nivel_de_prova?.classification || "unknown";
  const explQuality = p.explanation_quality || p["ETAPA 5 — QUALIDADE DA EXPLICAÇÃO"]
    || p.step_5_qualidade_da_explicacao?.classification || "unknown";

  let status = p.status || p["ETAPA 7 — DECISÃO"] || "unknown";
  // Derive status from score if AI didn't provide it cleanly
  if (!["approved", "needs_improvement", "rejected"].includes(status)) {
    if (score >= 90 && strength === "strong") status = "approved";
    else if (score >= 75) status = "needs_improvement";
    else status = "rejected";
  }

  const action = p.recommended_action || p["ETAPA 8 — SUGESTÃO DE AÇÃO"]
    || (status === "approved" ? "keep_multimodal" : status === "rejected" ? "regenerate" : "improve");

  return {
    status,
    multimodal_strength: strength,
    pedagogical_value: pedValue,
    exam_level: examLevel,
    explanation_quality: explQuality,
    final_score: score,
    critical_flags: p.critical_flags || [],
    issues: p.issues || [],
    recommended_action: action,
    suggested_fix: p.suggested_fix || "",
  };
}

function extractNestedScore(p: any): number {
  let total = 0;
  for (const key of Object.keys(p)) {
    const val = p[key];
    if (val && typeof val === "object" && typeof val.score === "number") {
      total += val.score;
    }
  }
  return total || 50;
}

async function auditBatch(supabase: any) {
  // Get published multimodal questions without recent audit
  const { data: questions, error } = await supabase
    .from("medical_image_questions")
    .select(`
      id, statement, option_a, option_b, option_c, option_d, option_e,
      correct_index, explanation, difficulty, exam_style,
      senior_audit_score, editorial_grade,
      medical_image_assets!inner(
        image_type, diagnosis, clinical_findings, image_url,
        clinical_confidence, review_status, is_active
      )
    `)
    .eq("status", "published")
    .eq("medical_image_assets.is_active", true)
    .eq("medical_image_assets.review_status", "published")
    .gte("medical_image_assets.clinical_confidence", 0.90)
    .order("senior_audit_score", { ascending: true, nullsFirst: true })
    .limit(10);

  if (error) throw error;
  if (!questions?.length) {
    return new Response(JSON.stringify({ message: "No questions to audit", audited: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const q of questions) {
    try {
      const asset = q.medical_image_assets;
      const question = {
        statement: q.statement,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        option_e: q.option_e,
        correct_index: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        exam_style: q.exam_style,
      };

      const audit = await auditSingle(asset, question);
      await persistAudit(supabase, q.id, audit);
      results.push({ id: q.id, ...audit });
    } catch (e) {
      console.error(`Audit failed for ${q.id}:`, e.message);
      results.push({ id: q.id, error: e.message });
    }
  }

  const summary = {
    audited: results.filter(r => !r.error).length,
    approved: results.filter(r => r.status === "approved").length,
    needs_improvement: results.filter(r => r.status === "needs_improvement").length,
    rejected: results.filter(r => r.status === "rejected").length,
    errors: results.filter(r => r.error).length,
    results,
  };

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function persistAudit(supabase: any, questionId: string, audit: any) {
  const score = typeof audit.final_score === "number" ? audit.final_score : null;
  let grade = "weak";
  if (score !== null) {
    if (score >= 90) grade = "excellent";
    else if (score >= 75) grade = "good";
  }

  // Update question with audit results
  await supabase
    .from("medical_image_questions")
    .update({
      senior_audit_score: score,
      editorial_grade: grade,
      // If rejected, downgrade status
      ...(audit.status === "rejected" ? { status: "needs_review" } : {}),
    })
    .eq("id", questionId);

  // Log in audit trail
  await supabase.from("image_question_audit_log").insert({
    question_id: questionId,
    previous_status: "published",
    new_status: audit.status === "rejected" ? "needs_review" : "published",
    reason: `Pedagogical audit: ${audit.status} (score: ${score}). ${audit.recommended_action}`,
    payload_summary: {
      multimodal_strength: audit.multimodal_strength,
      pedagogical_value: audit.pedagogical_value,
      exam_level: audit.exam_level,
      explanation_quality: audit.explanation_quality,
      final_score: score,
      issues: audit.issues || [],
      critical_flags: audit.critical_flags || [],
    },
  });
}

const SYSTEM_PROMPT = `Você é um AUDITOR PEDAGÓGICO MULTIMODAL SÊNIOR do ENAZIZI.
Você avalia questões médicas multimodais com rigor de banca USP/ENARE.
Você NÃO gera questões. Você AUDITA.

Critérios de avaliação (8 etapas):

ETAPA 1 — FORÇA MULTIMODAL (0-25 pts)
- A imagem é realmente necessária para acertar?
- O enunciado entrega a resposta sozinho?
- A imagem muda o raciocínio?
- O achado visual é central para a alternativa correta?
Classificação: strong | moderate | weak

ETAPA 2 — VALOR PEDAGÓGICO (0-20 pts)
- A questão ensina algo importante?
- O raciocínio é útil para prova?
- O aluno aprende diferencial, interpretação ou conduta?
Classificação: high | medium | low

ETAPA 3 — NÍVEL DE PROVA (0-20 pts)
- Parece questão real de residência?
- Nível compatível com a banca declarada?
Classificação: high_exam_level | medium_exam_level | low_exam_level

ETAPA 4 — QUALIDADE DAS ALTERNATIVAS (0-20 pts)
- Todas plausíveis? Alguma absurda? Resposta denunciada?

ETAPA 5 — QUALIDADE DA EXPLICAÇÃO (0-15 pts)
- Explica correta e incorretas? Usa raciocínio clínico?
Classificação: strong_explanation | moderate_explanation | weak_explanation

ETAPA 6 — SCORE FINAL (soma das etapas, 0-100)

ETAPA 7 — DECISÃO
- approved: score >= 90, strength = strong, value = high
- needs_improvement: score 75-89 ou moderate
- rejected: score < 75, weak, low, ou erro crítico

Retorne APENAS JSON com a estrutura especificada. Nenhum texto fora do JSON.`;

function buildAuditPrompt(asset: any, question: any): string {
  return JSON.stringify({
    asset: {
      image_type: asset.image_type,
      diagnosis: asset.diagnosis,
      clinical_findings: asset.clinical_findings || [],
      image_url: asset.image_url,
    },
    question: {
      statement: question.statement,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      option_e: question.option_e || null,
      correct_index: question.correct_index,
      explanation: question.explanation,
      difficulty: question.difficulty,
      exam_style: question.exam_style,
    },
  }, null, 2);
}
