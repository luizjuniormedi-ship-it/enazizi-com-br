import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  extractUserId,
  getCache,
  setCache,
  checkAndIncrementUsage,
  callLightAI,
  jsonOk,
  jsonError,
  fallbackMessage,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { theme, errorType, userAnswer, questionId } = await req.json();
    if (!theme) return jsonError("theme é obrigatório");

    const cacheParams = { theme, errorType: errorType || "", userAnswer: userAnswer || "" };
    const cached = await getCache("reinforce_error", cacheParams);
    if (cached.hit) {
      return jsonOk({ ...cached.data, source: "cache" });
    }

    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return jsonOk({
        explanation: fallbackMessage(theme),
        correction: "Revise o conteúdo teórico antes de tentar novamente.",
        tip: "Releia o tema no seu material de estudo.",
        source: "fallback",
      });
    }

    const system = `Você é um professor de medicina corrigindo um erro de aluno. Responda em JSON com os campos: "explanation" (por que errou, máx 100 palavras), "correction" (raciocínio correto, máx 80 palavras), "tip" (dica prática curta). Responda APENAS em português do Brasil.`;
    const prompt = `Tema: ${theme}${errorType ? `\nTipo de erro: ${errorType}` : ""}${userAnswer ? `\nResposta do aluno: ${userAnswer}` : ""}`;

    const raw = await callLightAI(system, prompt);

    let result: { explanation: string; correction: string; tip: string };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { explanation: raw, correction: "", tip: "" };
    } catch {
      result = { explanation: raw, correction: "", tip: "" };
    }

    await setCache(cached.key, "reinforce_error", result);
    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("reinforce-error error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar reforço", 500);
  }
});
