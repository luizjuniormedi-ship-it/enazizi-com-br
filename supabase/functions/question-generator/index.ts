import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";

/**
 * ENAZIZI — ADAPTIVE QUESTION-GENERATOR v13 (HARD FIX)
 * Mandatory adherence to Board, Quantity, and Pattern.
 */

Deno.serve(enterpriseEdgeHandler("question-generator", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { requestId, correlationId } = correlation;
  let step = "start";

  // Standardized error helper
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
    // [QUESTION_GEN_START]
    console.log(`[QUESTION_GEN_START] correlation_id=${correlationId}`);

    // 1. Validate Input
    step = "parse_body";
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("EMPTY_BODY", 400);

    const { 
      difficulty = "misto", 
      count = 5,
      targetExam,
      mode = "study",
      saveToBank = true,
      createSession = true,
      avoidIds = [],
      avoidStatements = [],
      topics: bodyTopics,
      specialty: bodySpecialty
    } = body;

    const requestedCount = Math.min(Number(count) || 5, 100);
    const specialty = bodySpecialty || "Clínica Médica";
    const topics = Array.isArray(bodyTopics) ? bodyTopics : [specialty];
    const examBoard = targetExam || body.examBoard;

    // [QUESTION_GEN_BOARD]
    console.log(`[QUESTION_GEN_BOARD] target=${examBoard || 'Geral'} requestedCount=${requestedCount}`);

    // 2. Auth Validation
    step = "auth_validation";
    const authResult = await requireAuth(req);
    if (!authResult.ok) return authResult.response;
    const userId = authResult.userId;

    // 3. Exam Profile Resolution
    step = "load_profile";
    const bancaResolution = resolveBanca(examBoard);
    const profile = bancaResolution.profile;

    // 4. Multi-stage Pipeline
    let finalQuestions: any[] = [];
    const seenHashes = new Set<string>();

    // 4.1 Try Bank First
    step = "load_bank";
    if (body.forceAi !== true) {
      let query = supabaseAdmin
        .from("questions_bank")
        .select("*")
        .in("topic", topics);

      if (examBoard && examBoard !== 'all') {
        query = query.eq("board", profile.label);
      }

      if (avoidIds.length > 0) {
        query = query.not("id", "in", `(${avoidIds.join(",")})`);
      }

      const { data: bankQs } = await query.limit(requestedCount);
      
      if (bankQs) {
        for (const q of bankQs) {
          const hash = btoa(q.statement.substring(0, 100).toLowerCase().trim());
          if (!seenHashes.has(hash)) {
            finalQuestions.push({
              id: q.id,
              statement: q.statement,
              options: q.options,
              correct: q.correct_index,
              explanation: q.explanation,
              topic: q.topic,
              difficulty: q.difficulty,
              board: q.board,
              _source: "bank"
            });
            seenHashes.add(hash);
          }
        }
      }
    }

    // 4.2 AI Generation Loop (Hard Quantity Enforcement)
    step = "ai_generation";
    let attempts = 0;
    const maxAttempts = 3;

    while (finalQuestions.length < requestedCount && attempts < maxAttempts) {
      attempts++;
      const deficit = requestedCount - finalQuestions.length;
      
      // [QUESTION_GEN_COUNT]
      console.log(`[QUESTION_GEN_COUNT] deficit=${deficit} attempt=${attempts}/${maxAttempts}`);

      const systemPrompt = QUESTION_MOTOR_PREMIUM + buildBancaBlock(profile);
      const userPrompt = `Gere exatamente ${deficit} questões médicas novas.
      TEMA: ${topics.join(", ")}
      DIFICULDADE: ${difficulty}
      BANCA: ${profile.label}
      EVITE REPETIR: ${Array.from(seenHashes).slice(0, 5).join(" | ")}
      
      FORMATO JSON OBRIGATÓRIO (ARRAY):
      [
        {
          "statement": "enunciado",
          "options": ["A", "B", "C", "D", "E"],
          "correct": 0,
          "explanation": "comentário",
          "topic": "TEP",
          "difficulty": 3
        }
      ]`;

      const aiResponse = await ai({
        model: normalizeModel(body.model || AI_MODELS.FAST),
        taskType: "simulados",
        complexity: "alta",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        userId
      });

      const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
      let aiBatch = [];
      try {
        aiBatch = parseAiJson(rawContent);
      } catch (e) {
        // [QUESTION_GEN_RETRY]
        console.warn(`[QUESTION_GEN_RETRY] Parse fail: ${e.message}`);
        continue;
      }

      if (Array.isArray(aiBatch)) {
        for (const q of aiBatch) {
          if (finalQuestions.length >= requestedCount) break;

          // Cleaning
          const cleanQ = {
            statement: cleanQuestionText(q.statement || ""),
            options: (q.options || []).map(cleanQuestionText),
            correct: typeof q.correct === 'number' ? q.correct : 0,
            explanation: cleanQuestionText(q.explanation || ""),
            topic: q.topic || topics[0],
            difficulty: typeof q.difficulty === 'number' ? q.difficulty : 3,
            board: profile.label
          };

          // 1. Validation
          const validation = validateQuestionAgainstBoard(cleanQ, profile);
          if (!validation.isValid) {
            console.warn(`[QUESTION_GEN_INVALID] ${validation.reason}`);
            continue;
          }

          // 2. Deduplication
          const hash = btoa(cleanQ.statement.substring(0, 100).toLowerCase().trim());
          if (seenHashes.has(hash)) {
            // [QUESTION_GEN_DUPLICATE_BLOCK]
            console.log(`[QUESTION_GEN_DUPLICATE_BLOCK] Hash=${hash.substring(0, 10)}...`);
            continue;
          }

          // [QUESTION_GEN_VALIDATED]
          console.log(`[QUESTION_GEN_VALIDATED] Quality=${validation.score}`);
          
          finalQuestions.push({ ...cleanQ, _source: "generated" });
          seenHashes.add(hash);
        }
      }
    }

    // 5. Final check
    if (finalQuestions.length < requestedCount) {
      console.warn(`[QUESTION_GEN_COUNT_MISMATCH] Expected ${requestedCount}, got ${finalQuestions.length}`);
    }

    // 6. Persistence
    step = "persist";
    let sessionId = null;

    if (saveToBank) {
      const generatedOnly = finalQuestions.filter(q => q._source === "generated");
      if (generatedOnly.length > 0) {
        await supabaseAdmin.from("questions_bank").insert(
          generatedOnly.map(q => ({
            user_id: userId,
            statement: q.statement,
            options: q.options,
            correct_index: q.correct,
            explanation: q.explanation,
            topic: q.topic,
            difficulty: q.difficulty,
            board: q.board,
            is_global: false,
            review_status: 'pending'
          }))
        );
      }
    }

    if (createSession) {
      const { data: sess } = await supabaseAdmin.from("simulado_sessions").insert({
        user_id: userId,
        mode: mode,
        total_questions: finalQuestions.length,
        status: 'active',
        discipline: specialty,
        topic: topics[0],
        difficulty: difficulty,
        board: profile.label,
        source: finalQuestions.every(q => q._source === 'bank') ? 'bank' : 'mixed',
        started_at: new Date().toISOString()
      }).select().single();
      
      if (sess) {
        sessionId = sess.id;
        await supabaseAdmin.from("simulado_questions").insert(
          finalQuestions.map((q, idx) => ({
            session_id: sessionId,
            question_id: q.id || null,
            order_index: idx,
            question_snapshot: q.id ? null : q,
            is_ai_generated: q._source === "generated"
          }))
        );
      }
    }

    // [QUESTION_GEN_FINAL_OK]
    console.log(`[QUESTION_GEN_FINAL_OK] total=${finalQuestions.length} sessionId=${sessionId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: sessionId,
      sessionId: sessionId,
      questions: finalQuestions,
      total_questions: finalQuestions.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    logger.critical("QUESTION_GENERATOR_CRASH", error.message);
    return jsonError("INTERNAL_ERROR", 500, { message: error.message });
  }
}));
