import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getAdmin, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, smartFallback, handleAiError,
  logGeneratedContent, contentHash,
} from "../_shared/ai-phase2-helpers.ts";
import {
  planGranularOrFallback, renderPlanForPrompt,
} from "../_shared/granular-generator-helpers.ts";
import { recordGenerationRun, assignAbBucket } from "../_shared/generation-telemetry.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { size = 10, examProfile } = await req.json();
    const questionCount = Math.min(Math.max(size, 5), 30);

    const sb = getAdmin();

    // Fetch user data for cache key + generation
    const { data: weakErrors } = await sb.from("error_bank")
      .select("tema, subtema, vezes_errado")
      .eq("user_id", userId).eq("dominado", false)
      .order("vezes_errado", { ascending: false }).limit(10);

    const { data: pendingReviews } = await sb.from("revisoes")
      .select("tema, subtema")
      .eq("user_id", userId).eq("status", "pendente").limit(10);

    const { data: scoreRow } = await sb.from("approval_scores")
      .select("score").eq("user_id", userId)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();

    const approvalScore = scoreRow?.score ?? 50;
    const weakTopics = (weakErrors || []).slice(0, 5).map(e => e.subtema || e.tema);
    const reviewTopics = (pendingReviews || []).slice(0, 5).map(r => r.subtema || r.tema);

    // Deterministic cache key (bucketized approval score)
    const approvalBucket = Math.floor(approvalScore / 20) * 20; // 0, 20, 40, 60, 80
    const cacheParams = {
      userId, size: String(questionCount),
      examProfile: examProfile || "",
      weakTopics: weakTopics.sort().join(","),
      reviewTopics: reviewTopics.sort().join(","),
      approvalBucket: String(approvalBucket),
    };
    const cached = await getCache("adaptive_simulado", cacheParams);
    if (cached.hit) {
      logGeneratedContent({ userId, contentType: "adaptive_simulado", theme: "simulado", contentHash: cached.key, sourceEndpoint: "simulado-assistant", cacheHit: true, costUnits: 0 });
      return jsonOk({ ...cached.data, source: "cache" });
    }

    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.adaptive_simulado);
    if (!usage.allowed) {
      const fb = smartFallback("simulado-assistant", "simulado");
      return jsonOk({ questions: [], distribution: { weakTopics: 0, strongTopics: 0, reviewTopics: 0 }, source: "fallback", error: fb.message, suggestedEndpoints: fb.suggestedEndpoints });
    }

    const weakCount = Math.round(questionCount * 0.4);
    const reviewCount = Math.round(questionCount * 0.3);
    const mixedCount = questionCount - weakCount - reviewCount;

    let difficultyHint = "misto (20% fácil, 50% intermediário, 30% difícil)";
    if (approvalScore < 40) difficultyHint = "maioria fácil e intermediário";
    else if (approvalScore > 75) difficultyHint = "maioria intermediário e difícil";

    // ───── Sprint 4: try granular pipeline first (safe, opt-in) ─────
    const t0 = Date.now();
    let pipelineUsed: "granular" | "legacy" = "legacy";
    let fallbackReason: string | null = null;
    let bancaStatus: string | null = null;
    let topicDistribution: unknown = {};

    let system = `Você é um professor de medicina montando um simulado personalizado para prova de residência.
Retorne JSON com "questions": array de objetos com: "question", "options" (5 A-E), "correctAnswer", "explanation", "difficulty", "topic".
Português do Brasil. Estilo de prova real.${examProfile ? ` Banca: ${examProfile}.` : ""}`;

    let prompt = `Monte ${questionCount} questões.
DISTRIBUIÇÃO:
- ${weakCount} TEMAS FRACOS: ${weakTopics.length ? weakTopics.join(", ") : "clínica médica geral"}
- ${reviewCount} REVISÃO: ${reviewTopics.length ? reviewTopics.join(", ") : "temas variados"}
- ${mixedCount} MISTAS
DIFICULDADE: ${difficultyHint}
APPROVAL: ${approvalScore}/100`;

    try {
      const decision = await planGranularOrFallback({
        banca: examProfile,
        totalQuestions: questionCount,
        specialtyHints: weakTopics,
      });
      if (decision.eligible) {
        pipelineUsed = "granular";
        bancaStatus = decision.plan.banca_status;
        topicDistribution = decision.plan.shares;
        // Granular prompt overrides distribution lines, keeps difficulty + approval
        prompt = `Monte ${questionCount} questões seguindo EXATAMENTE a distribuição abaixo (granularidade=topic).
${renderPlanForPrompt(decision.plan)}
DIFICULDADE: ${difficultyHint}
APPROVAL: ${approvalScore}/100
REGRA: cada questão deve declarar no campo "topic" o nome do topic correspondente da distribuição.`;
      } else {
        fallbackReason = decision.reason;
        bancaStatus = (decision as any).banca_status ?? null;
      }
    } catch (e) {
      fallbackReason = `granular_planner_threw:${(e as Error).message}`;
    }

    let raw: string;
    let questions: unknown[] = [];
    let runStatus: "success" | "fallback" | "error" = "success";
    let runError: string | null = null;

    try {
      raw = await callHeavyAI(system, prompt, 8192);
      const parsed = parseAiJsonSafe(raw);
      questions = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];
    } catch (genErr) {
      // If granular generation itself failed, retry once with the legacy prompt
      if (pipelineUsed === "granular") {
        runStatus = "fallback";
        fallbackReason = `granular_generation_failed:${(genErr as Error).message}`;
        pipelineUsed = "legacy";
        prompt = `Monte ${questionCount} questões.
DISTRIBUIÇÃO:
- ${weakCount} TEMAS FRACOS: ${weakTopics.length ? weakTopics.join(", ") : "clínica médica geral"}
- ${reviewCount} REVISÃO: ${reviewTopics.length ? reviewTopics.join(", ") : "temas variados"}
- ${mixedCount} MISTAS
DIFICULDADE: ${difficultyHint}
APPROVAL: ${approvalScore}/100`;
        raw = await callHeavyAI(system, prompt, 8192);
        const parsed = parseAiJsonSafe(raw);
        questions = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];
      } else {
        runStatus = "error";
        runError = (genErr as Error).message;
        throw genErr;
      }
    }

    const result = {
      questions,
      distribution: { weakTopics: weakCount, strongTopics: mixedCount, reviewTopics: reviewCount },
    };

    // Cache with 12h TTL
    await setCache(cached.key, "adaptive_simulado", result, 0.5);

    const hash = await contentHash(JSON.stringify(weakTopics) + questionCount);
    logGeneratedContent({ userId, contentType: "adaptive_simulado", theme: "simulado", contentHash: hash, requestPayload: cacheParams, responsePayload: { questionCount: questions.length }, sourceEndpoint: "simulado-assistant", cacheHit: false, costUnits: ACTION_COSTS.adaptive_simulado });

    // ── Telemetria estruturada (Sprint 5) ──
    const userProfile =
      approvalScore < 40 ? "iniciante" :
      approvalScore < 70 ? "intermediario" : "avancado";
    const generated = Array.isArray(questions) ? questions.length : 0;
    const batchErrorRate = questionCount > 0
      ? Math.max(0, 1 - generated / questionCount)
      : 0;

    recordGenerationRun({
      user_id: userId,
      endpoint: "simulado-assistant",
      pipeline_used: pipelineUsed,
      banca: examProfile ?? null,
      banca_status: bancaStatus,
      requested_specialties: weakTopics,
      requested_count: questionCount,
      generated_count: generated,
      topic_distribution: topicDistribution,
      fallback_triggered: pipelineUsed === "legacy" && Boolean(fallbackReason),
      fallback_reason: fallbackReason,
      duration_ms: Date.now() - t0,
      status: runStatus,
      error_message: runError,
      user_profile: userProfile,
      generation_mode: "simulado_adaptive",
      batch_count: 1,
      batch_error_rate: Number(batchErrorRate.toFixed(4)),
      ab_bucket: assignAbBucket(userId),
    });

    return jsonOk({ ...result, source: "ai", pipeline: pipelineUsed });
  } catch (e) {
    recordGenerationRun({
      endpoint: "simulado-assistant",
      pipeline_used: "legacy",
      status: "error",
      error_message: (e as Error).message,
      generation_mode: "simulado_adaptive",
      batch_count: 1,
      batch_error_rate: 1,
    });
    return handleAiError(e, "simulado-assistant");
  }
});
