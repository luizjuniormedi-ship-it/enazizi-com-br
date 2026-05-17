import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson, cleanQuestionText } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENGLISH_PATTERN = /\b(the|is|are|was|were|this|that|which|what|patient|diagnosis|treatment|clinical|history)\b/gi;
const MIN_STATEMENT_LEN = 400;
const MIN_EXPLANATION_LEN = 120;

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface QuestionResult {
  id: string;
  code: string;
  status: "needs_review" | "rejected" | "failed";
  stage?: string;
  error?: string;
  raw_excerpt?: string;
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errResponse(status: number, error: string, stage: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: false, error, stage, ...extra }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateUpgradedQuestion(q: any): ValidationResult {
  const errors: string[] = [];

  if (!q.statement || q.statement.length < MIN_STATEMENT_LEN)
    errors.push(`statement curto: ${q.statement?.length || 0} chars (min ${MIN_STATEMENT_LEN})`);
  if (!q.explanation || q.explanation.length < MIN_EXPLANATION_LEN)
    errors.push(`explanation curta: ${q.explanation?.length || 0} chars (min ${MIN_EXPLANATION_LEN})`);

  for (const opt of ["option_a", "option_b", "option_c", "option_d", "option_e"]) {
    if (!q[opt] || q[opt].trim().length === 0) errors.push(`${opt} ausente ou vazio`);
  }

  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 4)
    errors.push(`correct_index inválido: ${q.correct_index}`);

  if (!q.rationale_map || typeof q.rationale_map !== "object") {
    errors.push("rationale_map ausente");
  } else {
    for (const key of ["A", "B", "C", "D", "E"]) {
      if (!q.rationale_map[key] || q.rationale_map[key].trim().length === 0)
        errors.push(`rationale_map.${key} ausente ou vazio`);
    }
  }

  if (!q.difficulty || !["easy", "medium", "hard"].includes(q.difficulty))
    errors.push(`difficulty inválido: ${q.difficulty}`);

  if (!q.exam_style) errors.push("exam_style ausente");

  const fullText = `${q.statement || ""} ${q.explanation || ""} ${q.option_a || ""} ${q.option_b || ""} ${q.option_c || ""} ${q.option_d || ""} ${q.option_e || ""}`;
  const englishMatches = fullText.match(ENGLISH_PATTERN) || [];
  if (englishMatches.length > 3)
    errors.push(`conteúdo em inglês detectado: ${englishMatches.slice(0, 5).join(", ")}`);

  return { valid: errors.length === 0, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Top-level try — NEVER let the function crash without a JSON response
  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errResponse(401, "Não autorizado", "auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return errResponse(500, "Configuração do servidor incompleta", "config");

    const sb = createClient(supabaseUrl, serviceRoleKey);

    let user: any = null;
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: u }, error: authError } = await sb.auth.getUser(token);
      if (authError || !u) return errResponse(401, "Token inválido", "auth");
      user = u;
    } catch (e) {
      console.error("[auth] Error:", e);
      return errResponse(401, "Falha na autenticação", "auth");
    }

    // Admin check
    try {
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => r.role === "admin");
      if (!isAdmin) return errResponse(403, "Apenas administradores", "auth");
    } catch (e) {
      console.error("[auth] Roles check error:", e);
      return errResponse(403, "Erro ao verificar permissões", "auth");
    }

    // 2. Parse body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { action = "upgrade", batch_size = 3, question_id } = body;

    // --- ACTION: stats ---
    if (action === "stats") {
      try {
        const counts: Record<string, number> = {};
        for (const status of ["draft", "upgrading", "upgraded", "needs_review", "published", "rejected"]) {
          const { count } = await sb.from("medical_image_questions").select("id", { count: "exact", head: true }).eq("status", status);
          counts[status] = count || 0;
        }

        let recentErrors: any[] = [];
        try {
          const { data } = await sb
            .from("image_question_audit_log")
            .select("question_id, previous_status, new_status, reason, created_at")
            .eq("new_status", "rejected")
            .order("created_at", { ascending: false })
            .limit(10);
          recentErrors = data || [];
        } catch { /* audit log may not exist yet */ }

        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const failRate = total > 0 ? ((counts.rejected || 0) / total * 100).toFixed(1) : "0";

        return ok({ success: true, counts, total, fail_rate_pct: failRate, recent_errors: recentErrors });
      } catch (e) {
        console.error("[stats] Error:", e);
        return errResponse(500, "Erro ao buscar estatísticas", "stats");
      }
    }

    // --- ACTION: publish ---
    if (action === "publish") {
      try {
        if (!question_id) return ok({ success: false, error: "question_id obrigatório" });

        const { data: q } = await sb.from("medical_image_questions")
          .select("id, status, statement, explanation, option_a, option_b, option_c, option_d, option_e, correct_index, rationale_map, difficulty, exam_style")
          .eq("id", question_id).single();

        if (!q) return ok({ success: false, error: "Questão não encontrada" });
        if (q.status !== "needs_review") return ok({ success: false, error: `Status inválido para publicação: ${q.status}` });

        const validation = validateUpgradedQuestion(q);
        if (!validation.valid) {
          await sb.from("medical_image_questions").update({ status: "rejected" }).eq("id", question_id);
          return ok({ success: false, error: "Falhou validação final", errors: validation.errors });
        }

        await sb.from("medical_image_questions").update({ status: "published" }).eq("id", question_id);
        return ok({ success: true, published: true, question_id });
      } catch (e) {
        console.error("[publish] Error:", e);
        return errResponse(500, "Erro ao publicar questão", "publish");
      }
    }

    // --- ACTION: publish_all ---
    if (action === "publish_all") {
      try {
        const { data: pending } = await sb.from("medical_image_questions")
          .select("id, statement, explanation, option_a, option_b, option_c, option_d, option_e, correct_index, rationale_map, difficulty, exam_style")
          .eq("status", "needs_review")
          .limit(50);

        let published = 0, rejected = 0;
        for (const q of (pending || [])) {
          try {
            const v = validateUpgradedQuestion(q);
            if (v.valid) {
              await sb.from("medical_image_questions").update({ status: "published" }).eq("id", q.id);
              published++;
            } else {
              await sb.from("medical_image_questions").update({ status: "rejected" }).eq("id", q.id);
              rejected++;
            }
          } catch (e) {
            console.error(`[publish_all] Error on ${q.id}:`, e);
            rejected++;
          }
        }
        return ok({ success: true, published, rejected, total: (pending || []).length });
      } catch (e) {
        console.error("[publish_all] Error:", e);
        return errResponse(500, "Erro na publicação em lote", "publish_all");
      }
    }

    // --- ACTION: retry_rejected ---
    if (action === "retry_rejected") {
      try {
        const retryLimit = Math.min(batch_size || 10, 50);
        const { data: rejected, error: fetchErr } = await sb
          .from("medical_image_questions")
          .select("id")
          .eq("status", "rejected")
          .limit(retryLimit);

        if (fetchErr) throw new Error(fetchErr.message);
        if (!rejected || rejected.length === 0) {
          return ok({ success: true, message: "Nenhuma questão rejeitada para reprocessar", reset: 0 });
        }

        const ids = rejected.map((r: any) => r.id);
        const { error: updateErr } = await sb
          .from("medical_image_questions")
          .update({ status: "draft" })
          .in("id", ids);

        if (updateErr) throw new Error(updateErr.message);

        return ok({ success: true, reset: ids.length, message: `${ids.length} questões voltaram para draft` });
      } catch (e) {
        console.error("[retry_rejected] Error:", e);
        return errResponse(500, `Erro ao reprocessar rejeitadas: ${(e as Error).message}`, "retry_rejected");
      }
    }

    // --- ACTION: upgrade (default) ---
    const limit = Math.min(batch_size, 5);
    let drafts: any[] = [];

    try {
      const { data, error: fetchErr } = await sb
        .from("medical_image_questions")
        .select(`
          id, question_code, statement, option_a, option_b, option_c, option_d, option_e,
          correct_index, explanation, rationale_map, difficulty, exam_style,
          asset_id,
          medical_image_assets!inner (
            asset_code, image_type, specialty, subtopic, diagnosis,
            clinical_findings, distractors, difficulty
          )
        `)
        .eq("status", "draft")
        .limit(limit);

      if (fetchErr) throw new Error(`Erro ao buscar drafts: ${fetchErr.message}`);
      drafts = data || [];
    } catch (e) {
      console.error("[fetch_drafts] Error:", e);
      return errResponse(500, `Erro ao buscar questões: ${(e as Error).message}`, "fetch_drafts");
    }

    if (drafts.length === 0) {
      return ok({ success: true, message: "Nenhuma questão em draft", upgraded: 0, failed: 0, errors: 0, results: [] });
    }

    // Mark all as "upgrading"
    try {
      const ids = drafts.map(d => d.id);
      await sb.from("medical_image_questions").update({ status: "upgrading" }).in("id", ids);
    } catch (e) {
      console.error("[mark_upgrading] Error:", e);
      // Non-fatal — continue processing
    }

    const results: QuestionResult[] = [];

    for (const draft of drafts) {
      const qId = draft.id;
      const qCode = draft.question_code || "unknown";
      const asset = (draft as any).medical_image_assets;

      // Validate asset exists
      if (!asset) {
        console.warn(`[upgrade] No asset for ${qCode}`);
        try { await sb.from("medical_image_questions").update({ status: "rejected" }).eq("id", qId); } catch {}
        results.push({ id: qId, code: qCode, status: "failed", stage: "validate_asset", error: "Asset não encontrado" });
        continue;
      }

      // Build prompt
      let prompt: string;
      try {
        const findings = Array.isArray(asset.clinical_findings) ? asset.clinical_findings.join(", ") : String(asset.clinical_findings || "");
        const distractors = Array.isArray(asset.distractors) ? asset.distractors.join(", ") : String(asset.distractors || "");

        prompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês.

Você é um examinador de prova de Residência Médica (ENARE/USP).

TAREFA: Reescrever completamente a questão abaixo para padrão de prova real de alta concorrência.

== DADOS DO ASSET DE IMAGEM ==
Tipo: ${asset.image_type || "N/A"}
Especialidade: ${asset.specialty || "N/A"}
Subtema: ${asset.subtopic || "N/A"}
Diagnóstico: ${asset.diagnosis || "N/A"}
Achados clínicos na imagem: ${findings || "N/A"}
Distratores do asset: ${distractors || "N/A"}
Dificuldade do asset: ${asset.difficulty || "medium"}

== QUESTÃO ATUAL (RASCUNHO) ==
Enunciado: ${draft.statement || "N/A"}
A) ${draft.option_a || "N/A"}  B) ${draft.option_b || "N/A"}  C) ${draft.option_c || "N/A"}  D) ${draft.option_d || "N/A"}  E) ${draft.option_e || "N/A"}
Gabarito: índice ${draft.correct_index ?? 0}
Explicação: ${draft.explanation || "N/A"}

== REGRAS ABSOLUTAS ==
1. Enunciado >= 400 caracteres com: identificação, contexto, HDA, exame físico, conexão com imagem, pergunta
2. 5 alternativas plausíveis (sem absurdas), 1 correta
3. Explicação >= 120 caracteres justificando correta e erradas
4. rationale_map com chaves A-E preenchidas
5. difficulty: easy|medium|hard
6. exam_style: ENARE ou USP
7. Paciente com perfil único brasileiro
8. PROIBIDO: enunciado curto, frase seca, alternativa absurda, texto em inglês

Retorne APENAS JSON válido sem markdown:
{"statement":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","option_e":"...","correct_index":0,"explanation":"...","rationale_map":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"difficulty":"...","exam_style":"ENARE"}

Se não atingir padrão: {"invalid":true,"reason":"..."}`;
      } catch (e) {
        console.error(`[build_prompt] ${qCode}:`, e);
        try { await sb.from("medical_image_questions").update({ status: "draft" }).eq("id", qId); } catch {}
        results.push({ id: qId, code: qCode, status: "failed", stage: "build_prompt", error: (e as Error).message });
        continue;
      }

      // Call AI
      let rawContent = "";
      try {
        const response = await aiFetch({
          messages: [{ role: "user", content: prompt }],
          model: "google/gemini-2.5-flash",
          maxTokens: 4096,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`AI status ${response.status}: ${errText.slice(0, 200)}`);
        }

        const aiData = await response.json();
        rawContent = aiData.choices?.[0]?.message?.content || "";
      } catch (e) {
        console.error(`[ai_call] ${qCode}:`, e);
        try { await sb.from("medical_image_questions").update({ status: "draft" }).eq("id", qId); } catch {}
        results.push({ id: qId, code: qCode, status: "failed", stage: "ai_call", error: (e as Error).message });
        continue;
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = parseAiJson(rawContent);
      } catch (e) {
        console.error(`[parse_json] ${qCode}:`, e);
        try { await sb.from("medical_image_questions").update({ status: "rejected" }).eq("id", qId); } catch {}
        results.push({
          id: qId, code: qCode, status: "failed", stage: "parse_json",
          error: (e as Error).message,
          raw_excerpt: rawContent.slice(0, 300),
        });
        continue;
      }

      // Check if AI said invalid
      if (parsed.invalid) {
        console.warn(`[ai_invalid] ${qCode}: ${parsed.reason}`);
        try { await sb.from("medical_image_questions").update({ status: "rejected" }).eq("id", qId); } catch {}
        results.push({ id: qId, code: qCode, status: "rejected", stage: "ai_invalid", error: parsed.reason || "IA considerou inviável" });
        continue;
      }

      // Validate required fields exist
      const required = ["statement", "option_a", "option_b", "option_c", "option_d", "option_e", "correct_index", "explanation", "rationale_map"];
      const missing = required.filter(f => !(f in parsed));
      if (missing.length > 0) {
        console.warn(`[missing_fields] ${qCode}: ${missing.join(", ")}`);
        try { await sb.from("medical_image_questions").update({ status: "rejected" }).eq("id", qId); } catch {}
        results.push({ id: qId, code: qCode, status: "rejected", stage: "validate_fields", error: `Campos ausentes: ${missing.join(", ")}` });
        continue;
      }

      // Clean text fields
      try {
        for (const f of ["statement", "option_a", "option_b", "option_c", "option_d", "option_e", "explanation"]) {
          if (typeof parsed[f] === "string") parsed[f] = cleanQuestionText(parsed[f]);
        }
      } catch { /* non-fatal */ }

      // Defaults
      if (!parsed.difficulty) parsed.difficulty = asset.difficulty || "medium";
      if (!parsed.exam_style) parsed.exam_style = "ENARE";

      // Quality validation
      const validation = validateUpgradedQuestion(parsed);

      if (!validation.valid) {
        console.warn(`[validation] ${qCode}: ${validation.errors.join("; ")}`);
        try {
          await sb.from("medical_image_questions").update({
            statement: parsed.statement || draft.statement,
            explanation: parsed.explanation || draft.explanation,
            status: "rejected",
          }).eq("id", qId);
        } catch {}
        results.push({ id: qId, code: qCode, status: "rejected", stage: "validation", error: validation.errors.join("; ") });
        continue;
      }

      // Save as needs_review
      try {
        const { error: updateErr } = await sb.from("medical_image_questions").update({
          statement: parsed.statement,
          option_a: parsed.option_a,
          option_b: parsed.option_b,
          option_c: parsed.option_c,
          option_d: parsed.option_d,
          option_e: parsed.option_e,
          correct_index: parsed.correct_index,
          explanation: parsed.explanation,
          rationale_map: parsed.rationale_map,
          difficulty: parsed.difficulty,
          exam_style: parsed.exam_style,
          status: "needs_review",
        }).eq("id", qId);

        if (updateErr) throw updateErr;
        results.push({ id: qId, code: qCode, status: "needs_review" });
      } catch (e) {
        console.error(`[db_update] ${qCode}:`, e);
        try { await sb.from("medical_image_questions").update({ status: "draft" }).eq("id", qId); } catch {}
        results.push({ id: qId, code: qCode, status: "failed", stage: "db_update", error: (e as Error).message });
      }

      // Rate limit delay between questions
      if (drafts.indexOf(draft) < drafts.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const upgraded = results.filter(r => r.status === "needs_review").length;
    const failed = results.filter(r => r.status === "failed").length;
    const rejected = results.filter(r => r.status === "rejected").length;

    return ok({
      success: true,
      upgraded,
      failed,
      rejected,
      total: drafts.length,
      results,
    });

  } catch (e) {
    // ULTIMATE FALLBACK — never return empty body or crash
    console.error("[FATAL] upgrade-image-questions:", e);
    return errResponse(500, (e as Error).message || "Erro desconhecido", "fatal");
  }
});
