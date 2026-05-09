import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { buildCacheKey, getCachedContent, setCachedContent, logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Loop 3E: getClaims + getUser fallback antes de qualquer chamada IA.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { totalQuestions, correctAnswers, areaBreakdown, studyHoursPerWeek, daysUntilExam, diagnosticScore, streakDays, flashcardsReviewed, simuladoScores } = await req.json();

    const MODEL = "openai/gpt-5-mini";
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const cacheKey = buildCacheKey({ extra: `perf-pred-q${totalQuestions}-a${accuracy}-h${studyHoursPerWeek}-d${daysUntilExam}` });

    // Try cache (predictions with same inputs are stable)
    try {
      const cached = await getCachedContent(cacheKey, "performance-prediction");
      if (cached) {
        logAiUsage({ userId: "system", functionName: "performance-predictor", modelUsed: MODEL, success: true, responseTimeMs: 0, cacheHit: true, modelTier: "standard" }).catch(() => {});
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* proceed */ }

    const systemPrompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês.

Você é o Performance Predictor Agent, especializado em prever o desempenho de candidatos a Residência Médica.

DADOS DO CANDIDATO:
- Questões respondidas: ${totalQuestions || 0}
- Acertos: ${correctAnswers || 0} (${accuracy}%)
- Desempenho por área: ${JSON.stringify(areaBreakdown || {})}
- Horas de estudo/semana: ${studyHoursPerWeek || 0}
- Dias até a prova: ${daysUntilExam || "Não definido"}
- Score diagnóstico: ${diagnosticScore || "Não realizado"}
- Streak de estudos: ${streakDays || 0} dias
- Flashcards revisados: ${flashcardsReviewed || 0}
- Scores de simulados: ${JSON.stringify(simuladoScores || [])}

CALCULE e retorne um JSON com:
{
  "approval_probability": 0.0 a 1.0,
  "estimated_score": 0 a 100,
  "estimated_ranking_percentile": 0 a 100,
  "trend": "improving|stable|declining",
  "strongest_areas": ["área1", "área2"],
  "weakest_areas": ["área1", "área2"],
  "risk_factors": ["fator1", "fator2"],
  "recommendations": ["recomendação1", "recomendação2"],
  "confidence_level": "low|medium|high",
  "message": "mensagem personalizada sobre o desempenho"
}

Regras:
- Seja realista e baseado em dados
- Considere que a média de aprovação no ENARE é ~65-70%
- Se poucos dados, confidence_level = "low"
- Considere consistência (streak, simulados regulares)
- Sempre em português brasileiro
- RETORNE APENAS O JSON`;

    const startMs = Date.now();
    const response = await aiFetch({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Calcule minha previsão de desempenho para a prova de residência." },
      ],
    });
    const elapsed = Date.now() - startMs;

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      logAiUsage({ userId: "system", functionName: "performance-predictor", modelUsed: MODEL, success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "standard", errorMessage: `status ${response.status}` }).catch(() => {});
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = sanitizeAiContent(data.choices?.[0]?.message?.content || "");
    
    let prediction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Failed to parse prediction" };
    } catch {
      prediction = { raw: content };
    }

    // Log + cache
    logAiUsage({ userId: "system", functionName: "performance-predictor", modelUsed: MODEL, success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "standard" }).catch(() => {});
    setCachedContent(cacheKey, "performance-prediction", prediction, MODEL, 7).catch(() => {});

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("performance-predictor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
