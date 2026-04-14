import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, smartFallback, handleAiError,
  contentHash, wasRecentlyGenerated, logGeneratedContent,
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
    if (cached.hit) {
      logGeneratedContent({ userId, contentType: "deep_explanation", theme, subtopic, contentHash: cached.key, sourceEndpoint: "explain-deep", cacheHit: true, costUnits: 0 });
      return jsonOk({ ...cached.data, source: "cache" });
    }

    // Anti-repetition: skip if same theme explained recently
    const themeHash = await contentHash(`deep::${theme}::${subtopic || ""}`);
    if (await wasRecentlyGenerated(userId, themeHash, 72)) {
      // Return from a broader cache search or tell user
      return jsonOk({
        explanation: `Você já solicitou explicação profunda de "${theme}" recentemente. Revise suas anotações anteriores ou tente "explain-simple" para uma revisão rápida.`,
        clinicalReasoning: "", pitfalls: [], summary: "",
        source: "anti_repeat", suggestedEndpoints: ["explain-simple"],
      });
    }

    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.deep_explanation);
    if (!usage.allowed) {
      const fb = smartFallback("explain-deep", theme);
      return jsonOk({ explanation: fb.message, clinicalReasoning: "", pitfalls: [], summary: "", source: "fallback", suggestedEndpoints: fb.suggestedEndpoints });
    }

    const system = `Você é um professor de medicina especialista preparando aluno para residência.
Retorne JSON com:
- "explanation": explicação aprofundada (máx 400 palavras)
- "clinicalReasoning": raciocínio clínico passo a passo (máx 200 palavras)
- "pitfalls": array de 3-5 pegadinhas de prova
- "summary": resumo em 2-3 frases
Português do Brasil.`;

    const prompt = `Tema: ${theme}${subtopic ? `\nSubtema: ${subtopic}` : ""}`;
    const raw = await callHeavyAI(system, prompt, 4096);
    const result = parseAiJsonSafe(raw);

    if (!result.explanation) throw new Error("Missing explanation");
    if (!Array.isArray(result.pitfalls)) result.pitfalls = [];

    await setCache(cached.key, "deep_explanation", result, 30);
    logGeneratedContent({ userId, contentType: "deep_explanation", theme, subtopic, contentHash: themeHash, requestPayload: cacheParams, responsePayload: result, sourceEndpoint: "explain-deep", cacheHit: false, costUnits: ACTION_COSTS.deep_explanation });

    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    return handleAiError(e, "explain-deep");
  }
});
