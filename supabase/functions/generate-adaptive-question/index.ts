import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getAdmin, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, smartFallback, handleAiError,
  contentHash, wasRecentlyGenerated, logGeneratedContent,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { theme, subtopic, difficulty, context } = await req.json();
    if (!theme) return jsonError("theme é obrigatório");

    const diff = difficulty || "medium";
    const cacheParams = {
      theme, subtopic: subtopic || "", difficulty: diff,
      examProfile: context?.examProfile || "",
      fromError: String(context?.fromError || false),
    };
    const cached = await getCache("adaptive_question", cacheParams);
    if (cached.hit) {
      logGeneratedContent({ userId, contentType: "adaptive_question", theme, subtopic, contentHash: cached.key, sourceEndpoint: "generate-adaptive-question", cacheHit: true, costUnits: 0 });
      return jsonOk({ ...cached.data, source: "cache" });
    }

    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.adaptive_question);
    if (!usage.allowed) {
      const fb = smartFallback("generate-adaptive-question", theme);
      return jsonOk({ question: fb.message, options: [], correctAnswer: "", explanation: "", difficulty: diff, source: "fallback", suggestedEndpoints: fb.suggestedEndpoints });
    }

    // User context
    const sb = getAdmin();
    let errorContext = "";
    let approvalContext = "";

    const { data: errors } = await sb.from("error_bank")
      .select("tema, subtema, categoria_erro, motivo_erro, vezes_errado")
      .eq("user_id", userId).ilike("tema", `%${theme}%`).eq("dominado", false)
      .order("vezes_errado", { ascending: false }).limit(3);

    if (errors?.length) {
      errorContext = `\nERROS FREQUENTES DO ALUNO:\n${errors.map(e => `- ${e.subtema || e.tema}: ${e.motivo_erro || e.categoria_erro} (${e.vezes_errado}x)`).join("\n")}`;
    }

    const { data: score } = await sb.from("approval_scores")
      .select("score, phase").eq("user_id", userId)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();

    if (score) approvalContext = `\nAPPROVAL SCORE: ${score.score}/100 (fase: ${score.phase || "geral"})`;

    const diffMap: Record<string, string> = {
      easy: "fácil (conceitos básicos)", medium: "intermediária (aplicação clínica)", hard: "difícil (pegadinhas, exceções)",
    };

    const system = `Você é um professor de medicina criando questões para prova de residência médica.
Responda APENAS em JSON com: "question" (enunciado clínico com caso, mín 200 caracteres), "options" (array de 4 alternativas A-D), "correctAnswer" (letra correta), "explanation" (explicação detalhada, mín 150 caracteres), "difficulty" (easy/medium/hard).
Português do Brasil. Estilo de prova real.${context?.examProfile ? ` Banca: ${context.examProfile}` : ""}`;

    const prompt = `Tema: ${theme}${subtopic ? `\nSubtema: ${subtopic}` : ""}\nDificuldade: ${diffMap[diff] || diffMap.medium}${errorContext}${approvalContext}${context?.fromError ? "\nFOCO: explorar exatamente os pontos onde o aluno erra." : ""}`;

    const raw = await callHeavyAI(system, prompt, 2048);
    const result = parseAiJsonSafe(raw);

    if (!result.question || !Array.isArray(result.options) || result.options.length < 4) {
      throw new Error("AI response missing required fields");
    }
    result.difficulty = diff;

    // Anti-repetition check
    const hash = await contentHash(result.question);
    if (await wasRecentlyGenerated(userId, hash, 48)) {
      // Add instruction to vary and retry once
      const raw2 = await callHeavyAI(system, prompt + "\nIMPORTANTE: gere uma questão DIFERENTE da anterior, com outro caso clínico e outro ângulo diagnóstico.", 2048);
      const result2 = parseAiJsonSafe(raw2);
      if (result2.question && Array.isArray(result2.options)) {
        Object.assign(result, result2);
      }
    }

    const finalHash = await contentHash(result.question);
    await setCache(cached.key, "adaptive_question", result, 14);
    logGeneratedContent({ userId, contentType: "adaptive_question", theme, subtopic, contentHash: finalHash, requestPayload: cacheParams, responsePayload: result, sourceEndpoint: "generate-adaptive-question", cacheHit: false, costUnits: ACTION_COSTS.adaptive_question });

    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    return handleAiError(e, "generate-adaptive-question");
  }
});
