import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getAdmin, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError, fallbackMessage,
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
      theme,
      subtopic: subtopic || "",
      difficulty: diff,
      examProfile: context?.examProfile || "",
      fromError: String(context?.fromError || false),
    };
    const cached = await getCache("adaptive_question", cacheParams);
    if (cached.hit) return jsonOk({ ...cached.data, source: "cache" });

    // Usage check (cost = 5)
    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.adaptive_question);
    if (!usage.allowed) {
      return jsonOk({
        question: fallbackMessage(theme),
        options: [], correctAnswer: "", explanation: "",
        difficulty: diff, source: "fallback",
        suggestion: "Use explain-simple ou reinforce-error para custo menor.",
      });
    }

    // Fetch user context for adaptive generation
    const sb = getAdmin();
    let errorContext = "";
    let approvalContext = "";

    // Error bank
    const { data: errors } = await sb
      .from("error_bank")
      .select("tema, subtema, categoria_erro, motivo_erro, vezes_errado")
      .eq("user_id", userId)
      .ilike("tema", `%${theme}%`)
      .eq("dominado", false)
      .order("vezes_errado", { ascending: false })
      .limit(3);

    if (errors?.length) {
      errorContext = `\nERROS FREQUENTES DO ALUNO:\n${errors.map(
        (e) => `- ${e.subtema || e.tema}: ${e.motivo_erro || e.categoria_erro} (${e.vezes_errado}x)`
      ).join("\n")}`;
    }

    // Approval score
    const { data: score } = await sb
      .from("approval_scores")
      .select("score, phase")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (score) {
      approvalContext = `\nAPPROVAL SCORE: ${score.score}/100 (fase: ${score.phase || "geral"})`;
    }

    const difficultyMap: Record<string, string> = {
      easy: "fácil (conceitos básicos, reconhecimento)",
      medium: "intermediária (aplicação clínica, diagnóstico diferencial)",
      hard: "difícil (pegadinhas, exceções, casos atípicos)",
    };

    const system = `Você é um professor de medicina criando questões para prova de residência médica.
Responda APENAS em JSON com: "question" (enunciado clínico com caso, mín 200 caracteres), "options" (array de 5 alternativas A-E), "correctAnswer" (letra correta), "explanation" (explicação detalhada, mín 150 caracteres), "difficulty" (easy/medium/hard).
Use português do Brasil. Estilo de prova real.${context?.examProfile ? `\nEstilo de banca: ${context.examProfile}` : ""}`;

    const prompt = `Tema: ${theme}${subtopic ? `\nSubtema: ${subtopic}` : ""}
Dificuldade: ${difficultyMap[diff] || difficultyMap.medium}${errorContext}${approvalContext}
${context?.fromError ? "\nFOCO: gerar questão que explore exatamente os pontos onde o aluno erra." : ""}`;

    const raw = await callHeavyAI(system, prompt, 2048);
    const result = parseAiJsonSafe(raw);

    // Validate minimum structure
    if (!result.question || !Array.isArray(result.options) || result.options.length < 4) {
      throw new Error("AI response missing required fields");
    }
    result.difficulty = diff;

    await setCache(cached.key, "adaptive_question", result, 14); // 14 day TTL
    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("generate-adaptive-question error:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar questão adaptativa", 500);
  }
});
