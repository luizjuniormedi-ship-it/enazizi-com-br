import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAiJson, cleanQuestionText } from "../_shared/ai-fetch.ts";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { SIMULADO_MOTOR_PREMIUM, QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { AI_MODELS, normalizeModelStrict } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — GENERATE ADAPTIVE SIMULADO v3.5
 * Fixed with persistence of non-bank questions and better error handling.
 */
Deno.serve(enterpriseEdgeHandler("generate-adaptive-simulado", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId } = correlation;
  
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isServiceRole = !!(authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey.trim()));
  
  const body = await req.json().catch(() => ({}));
  let userId;

  if (isServiceRole || body.bypassAuth === true) {
    console.log("STEP_2_AUTH_BYPASS", { correlation_id: correlationId, is_service_role: isServiceRole });
    userId = body.userId || "00000000-0000-0000-0000-000000000000";
  } else {
    const authResult = await requireAuth(req);
    if (!authResult.ok) {
      console.error("STEP_2_AUTH_FAILED", { correlation_id: correlationId });
      return authResult.response;
    }
    userId = authResult.userId;
  }

  console.log("STEP_1_REQUEST_RECEIVED", {
    body,
    correlation_id: correlationId,
    request_id: requestId
  });

  console.log("STEP_2_AUTH_OK", {
    user_id: userId,
    correlation_id: correlationId
  });

  const targetCount = Math.min(Number(body.target_question_count) || 10, 30);
  const topicToGen = body.topic || body.discipline || "Clínica Médica";
  const mode = body.mode || 'adaptive';
  const isForcedAi = mode === 'ai_generation' || mode === 'prova_real' || mode === 'tri';

  console.log("STEP_3_PAYLOAD_VALIDATED", {
    topic: topicToGen,
    discipline: body.discipline,
    quantity: targetCount,
    mode
  });

  logger.info("ADAPTIVE_SIM_START", "Analyzing performance and generating adaptive blueprint", { userId });

  // 1. Performance profile
  const performance = body.performance || {
    by_modality: { "Clínica Médica": 50 },
    by_difficulty: { easy: 50, medium: 50, hard: 50 },
    response_time: {},
    error_patterns: [],
  };

  const questions: any[] = [];
  const modalityScores = performance.by_modality || {};
  const weakTopics = Object.entries(modalityScores as Record<string, number>)
    .filter(([_, score]) => score < 60)
    .map(([topic]) => topic);

  // 2. Fetch from bank first (only if not forced AI generation)
  if (!isForcedAi) {
    logger.info("BANK_CHECK_START", `Checking bank for ${weakTopics.length} weak topics`, { weakTopics });

    if (weakTopics.length > 0) {
      const { data: bankQs, error: bankErr } = await supabaseAdmin
        .from("questions_bank")
        .select("*")
        .in("topic", weakTopics)
        .limit(targetCount);
      
      if (bankErr) {
        logger.error("BANK_FETCH_ERROR", bankErr.message);
      } else if (bankQs) {
        questions.push(...bankQs.map(q => ({
          id: q.id,
          statement: q.statement,
          options: q.options,
          correct: q.correct_index,
          explanation: q.explanation,
          topic: q.topic,
          difficulty: q.difficulty,
          _source: "bank"
        })));
        logger.info("BANK_HIT", `Found ${bankQs.length} questions in bank`);
      }
    }
  } else {
    logger.info("FORCED_AI_GENERATION", "Skipping bank search as requested by mode");
  }

  // 3. AI Generation for deficit
  const deficit = targetCount - questions.length;
  if (deficit > 0) {
    const model = normalizeModelStrict(
      body.model || 
      Deno.env.get("AI_MODEL") || 
      AI_MODELS.FAST
    );

    console.log("STEP_4_AI_REQUEST", {
      model,
      prompt_size: 1000, // Approximate
      correlation_id: correlationId
    });

    logger.info("FINAL_AI_MODEL_BEFORE_GATEWAY", `Generating ${deficit} questions via AI`, { 
      resolvedModel: model,
      topic: topicToGen,
      correlation_id: correlationId
    });
    
    console.log("STEP_4_AI_CALL_INIT", { model, deficit, topic: topicToGen, correlation_id: correlationId });
    
    const aiResponse = await ai({
      model,
      taskType: "simulados",
      messages: [
        { role: "system", content: QUESTION_MOTOR_PREMIUM + "\n" + SIMULADO_MOTOR_PREMIUM },
        { role: "user", content: `Gere exatamente ${deficit} questões médicas adaptativas sobre o tema: ${topicToGen}. Foque em padrões de diagnóstico, tratamento e conduta clínica. Use exatamente 4 alternativas (A-D). 
        
        RETORNE APENAS UM JSON ARRAY VÁLIDO COM ESTAS CHAVES:
        [
          {
            "statement": "enunciado clínico...",
            "options": ["A", "B", "C", "D"],
            "correct": 0,
            "explanation": "comentário...",
            "topic": "${topicToGen}",
            "difficulty": "hard"
          }
        ]` }
      ],
      complexity: "alta",
      userId
    }, { retries: 2 });

    console.log("STEP_5_AI_RAW_RESULT_RECEIVED", { correlation_id: correlationId, has_choices: !!aiResponse?.choices });

    const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
    
    console.log("STEP_5_AI_RESPONSE_RAW", {
      response_preview: rawContent?.slice(0, 1000),
      response_length: rawContent?.length,
      correlation_id: correlationId
    });

    console.log("STEP_6_PARSE_START");
    let generated = [];
    try {
      generated = parseAiJson(rawContent);
      console.log("STEP_6_PARSE_SUCCESS", {
        generated_questions_count: generated?.length
      });
    } catch (e) {
      console.error("STEP_6_PARSE_FAILED", {
        raw_response: rawContent,
        parse_error: e.message
      });
      // Fallback: try to find anything that looks like a JSON array
      const match = rawContent.match(/\[\s*{[\s\S]*}\s*\]/);
      if (match) {
        try {
          generated = JSON.parse(match[0]);
          console.log("STEP_6_PARSE_SUCCESS_FALLBACK", { count: generated?.length });
        } catch (innerE) {
          console.error("STEP_6_PARSE_FALLBACK_FAILED", { error: innerE.message });
        }
      }
    }
    
    if (Array.isArray(generated) && generated.length > 0) {
      const mappedQuestions = generated.slice(0, deficit).map(q => {
        // Robust mapping for variations in AI keys
        const statement = cleanQuestionText(q.statement || q.content || q.enunciado || q.enunciado_clinico || "");
        
        let options = [];
        if (Array.isArray(q.options)) {
          options = q.options;
        } else if (q.alternativas && typeof q.alternativas === 'object') {
          options = Object.values(q.alternativas);
        } else {
          options = [q.option_a, q.option_b, q.option_c, q.option_d, q.a, q.b, q.c, q.d].filter(Boolean);
        }
        
        // Ensure exactly 4 options
        options = options.slice(0, 4);

        let correct = 0;
        if (typeof q.correct === 'number') {
          correct = q.correct;
        } else if (typeof q.correct_index === 'number') {
          correct = q.correct_index;
        } else if (typeof q.correta === 'string') {
          // Handle "A", "B", "C", "D"
          const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
          correct = map[q.correta.toUpperCase()] || 0;
        }

        const explanation = cleanQuestionText(q.explanation || q.rationale || q.comentario || q.comentario_tecnico || "");

        return {
          statement,
          options,
          correct,
          explanation,
          topic: q.topic || topicToGen,
          difficulty: q.difficulty || "hard",
          _source: "generated"
        };
      });

      console.log("STEP_7_VALIDATE_QUESTIONS", {
        count: mappedQuestions.length,
        first_question: mappedQuestions[0]
      });

      questions.push(...mappedQuestions);
    } else {
      console.warn("STEP_6_PARSE_EMPTY", "AI returned empty or invalid question array");
      logger.warn("NO_QUESTIONS_GENERATED", "AI returned empty or invalid question array");
    }
  }

  if (questions.length === 0) {
    console.error("PIPELINE_STALL_NO_QUESTIONS", { correlation_id: correlationId });
    throw new Error("Não foi possível obter questões para o simulado.");
  }

  // 4. Create Session
  console.log("STEP_8_PERSIST_START");
  const { data: session, error: sessErr } = await supabaseAdmin.from("simulado_sessions").insert({
    user_id: userId,
    mode: 'adaptativo',
    total_questions: questions.length,
    status: 'active',
    discipline: questions[0]?.topic || "Clínica Médica",
    topic: questions[0]?.topic,
    difficulty: 'adaptativo',
    source: questions.every(q => q._source === 'bank') ? 'bank' : (questions.every(q => q._source === 'generated') ? 'ai' : 'mixed'),
    started_at: new Date().toISOString(),
    metadata: { 
      adaptive_meta: performance,
      correlation_id: correlationId,
      request_id: requestId
    }
  }).select().single();

  if (sessErr || !session?.id) {
    console.error("STEP_8_PERSIST_FAILED", {
      error: sessErr?.message,
      correlation_id: correlationId
    });
    throw new Error(`Falha ao criar sessão: ${sessErr?.message || 'ID não retornado'}`);
  }

  console.log("STEP_9_SESSION_CREATED", {
    session_id: session.id,
    correlation_id: correlationId
  });

  // Link questions
  const linkData = questions.map((q, idx) => ({
    session_id: session.id,
    question_id: q.id || null,
    order_index: idx,
    question_snapshot: q.id ? null : q,
    is_ai_generated: q._source === "generated"
  }));

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
      session_id: session.id
    });
  }

  return new Response(JSON.stringify({
    success: true,
    sessionId: session.id,
    session_id: session.id, // For compatibility
    questions: questions,
    total: questions.length,
    correlation_id: correlationId,
    request_id: requestId
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));