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
  
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;
  const body = await req.json().catch(() => ({}));

  logger.info("ADAPTIVE_SIM_START", "Analyzing performance and generating adaptive blueprint", { userId });

  const targetCount = Math.min(Number(body.target_question_count) || 10, 30);
  
  // 1. Performance profile
  const performance = body.performance || {
    by_modality: { "Clínica Médica": 50 },
    by_difficulty: { easy: 50, medium: 50, hard: 50 },
    response_time: {},
    error_patterns: [],
  };

  // 2. Fetch from bank first (only if not forced AI generation)
  const questions: any[] = [];
  const modalityScores = performance.by_modality || {};
  const weakTopics = Object.entries(modalityScores as Record<string, number>)
    .filter(([_, score]) => score < 60)
    .map(([topic]) => topic);

  const mode = body.mode || 'adaptive';
  const isForcedAi = mode === 'ai_generation';

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
    const topicToGen = body.topic || body.discipline || weakTopics[0] || "Clínica Médica";
    
    const model = normalizeModelStrict(
      body.model || 
      Deno.env.get("AI_MODEL") || 
      AI_MODELS.FAST
    );

    logger.info("FINAL_AI_MODEL_BEFORE_GATEWAY", `Generating ${deficit} questions via AI`, { 
      resolvedModel: model,
      topic: topicToGen,
      correlation_id: correlationId
    });
    
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
    }, { retries: 2 }); // Allow retries for simulados to avoid empty results

    const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
    let generated = [];
    try {
      generated = parseAiJson(rawContent);
    } catch (e) {
      logger.error("AI_PARSE_ERROR", `Failed to parse AI response: ${e.message}`, { rawContent });
      // Fallback: try to find anything that looks like a JSON array
      const match = rawContent.match(/\[\s*{[\s\S]*}\s*\]/);
      if (match) {
        generated = JSON.parse(match[0]);
      }
    }
    
    if (Array.isArray(generated) && generated.length > 0) {
      questions.push(...generated.slice(0, deficit).map(q => {
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
      }));
    } else {
      logger.warn("NO_QUESTIONS_GENERATED", "AI returned empty or invalid question array");
    }
  }

  if (questions.length === 0) {
    throw new Error("Não foi possível obter questões para o simulado.");
  }

  // 4. Create Session
  const { data: session, error: sessErr } = await supabaseAdmin.from("simulado_sessions").insert({
    user_id: userId,
    mode: 'adaptativo',
    total_questions: questions.length,
    status: 'active',
    discipline: questions[0]?.topic || "Clínica Médica",
    topic: questions[0]?.topic,
    difficulty: 'adaptativo',
    source: questions.every(q => q._source === 'bank') ? 'bank' : (questions.every(q => q._source === 'generated') ? 'ai' : 'mixed'),
    started_at: new Date().toISOString(), // Use started_at instead of created_at
    metadata: { 
      adaptive_meta: performance,
      correlation_id: correlationId,
      request_id: requestId
    }
  }).select().single();

  if (sessErr || !session?.id) {
    throw new Error(`Falha ao criar sessão: ${sessErr?.message || 'ID não retornado'}`);
  }

  // Link questions
  const linkData = questions.map((q, idx) => ({
    session_id: session.id,
    question_id: q.id || null,
    order_index: idx,
    question_snapshot: q.id ? null : q,
    is_ai_generated: q._source === "generated"
  }));

  const { error: linkErr } = await supabaseAdmin.from("simulado_questions").insert(linkData);
  if (linkErr) logger.warn("LINK_QUESTIONS_FAILED", linkErr.message);

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