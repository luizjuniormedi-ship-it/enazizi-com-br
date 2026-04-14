import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getAdmin, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, smartFallback, handleAiError,
  logGeneratedContent, contentHash,
} from "../_shared/ai-phase2-helpers.ts";

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

    const system = `Você é um professor de medicina montando um simulado personalizado para prova de residência.
Retorne JSON com "questions": array de objetos com: "question", "options" (5 A-E), "correctAnswer", "explanation", "difficulty", "topic".
Português do Brasil. Estilo de prova real.${examProfile ? ` Banca: ${examProfile}.` : ""}`;

    const prompt = `Monte ${questionCount} questões.
DISTRIBUIÇÃO:
- ${weakCount} TEMAS FRACOS: ${weakTopics.length ? weakTopics.join(", ") : "clínica médica geral"}
- ${reviewCount} REVISÃO: ${reviewTopics.length ? reviewTopics.join(", ") : "temas variados"}
- ${mixedCount} MISTAS
DIFICULDADE: ${difficultyHint}
APPROVAL: ${approvalScore}/100`;

    const raw = await callHeavyAI(system, prompt, 8192);
    const parsed = parseAiJsonSafe(raw);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];

    const result = { questions, distribution: { weakTopics: weakCount, strongTopics: mixedCount, reviewTopics: reviewCount } };

    // Cache with 12h TTL (0.5 days)
    await setCache(cached.key, "adaptive_simulado", result, 0.5);

    const hash = await contentHash(JSON.stringify(weakTopics) + questionCount);
    logGeneratedContent({ userId, contentType: "adaptive_simulado", theme: "simulado", contentHash: hash, requestPayload: cacheParams, responsePayload: { questionCount: questions.length }, sourceEndpoint: "simulado-assistant", cacheHit: false, costUnits: ACTION_COSTS.adaptive_simulado });

    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    return handleAiError(e, "simulado-assistant");
  }
});
