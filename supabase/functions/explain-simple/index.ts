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

    const { theme, subtopic, context } = await req.json();
    if (!theme) return jsonError("theme é obrigatório");

    const cacheParams = { theme, subtopic: subtopic || "", level: context?.userLevel || "basico" };
    const cached = await getCache("explain_simple", cacheParams);
    if (cached.hit) {
      return jsonOk({ explanation: cached.data.explanation, source: "cache" });
    }

    // Usage check
    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return jsonOk({ explanation: fallbackMessage(theme), source: "fallback" });
    }

    // AI call
    const system = "Você é um professor de medicina objetivo. Explique de forma clara e didática para um estudante, com foco em provas de residência. Use no máximo 150 palavras. Responda APENAS em português do Brasil.";
    const prompt = `Tema: ${theme}${subtopic ? `\nSubtema: ${subtopic}` : ""}${context?.fromError ? "\nO aluno errou uma questão sobre este tema, foque nos pontos mais confusos." : ""}`;

    const explanation = await callLightAI(system, prompt);

    const result = { explanation };
    await setCache(cached.key, "explain_simple", result);

    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("explain-simple error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar explicação", 500);
  }
});
