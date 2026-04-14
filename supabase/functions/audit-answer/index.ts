import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { question, userAnswer } = await req.json();
    if (!question || !userAnswer) return jsonError("question e userAnswer são obrigatórios");

    // Cache based on question + answer hash (same answer = same audit)
    const cacheParams = { question: question.slice(0, 200), userAnswer: userAnswer.slice(0, 500) };
    const cached = await getCache("answer_audit", cacheParams);
    if (cached.hit) return jsonOk({ ...cached.data, source: "cache" });

    // Usage check (cost = 6)
    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.answer_audit);
    if (!usage.allowed) {
      return jsonOk({
        score: 0, feedback: "Limite de uso atingido. Tente novamente no próximo período.",
        missingPoints: [], source: "fallback",
      });
    }

    const system = `Você é um avaliador de provas discursivas de residência médica.
Avalie a resposta do aluno e retorne JSON com:
- "score": nota de 0 a 10
- "feedback": avaliação detalhada (máx 200 palavras), indicando acertos e erros
- "missingPoints": array de pontos-chave que faltaram na resposta
Seja justo e objetivo. Português do Brasil.`;

    const prompt = `QUESTÃO:\n${question}\n\nRESPOSTA DO ALUNO:\n${userAnswer}`;

    const raw = await callHeavyAI(system, prompt, 2048);
    const result = parseAiJsonSafe(raw);

    if (typeof result.score !== "number") result.score = 0;
    if (!Array.isArray(result.missingPoints)) result.missingPoints = [];

    await setCache(cached.key, "answer_audit", result, 7); // 7 day TTL
    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("audit-answer error:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao auditar resposta", 500);
  }
});
