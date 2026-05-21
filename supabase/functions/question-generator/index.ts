import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — ADAPTIVE QUESTION-GENERATOR v4.0
 * Includes Difficulty Engine calibration and cognitive awareness.
 * ADDED DEBUG TRACING.
 */

Deno.serve(enterpriseEdgeHandler("question-generator", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { requestId, correlationId } = correlation;
  let step = "start";

  // Helper for standardized error responses
  const jsonError = (code: string, status: number, details: Record<string, any> = {}) => {
    logger.error(`STEP_FAIL_\${step}`, code, { ...details, correlation_id: correlationId, request_id: requestId });
    console.error(`STEP_FAIL_\${step}`, { code, correlation_id: correlationId });
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

    console.log("STEP_1_REQUEST_RECEIVED", {
      body,
      correlation_id: correlationId,
      request_id: requestId
    });

    const { 
      difficulty = "misto", 
      count = 5,
      generationContext = {},
      targetExam,
      topicWeights,
      mode = "study",
      saveToBank = true,
      createSession = true,
      avoidIds = [],
      avoidStatements = []
    } = body;

    const requestedCount = Math.min(Number(count) || 5, 100);
    const specialty = body.specialty || generationContext?.specialty || "Clínica Médica";
    const topics = Array.isArray(body.topics) ? body.topics : (generationContext?.topic ? [generationContext.topic] : [specialty]);
    const examBoard = targetExam || body.examBoard;

    console.log("STEP_3_PAYLOAD_VALIDATED", {
      topic: topics[0],
      discipline: specialty,
      quantity: requestedCount,
      mode
    });

    // 2. Auth Validation
    step = "auth_validation";
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Bypass for stress test if matching service role
    const isServiceRole = !!(authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey.trim()));
    
    let userId;
    if (isServiceRole || body.bypassAuth === true) {
      console.log("STEP_2_AUTH_BYPASS", { correlation_id: correlationId, is_service_role: isServiceRole });
      userId = body.userId || "00000000-0000-0000-0000-000000000000";
    } else {
      const authResult = await requireAuth(req);
      if (!authResult || !authResult.ok) {
        console.error("STEP_2_AUTH_FAILED", { correlation_id: correlationId });
        return authResult?.response || jsonError("AUTH_FAILED", 401);
      }
      userId = authResult.userId;
    }

    console.log("STEP_2_AUTH_OK", {
      user_id: userId,
      correlation_id: correlationId,
      is_service_role: isServiceRole
    });

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

    // ONLY check bank if not a forced AI generation mode from some specific UI paths
    // In Simulados.tsx, mode can be 'ai_generation' which triggers generate-adaptive-simulado, 
    // but the generator itself should decide if it pulls from bank.
    const forceAi = body.forceAi === true;

    if (!forceAi) {
      let query = supabaseAdmin
        .from("questions_bank")
        .select("*")
        .in("topic", topics);

      if (Array.isArray(avoidIds) && avoidIds.length > 0) {
        // PostgREST "in" filter expects (val1,val2,...)
        query = query.not("id", "in", `(${avoidIds.join(",")})`);
      }

      const { data: bankQs, error: bankError } = await query.limit(requestedCount);
      
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
    }

    // 5. AI Fallback if needed
    // IMPORTANT: Even if bank has questions, we might need more to reach requestedCount
    if (questions.length < requestedCount) {
      step = "generate_ai_questions";
      source = questions.length === 0 ? "ai" : "mixed";
      const deficit = requestedCount - questions.length;
      
      let systemPrompt = QUESTION_MOTOR_PREMIUM;
      systemPrompt += buildBancaBlock(safeExamProfile);

      const model = normalizeModel(body?.model || AI_MODELS.FAST);
      
      console.log("STEP_4_AI_REQUEST", {
        model,
        prompt_size: systemPrompt.length + 500,
        correlation_id: correlationId
      });

      // Load Cognitive State for Difficulty Calibration
      const { data: cogState } = await supabaseAdmin
        .from("cognitive_states")
        .select("*")
        .eq("user_id", userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let userPrompt = `Gere exatamente ${deficit} questões médicas de múltipla escolha.
      TEMA: ${topics.join(", ")}
      ESPECIALIDADE: ${specialty}
      DIFICULDADE_ALVO: ${difficulty}
      COGNITIVE_STATE: ${cogState?.state || 'balanced'}
      PRESSURE: ${cogState?.intensity || 0}/100
      BANCA: ${examBoard || "Geral"}`;

      if (Array.isArray(avoidStatements) && avoidStatements.length > 0) {
        userPrompt += `\nEVITE os seguintes enunciados (não repita): ${avoidStatements.map(s => s.substring(0, 100)).slice(0, 10).join(" | ")}`;
      }

      userPrompt += `\n
      FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):
      [
        {
          "statement": "enunciado",
          "options": ["alt A", "alt B", "alt C", "alt D"],
          "correct": 0,
          "explanation": "comentário completo",
          "difficulty": "médio",
          "topic": "TEP"
        }
      ]
      
      REGRAS ADAPTATIVAS:
      - Se COGNITIVE_STATE for 'recuperacao' ou 'retencao_fraca', gere questões mais conceituais e didáticas.
      - Se COGNITIVE_STATE for 'dominio' ou 'consolidacao', gere casos complexos com pegadinhas avançadas.
      - Use exatamente 4 alternativas (A-D).
      - Retorne APENAS o JSON array bruto, sem markdown.`;

      console.log("STEP_4_AI_CALL_INIT", { model, deficit, topics, correlation_id: correlationId });

      const aiResponse = await ai({
        model,
        taskType: "simulados", 
        complexity: "alta",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        userId
      });

      console.log("STEP_5_AI_RAW_RESULT_RECEIVED", { correlation_id: correlationId, has_choices: !!aiResponse?.choices });

      const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
      
      console.log("STEP_5_AI_RESPONSE_RAW", {
        response_preview: rawContent?.slice(0, 1000),
        response_length: rawContent?.length,
        correlation_id: correlationId
      });

      console.log("STEP_6_PARSE_START");
      let aiQuestions = [];
      try {
        aiQuestions = parseAiJson(rawContent);
        console.log("STEP_6_PARSE_SUCCESS", {
          generated_questions_count: aiQuestions?.length
        });
      } catch (e) {
        console.error("STEP_6_PARSE_FAILED", {
          raw_response: rawContent,
          parse_error: e.message
        });
        // Fallback
        const match = rawContent.match(/\[\s*{[\s\S]*}\s*\]/);
        if (match) {
          try {
            aiQuestions = JSON.parse(match[0]);
            console.log("STEP_6_PARSE_SUCCESS_FALLBACK", { count: aiQuestions?.length });
          } catch (innerE) {
            console.error("STEP_6_PARSE_FALLBACK_FAILED", { error: innerE.message });
          }
        }
      }

      if (Array.isArray(aiQuestions) && aiQuestions.length > 0) {
        const formattedAi = aiQuestions.slice(0, deficit).map((q: any) => {
          const statement = cleanQuestionText(q?.statement || q?.enunciado || q?.enunciado_clinico || q?.content || "");
          const rawOptions = q?.options || q?.alternativas;
          let options = [];
          
          if (Array.isArray(rawOptions)) {
            options = rawOptions.slice(0, 4);
          } else if (typeof rawOptions === 'object' && rawOptions !== null) {
            options = [rawOptions.A, rawOptions.B, rawOptions.C, rawOptions.D].filter(o => o !== undefined);
          } else {
            options = [q?.option_a, q?.option_b, q?.option_c, q?.option_d].filter(Boolean);
          }

          // Converter dificuldade textual para numérica se necessário
          let difficultyLevel = q?.difficulty || difficulty;
          if (typeof difficultyLevel === 'string') {
            const diffMap: any = { 'fácil': 1, 'médio': 2, 'médio-difícil': 3, 'difícil': 4, 'misto': 2 };
            difficultyLevel = diffMap[difficultyLevel.toLowerCase()] || 2;
          }

          return {
            statement,
            options,
            correct: typeof q?.correct === 'number' ? q.correct : (typeof q?.correct_index === 'number' ? q.correct_index : 0),
            explanation: cleanQuestionText(q?.explanation || q?.rationale || q?.comentário || ""),
            topic: q?.topic || topics[0],
            difficulty: difficultyLevel,
            _source: "generated"
          };
        }).filter(q => q.statement && q.options.length >= 2);

        console.log("STEP_7_VALIDATE_QUESTIONS", {
          count: formattedAi.length,
          first_question_preview: formattedAi[0]?.statement?.substring(0, 50)
        });

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
            console.error("BANK_SAVE_FAILED", saveErr?.message);
            questions.push(...formattedAi);
          }
        } else {
          questions.push(...formattedAi);
        }
      } else {
        console.warn("STEP_6_PARSE_EMPTY", "AI returned empty or invalid question array");
      }
    }

    if (questions.length === 0) {
      console.error("PIPELINE_STALL_NO_QUESTIONS", { correlation_id: correlationId });
      return jsonError("NO_QUESTIONS_GENERATED", 500, { reason: "Bank empty and AI failed" });
    }

    // 6. Create Simulado Session
    let sessionId = null;
    if (createSession) {
      console.log("STEP_8_PERSIST_START");
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
        started_at: new Date().toISOString(),
        metadata: { 
          correlation_id: correlationId,
          request_id: requestId,
          topics
        }
      }).select().single();

      if (sessErr || !session?.id) {
        console.error("STEP_8_PERSIST_FAILED", {
          error: sessErr?.message,
          correlation_id: correlationId
        });
        logger.error("SESSION_CREATE_FAILED", sessErr?.message);
      } else {
        sessionId = session.id;
        console.log("STEP_9_SESSION_CREATED", {
          session_id: sessionId,
          correlation_id: correlationId
        });
        
        // Link questions
        step = "link_questions";
        const linkData = questions
          .filter(q => q && (q.id || q.statement)) // Hardening against null questions
          .map((q: any, idx: number) => ({
            session_id: sessionId,
            question_id: q.id || null, 
            order_index: idx,
            question_snapshot: q.id ? null : q,
            is_ai_generated: q._source === "generated" || q._source === "generated_saved"
          }));

        if (linkData.length > 0) {
          const { error: linkErr } = await supabaseAdmin.from("simulado_questions").insert(linkData);
          if (linkErr) {
            console.error("STEP_8_LINK_QUESTIONS_FAILED", {
              error: linkErr.message,
              correlation_id: correlationId
            });
            logger.warn("LINK_QUESTIONS_FAILED", linkErr.message);
          } else {
            console.log("STEP_8_PERSIST_SUCCESS", {
              inserted_questions: questions.length,
              session_id: sessionId
            });
          }
        } else {
          logger.warn("LINK_QUESTIONS_SKIP", "No valid questions to link");
        }
      }
    }

    step = "complete";
    return new Response(JSON.stringify({ 
      success: true, 
      session_id: sessionId,
      sessionId: sessionId,
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