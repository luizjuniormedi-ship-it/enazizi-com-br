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

    const { theme, subtopic } = await req.json();
    if (!theme) return jsonError("theme é obrigatório");

    const cacheParams = { theme, subtopic: subtopic || "" };
    const cached = await getCache("summarize_topic", cacheParams);
    if (cached.hit) {
      return jsonOk({ ...cached.data, source: "cache" });
    }

    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return jsonOk({
        summary: fallbackMessage(theme),
        keyPoints: [],
        source: "fallback",
      });
    }

    const system = `Você é um professor de medicina preparando revisão rápida para prova. Responda em JSON com: "summary" (resumo objetivo, máx 150 palavras), "keyPoints" (array de 4-6 pontos-chave curtos). APENAS português do Brasil.`;
    const prompt = `Tema: ${theme}${subtopic ? `\nSubtema: ${subtopic}` : ""}`;

    const raw = await callLightAI(system, prompt);

    let result: { summary: string; keyPoints: string[] };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: raw, keyPoints: [] };
      if (!Array.isArray(result.keyPoints)) result.keyPoints = [];
    } catch {
      result = { summary: raw, keyPoints: [] };
    }

    await setCache(cached.key, "summarize_topic", result);
    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("summarize-topic error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar resumo", 500);
  }
});
