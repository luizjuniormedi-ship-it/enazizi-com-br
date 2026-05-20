import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — HOTFIX QUESTION-GENERATOR 500 UNDEFINED.ID
 * Core logic for generating questions with high resilience.
 */

Deno.serve(enterpriseEdgeHandler("question-generator", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId } = correlation;
  let step = "start";

  // Helper for standardized error responses
  const jsonError = (code: string, status: number, details: Record<string, any> = {}) => {
    logger.error(`STEP_FAIL_${step}`, code, { ...details, correlation_id: correlationId, request_id: requestId });
    return new Response(JSON.stringify({
      success: false,
      error: code,
      correlation_id: correlationId,
      request_id: requestId,
      step,
      ...details
    }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  };

  try {
    // 1. Validate Input
    step = "parse_body";
    const body = await req.json().catch(() => null);
    if (!body) {
      return jsonError("EMPTY_BODY", 400);
    }

    const { 
      difficulty = "misto", 
      count = 5,
      generationContext = {},
      targetExam,
      topicWeights,
      mode = "study"
    } = body;

    const requestedCount = Math.min(Number(count) || 5, 15);
    const specialty = body.specialty || generationContext?.specialty || "Clínica Médica";
    const topics = body.topics || (generationContext?.topic ? [generationContext.topic] : [specialty]);
    const examBoard = targetExam || body.examBoard;

    // 2. Auth Validation
    step = "auth_validation";
    const authResult = await requireAuth(req);
    if (!authResult || !authResult.ok) {
      return authResult?.response || jsonError("AUTH_FAILED", 401);
    }
    const userId = authResult.userId;

    if (!userId) {
      return jsonError("AUTH_USER_NOT_FOUND", 401);
    }

    logger.info("QUESTION_GEN_START", `Generating ${requestedCount} questions`, { 
      userId, 
      topics, 
      examBoard, 
      correlationId 
    });

    // 3. Exam Profile Resolution
    step = "load_profile";
    const bancaResolution = resolveBanca(examBoard || "default");
    if (!bancaResolution) {
      throw new Error("Banca resolution failed unexpectedly");
    }
    const safeExamProfile = bancaResolution.profile || {
      key: "default-enare",
      label: "ENARE",
      difficulty: 3,
      style: "residencia_medica",
      specialtyWeights: {}
    };

    // 4. Try Bank Questions first if preferred
    step = "load_bank_questions";
    if (body.preferBank) {
      const { data: bankQs, error: bankError } = await supabaseAdmin
        .from("questions_bank")
        .select("*")
        .eq("topic", specialty)
        .limit(requestedCount);
      
      if (!bankError && bankQs && bankQs.length >= requestedCount) {
        logger.info("QUESTION_GEN_BANK_HIT", `Found ${bankQs.length} questions in bank`);
        return new Response(JSON.stringify({ 
          success: true, 
          questions: bankQs,
          correlation_id: correlationId,
          request_id: requestId,
          mode: "bank"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      logger.info("QUESTION_GEN_BANK_MISS", "Switching to AI generation", { bankError: bankError?.message });
    }

    // 5. AI Generation
    step = "generate_ai_questions";
    let systemPrompt = QUESTION_MOTOR_PREMIUM;
    systemPrompt += buildBancaBlock(safeExamProfile);

    const model = normalizeModel(
      body?.model || 
      Deno.env.get("AI_MODEL") || 
      Deno.env.get("GEMINI_MODEL") || 
      AI_MODELS.FAST
    );
    const cognitiveState = body?.cognitiveState || (body?.userProfile?.cognitive_state as any);

    logger.info("FINAL_AI_MODEL_BEFORE_GATEWAY", `Resolved model: ${model}`, {
      correlation_id: correlationId,
      request_id: requestId,
      resolvedModel: model,
      originalModel: body?.model,
      envModel: Deno.env.get("AI_MODEL"),
      geminiModel: Deno.env.get("GEMINI_MODEL")
    });

    const userPrompt = `Gere exatamente ${requestedCount} questões médicas de múltipla escolha.
    TEMA: ${topics.join(", ")}
    ESPECIALIDADE: ${specialty}
    DIFICULDADE: ${difficulty}
    ${examBoard ? `ESTILO DA BANCA: ${examBoard}` : ""}
    
    REGRAS:
    1. Caso clínico denso (400+ caracteres).
    2. 5 alternativas (A-E).
    3. Explicação detalhada.
    4. Retorne APENAS um JSON array.`;

    const aiResponse = await ai({
      model,
      taskType: "simulados", 
      cognitiveState: cognitiveState,
      complexity: body.difficulty === "difícil" ? "alta" : (body.difficulty === "médio" ? "média" : "baixa"),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId
    });

    const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
    let questions = parseAiJson(rawContent);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Falha ao gerar questões válidas via IA.");
    }

    // 6. Persistence & Formatting
    step = "persist_questions";
    const formattedQuestions = questions.map((q: any) => ({
      statement: cleanQuestionText(q?.statement || q?.content || ""),
      options: Array.isArray(q?.options) ? q.options : [q?.option_a, q?.option_b, q?.option_c, q?.option_d, q?.option_e].filter(Boolean),
      correct: typeof q?.correct === 'number' ? q.correct : (typeof q?.correct_index === 'number' ? q.correct_index : 0),
      explanation: cleanQuestionText(q?.explanation || q?.rationale || ""),
      topic: q?.topic || specialty,
      difficulty: q?.difficulty || difficulty,
      metadata: { 
        generation_engine: "ENAZIZI Question Motor v3.2",
        generated_at: new Date().toISOString(),
        correlation_id: correlationId
      }
    }));

    if (body.saveToBank) {
      const { error: insertError } = await supabaseAdmin.from("questions_bank").insert(
        formattedQuestions.map((q: any) => ({
          user_id: userId,
          statement: q.statement,
          options: q.options,
          correct_index: q.correct,
          explanation: q.explanation,
          topic: q.topic,
          difficulty: q.difficulty,
          is_global: true,
          review_status: 'pending'
        }))
      );
      if (insertError) {
        logger.warn("BANK_INSERT_FAILED", insertError.message);
      }
    }

    step = "return_response";
    return new Response(JSON.stringify({ 
      success: true, 
      questions: formattedQuestions,
      correlation_id: correlationId,
      request_id: requestId,
      mode: "ai"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    logger.critical("QUESTION_GENERATOR_FAILED", error?.message, {
      correlation_id: correlationId,
      request_id: requestId,
      step,
      stack: error?.stack
    });

    // Alert Governance
    try {
      await supabaseAdmin.from("ai_incidents").insert({
        function_name: "question-generator",
        severity: "critical",
        incident_type: "runtime_error",
        message: error?.message || "Unknown error",
        stack_trace: error?.stack,
        correlation_id: correlationId,
        metadata: { step, request_id: requestId }
      });
    } catch (alertErr) {
      console.error("Failed to log alert to ai_incidents", alertErr);
    }

    return jsonError("QUESTION_GENERATOR_RUNTIME_ERROR", 500, {
      message: error?.message || "Erro interno no gerador de questões"
    });
  }
}));