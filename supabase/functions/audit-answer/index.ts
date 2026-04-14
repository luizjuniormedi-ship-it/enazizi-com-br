import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, smartFallback, handleAiError,
  contentHash, logGeneratedContent,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { question, userAnswer } = await req.json();
    if (!question || !userAnswer) return jsonError("question e userAnswer são obrigatórios");

    const cacheParams = { question: question.slice(0, 200), userAnswer: userAnswer.slice(0, 500) };
    const cached = await getCache("answer_audit", cacheParams);
    if (cached.hit) {
      logGeneratedContent({ userId, contentType: "answer_audit", theme: "discursiva", contentHash: cached.key, sourceEndpoint: "audit-answer", cacheHit: true, costUnits: 0 });
      return jsonOk({ ...cached.data, source: "cache" });
    }

    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.answer_audit);
    if (!usage.allowed) {
      const fb = smartFallback("audit-answer", "resposta discursiva");
      return jsonOk({ score: 0, feedback: fb.message, missingPoints: [], source: "fallback", suggestedEndpoints: fb.suggestedEndpoints });
    }

    const system = `Você é um avaliador de provas discursivas de residência médica.
Retorne JSON com:
- "score": nota 0 a 10
- "feedback": avaliação detalhada (máx 200 palavras)
- "missingPoints": array de pontos-chave faltantes
Justo e objetivo. Português do Brasil.`;

    const prompt = `QUESTÃO:\n${question}\n\nRESPOSTA DO ALUNO:\n${userAnswer}`;
    const raw = await callHeavyAI(system, prompt, 2048);
    const result = parseAiJsonSafe(raw);

    if (typeof result.score !== "number") result.score = 0;
    if (!Array.isArray(result.missingPoints)) result.missingPoints = [];

    await setCache(cached.key, "answer_audit", result, 7);

    const hash = await contentHash(question.slice(0, 200) + userAnswer.slice(0, 200));
    logGeneratedContent({ userId, contentType: "answer_audit", theme: "discursiva", contentHash: hash, requestPayload: cacheParams, responsePayload: result, sourceEndpoint: "audit-answer", cacheHit: false, costUnits: ACTION_COSTS.answer_audit });

    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    return handleAiError(e, "audit-answer");
  }
});
