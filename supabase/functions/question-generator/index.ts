import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — HOTFIX QUESTION-GENERATOR v3.5
 * Core logic for generating and SAVING questions with high resilience.
 */

Deno.serve(enterpriseEdgeHandler("question-generator", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
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
      mode = "study",
      saveToBank = true,
      createSession = true
    } = body;

    const requestedCount = Math.min(Number(count) || 5, 20);
    const specialty = body.specialty || generationContext?.specialty || "Clínica Médica";
    const topics = Array.isArray(body.topics) ? body.topics : (generationContext?.topic ? [generationContext.topic] : [specialty]);
    const examBoard = targetExam || body.examBoard;

    // 2. Auth Validation
    step = "auth_validation";
    const authResult = await requireAuth(req);
    if (!authResult || !authResult.ok) {
      return authResult?.response || jsonError("AUTH_FAILED", 401);
    }
    const userId = authResult.userId;

    logger.info("QUESTION_GEN_START", `Generating ${requestedCount} questions`, { 
      userId, 
      topics, 
      examBoard, 
      correlationId 
    });

    // 3. Exam Profile Resolution
    step = "load_profile";
    const bancaResolution = resolveBanca(examBoard || "default");
    const safeExamProfile = bancaResolution?.profile || {
      key: "default-enare",
      label: "ENARE",
      difficulty: 3,
      style: "residencia_medica",
      specialtyWeights: {}
    };

    // 4. Try Bank Questions first
    step = "load_bank_questions";
    let questions = [];
    let source = "bank";

    const { data: bankQs, error: bankError } = await supabaseAdmin
      .from("questions_bank")
      .select("*")
      .in("topic", topics)
      .limit(requestedCount);
    
    if (!bankError && bankQs && bankQs.length > 0) {
      questions = bankQs.map((q: any) => ({
        id: q.id,
        statement: q.statement,
        options: q.options,
        correct: q.correct_index,
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        _source: "bank"
      }));
      logger.info("QUESTION_GEN_BANK_HIT", `Found ${questions.length} questions in bank`);
    }

    // 5. AI Fallback if needed
    if (questions.length < requestedCount) {
      step = "generate_ai_questions";
      source = questions.length === 0 ? "ai" : "mixed";
      const deficit = requestedCount - questions.length;
      
      let systemPrompt = QUESTION_MOTOR_PREMIUM;
      systemPrompt += buildBancaBlock(safeExamProfile);

      const model = normalizeModel(body?.model || AI_MODELS.FAST);
      const cognitiveState = body?.cognitiveState || (body?.userProfile?.cognitive_state as any);

      const userPrompt = `Gere exatamente ${deficit} questões médicas de múltipla escolha.
      TEMA: ${topics.join(", ")}
      ESPECIALIDADE: ${specialty}
      DIFICULDADE: ${difficulty}
      BANCA: ${examBoard || "Geral"}
      
      REGRAS:
      1. Caso clínico denso.
      2. Exatamente 4 alternativas (A-D).
      3. Explicação técnica.
      4. Retorne APENAS um JSON array.`;

      const aiResponse = await ai({
        model,
        taskType: "simulados", 
        cognitiveState: cognitiveState,
        complexity: "alta",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        userId
      });

      const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
      let aiQuestions = parseAiJson(rawContent);

      if (Array.isArray(aiQuestions)) {
        const formattedAi = aiQuestions.map((q: any) => ({
          statement: cleanQuestionText(q?.statement || q?.content || ""),
          options: Array.isArray(q?.options) ? q.options.slice(0, 4) : [q?.option_a, q?.option_b, q?.option_c, q?.option_d].filter(Boolean),
          correct: typeof q?.correct === 'number' ? q.correct : (typeof q?.correct_index === 'number' ? q.correct_index : 0),
          explanation: cleanQuestionText(q?.explanation || q?.rationale || ""),
          topic: q?.topic || topics[0],
          difficulty: q?.difficulty || difficulty,
          _source: "generated"
        }));

        // Persist to bank if requested
        if (saveToBank) {
          const { data: savedQs, error: saveErr } = await supabaseAdmin.from("questions_bank").insert(
            formattedAi.map((q: any) => ({
              user_id: userId,
              statement: q.statement,
              options: q.options,
              correct_index: q.correct,
              explanation: q.explanation,
              topic: q.topic,
              difficulty: q.difficulty,
              is_global: false,
              review_status: 'pending'
            }))
          ).select();
          
          if (!saveErr && savedQs) {
            questions.push(...savedQs.map((q: any) => ({ ...q, correct: q.correct_index, _source: "generated_saved" })));
          } else {
            logger.warn("BANK_SAVE_FAILED", saveErr?.message);
            questions.push(...formattedAi);
          }
        } else {
          questions.push(...formattedAi);
        }
      }
    }

    if (questions.length === 0) {
      return jsonError("NO_QUESTIONS_GENERATED", 500, { reason: "Bank empty and AI failed" });
    }

    // 6. Create Simulado Session
    let sessionId = null;
    if (createSession) {
      step = "create_session";
      const { data: session, error: sessErr } = await supabaseAdmin.from("simulado_sessions").insert({
        user_id: userId,
        mode: mode || 'estudo',
        total_questions: questions.length,
        status: 'active',
        discipline: specialty,
        topic: topics[0],
        difficulty: difficulty,
        source: source,
        metadata: { 
          correlation_id: correlationId,
          request_id: requestId,
          topics
        }
      }).select().single();

      if (sessErr) {
        logger.error("SESSION_CREATE_FAILED", sessErr.message);
      } else if (session?.id) {
        sessionId = session.id;
        
        // Link questions
        step = "link_questions";
        const linkData = questions.map((q: any, idx: number) => ({
          session_id: sessionId,
          question_id: q.id || null, 
          order_index: idx,
          question_snapshot: q.id ? null : q,
          is_ai_generated: q._source === "generated" || q._source === "generated_saved"
        }));

        const { error: linkErr } = await supabaseAdmin.from("simulado_questions").insert(linkData);
        if (linkErr) logger.warn("LINK_QUESTIONS_FAILED", linkErr.message);
      }
    }

    step = "complete";
    return new Response(JSON.stringify({ 
      success: true, 
      session_id: sessionId,
      questions: questions,
      source: source,
      total_questions: questions.length,
      correlation_id: correlationId,
      request_id: requestId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    logger.critical("QUESTION_GENERATOR_FAILED", error?.message, {
      correlation_id: correlationId,
      step,
      stack: error?.stack
    });

    return jsonError("QUESTION_GENERATOR_RUNTIME_ERROR", 500, {
      message: error?.message || "Erro interno no gerador de questões"
    });
  }
}));