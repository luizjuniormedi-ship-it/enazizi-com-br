import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { buildCacheKey, getCachedContent, setCachedContent, logAiUsage } from "../_shared/ai-cache.ts";
import { extractUserId } from "../_shared/ai-phase2-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await extractUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { topic, specialty } = await req.json();
    if (!topic) throw new Error("topic is required");

    // Normalize topic for better cache hit rate
    const normalizedTopic = topic.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedSpecialty = (specialty || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const cacheKey = buildCacheKey({ topic: normalizedTopic, specialty: normalizedSpecialty, extra: "micro-quiz" });
    const MODEL = "openai/gpt-5-mini";

    // 1. Try cache first
    try {
      const cached = await getCachedContent(cacheKey, "micro-quiz");
      if (cached) {
        logAiUsage({
          userId,
          functionName: "micro-quiz",
          modelUsed: MODEL,
          success: true,
          responseTimeMs: 0,
          cacheHit: true,
          modelTier: "lite",
        }).catch(() => {});
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* cache miss — proceed to AI */ }

    const startMs = Date.now();
    const response = await aiFetch({
      model: MODEL,
      maxTokens: 1500,
      timeoutMs: 12000,
      maxRetries: 1,
      messages: [
        {
          role: "system",
          content: `Você é um gerador de micro-quiz médico. Retorne APENAS JSON válido, sem markdown.`,
        },
        {
          role: "user",
          content: `Gere 2 questões objetivas curtas sobre "${topic}"${specialty ? ` (${specialty})` : ""} para revisão rápida.

Formato JSON exato:
{"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}

Regras:
- Enunciado direto, máx 2 frases, em pt-BR
- 4 alternativas curtas
- correctIndex = índice da correta (0-3)
- explanation = 1 frase explicando`,
        },
      ],
    });
    const elapsed = Date.now() - startMs;

    if (!response.ok) {
      const err = await response.text();
      console.error("AI error:", response.status, err.slice(0, 200));
      logAiUsage({ userId, functionName: "micro-quiz", modelUsed: MODEL, success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "lite", errorMessage: `status ${response.status}` }).catch(() => {});
      throw new Error("AI_ERROR");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (!content || content.trim().length < 10) {
      console.error("micro-quiz: empty or too short AI content:", content?.slice(0, 100));
      logAiUsage({ userId, functionName: "micro-quiz", modelUsed: MODEL, success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "lite", errorMessage: "empty_content" }).catch(() => {});
      return new Response(JSON.stringify({ questions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = parseAiJson(content);

    // Log success + save to cache
    logAiUsage({ userId, functionName: "micro-quiz", modelUsed: MODEL, success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "lite" }).catch(() => {});
    setCachedContent(cacheKey, "micro-quiz", parsed, MODEL, 14).catch(() => {});

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("micro-quiz error:", e);
    return new Response(JSON.stringify({ questions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
