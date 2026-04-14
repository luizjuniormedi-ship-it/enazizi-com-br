import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, fallbackMessage,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { theme, subtopic } = await req.json();
    if (!theme) return jsonError("theme é obrigatório");

    const cacheParams = { theme, subtopic: subtopic || "" };
    const cached = await getCache("deep_explanation", cacheParams);
    if (cached.hit) return jsonOk({ ...cached.data, source: "cache" });

    // Usage check (cost = 4)
    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.deep_explanation);
    if (!usage.allowed) {
      return jsonOk({
        explanation: fallbackMessage(theme),
        clinicalReasoning: "", pitfalls: [], summary: "",
        source: "fallback",
        suggestion: "Use explain-simple (custo 1) para uma explicação básica.",
      });
    }

    const system = `Você é um professor de medicina especialista, preparando um aluno para prova de residência.
Retorne JSON com:
- "explanation": explicação aprofundada do tema (máx 400 palavras), com fisiopatologia, epidemiologia e manejo
- "clinicalReasoning": raciocínio clínico passo a passo para abordagem diagnóstica (máx 200 palavras)
- "pitfalls": array de 3-5 pegadinhas comuns de prova sobre este tema
- "summary": resumo em 2-3 frases para revisão rápida
Português do Brasil. Foco em prova.`;

    const prompt = `Tema: ${theme}${subtopic ? `\nSubtema: ${subtopic}` : ""}`;

    const raw = await callHeavyAI(system, prompt, 4096);
    const result = parseAiJsonSafe(raw);

    // Validate
    if (!result.explanation) throw new Error("Missing explanation field");
    if (!Array.isArray(result.pitfalls)) result.pitfalls = [];

    await setCache(cached.key, "deep_explanation", result, 30);
    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("explain-deep error:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar explicação aprofundada", 500);
  }
});
