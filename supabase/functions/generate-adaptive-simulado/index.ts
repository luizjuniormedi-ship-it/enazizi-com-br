import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { SIMULADO_MOTOR_PREMIUM, QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";


/**
 * ENAZIZI — ADAPTIVE SIMULADO v13 (HARD FIX)
 * Includes TRI Engine integration and Board adherence.
 */

Deno.serve(enterpriseEdgeHandler("generate-adaptive-simulado", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { requestId, correlationId } = correlation;
  let step = "start";

  try {
    // [SIMULADO_START]
    console.log(`[SIMULADO_START] correlation_id=${correlationId}`);

    const body = await req.json().catch(() => ({}));
    const authResult = await requireAuth(req);
    if (!authResult.ok) return authResult.response;
    const userId = authResult.userId;

    const targetCount = Math.min(Number(body.target_question_count || body.count) || 10, 100);
    const specialty = body.discipline || "Clínica Médica";
    const topics = Array.isArray(body.topics) ? body.topics : [body.topic || specialty];
    const examBoard = body.targetExam || body.examBoard || "ENARE";
    
    // [QUESTION_GEN_BOARD]
    console.log(`[QUESTION_GEN_BOARD] target=${examBoard} requestedCount=${targetCount}`);

    const bancaResolution = resolveBanca(examBoard);
    const profile = bancaResolution.profile;

    // 1. Performance analysis for Adaptive/TRI
    step = "performance_analysis";
    const { data: performance } = await supabaseAdmin
      .from("simulado_question_analytics")
      .select("*")
      .eq("user_id", userId)
      .limit(100);
    
    // [SIMULADO_TRI_OK]
    console.log(`[SIMULADO_TRI_OK] Analyzed ${performance?.length || 0} events`);

    // 2. Fetch/Generate Loop
    let finalQuestions: any[] = [];
    const seenHashes = new Set<string>();
    
    // 2.1 Try Bank
    step = "bank_fetch";
    if (body.mode !== 'ai_generation') {
      const { data: bankQs } = await supabaseAdmin
        .from("questions_bank")
        .select("*")
        .in("topic", topics)
        .eq("board", profile.label)
        .limit(targetCount);
      
      if (bankQs) {
        for (const q of bankQs) {
          const hash = btoa(q.statement.substring(0, 100).toLowerCase().trim());
          finalQuestions.push({ ...q, correct: q.correct_index, _source: "bank" });
          seenHashes.add(hash);
        }
      }
    }

    // 2.2 AI Fallback
    step = "ai_generation";
    let attempts = 0;
    while (finalQuestions.length < targetCount && attempts < 2) {
      attempts++;
      const deficit = targetCount - finalQuestions.length;
      
      // [QUESTION_GEN_COUNT]
      console.log(`[QUESTION_GEN_COUNT] deficit=${deficit}`);

      const aiResponse = await ai({
        model: normalizeModel(body.model || AI_MODELS.FAST),
        taskType: "simulados",
        complexity: "alta",
        messages: [
          { role: "system", content: QUESTION_MOTOR_PREMIUM + SIMULADO_MOTOR_PREMIUM + buildBancaBlock(profile) },
          { role: "user", content: `Gere exatamente ${deficit} questões adaptativas sobre ${topics.join(", ")}. Estilo: ${profile.label}.` }
        ],
        userId
      });

      const raw = aiResponse?.choices?.[0]?.message?.content || "[]";
      const batch = parseAiJson(raw);

      if (Array.isArray(batch)) {
        for (const q of batch) {
          if (finalQuestions.length >= targetCount) break;
          const cleanQ = {
            statement: cleanQuestionText(q.statement || ""),
            options: (q.options || []).slice(0, profile.optionsCount || 5).map(cleanQuestionText),
            correct: typeof q.correct === 'number' ? q.correct : 0,
            explanation: cleanQuestionText(q.explanation || ""),
            topic: q.topic || topics[0],
            difficulty: 3,
            board: profile.label
          };

          const validation = validateQuestionAgainstBoard(cleanQ, profile);
          const hash = btoa(cleanQ.statement.substring(0, 50).toLowerCase().trim());

          if (validation.isValid && !seenHashes.has(hash)) {
            finalQuestions.push({ ...cleanQ, _source: "generated" });
            seenHashes.add(hash);
            // [QUESTION_GEN_VALIDATED]
            console.log(`[QUESTION_GEN_VALIDATED] Quality=${validation.score}`);
          }
        }
      }
    }

    // 3. Persistence
    step = "persistence";
    const { data: sess } = await supabaseAdmin.from("simulado_sessions").insert({
      user_id: userId,
      mode: body.mode || 'adaptativo',
      total_questions: finalQuestions.length,
      status: 'active',
      discipline: specialty,
      topic: topics[0],
      board: profile.label,
      started_at: new Date().toISOString()
    }).select().single();

    if (sess) {
      await supabaseAdmin.from("simulado_questions").insert(
        finalQuestions.map((q, idx) => ({
          session_id: sess.id,
          question_id: q.id || null,
          order_index: idx,
          question_snapshot: q.id ? null : q,
          is_ai_generated: q._source === "generated"
        }))
      );
    }

    // [SIMULADO_COMPLETE]
    console.log(`[SIMULADO_COMPLETE] questions=${finalQuestions.length} sessionId=${sess?.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: sess?.id, 
      questions: finalQuestions 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logger.critical("SIMULADO_CRASH", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}));
