import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";

/**
 * ENAZIZI — HOTFIX P0 SIMULADO GENERATOR
 * Implementation: Strict Topic Adherence + Historical Dedup + No Silent Fallback
 */

const normalizeStatement = (s: string) => {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w]/g, "");
};

const makeHash = (statement: string, len = 100): string => {
  const normalized = (statement || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .substring(0, len);
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h) + normalized.charCodeAt(i);
    h |= 0;
  }
  return `${normalized.length}_${Math.abs(h).toString(36)}_${normalized.substring(0, 40)}`;
};

Deno.serve(enterpriseEdgeHandler("question-generator", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { correlationId } = correlation;
  let step = "start";

  try {
    const body = await req.json().catch(() => ({}));
    const authResult = await requireAuth(req);
    if (!authResult.ok) return authResult.response;
    const userId = authResult.userId;

    const requestedCount = Math.min(Number(body.count || body.questionCount) || 5, 100);
    const topics = Array.isArray(body.topics || body.selectedTopics) ? (body.topics || body.selectedTopics) : [body.specialty || "Clínica Médica"];
    const subtopics = Array.isArray(body.subtopics || body.selectedSubtopics) ? (body.subtopics || body.selectedSubtopics) : [];
    const examBoard = body.targetExam || body.examBoard;
    const difficulty = body.difficulty || "misto";

    console.log(`[SIM_GENERATOR_FILTERS_RECEIVED] userId=${userId} requested=${requestedCount} topics=${topics.join(",")} subtopics=${subtopics.join(",")} board=${examBoard}`);

    const bancaResolution = resolveBanca(examBoard);
    const profile = bancaResolution.profile;

    // 1. Historical Dedup (Last 7 days)
    step = "historical_dedup";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentSessions, error: sessErr } = await supabaseAdmin
      .from("simulado_sessions")
      .select("id")
      .eq("user_id", userId)
      .gt("started_at", sevenDaysAgo);
      
    if (sessErr) console.warn(`[SIM_GENERATOR_SESS_ERR] ${sessErr.message}`);
    const sessionIds = (recentSessions || []).map(s => s.id);

    const { data: practiceHistory } = await supabaseAdmin
      .from("practice_attempts")
      .select("question_id")
      .eq("user_id", userId)
      .gt("created_at", sevenDaysAgo);

    const { data: simuladoHistory } = sessionIds.length > 0 
      ? await supabaseAdmin.from("simulado_questions").select("question_id").in("session_id", sessionIds)
      : { data: [] };

    const excludedIds = Array.from(new Set([
      ...(practiceHistory || []).map(p => p.question_id),
      ...(simuladoHistory || []).map(s => s.question_id)
    ].filter(Boolean))).slice(0, 500);

    console.log(`[SIM_GENERATOR_RECENT_EXCLUDED] count=${excludedIds.length}`);

    // 2. Fetch from Bank (Strict filtering)
    step = "bank_fetch";
    let finalQuestions: any[] = [];
    const seenHashes = new Set<string>();
    const seenNormalized = new Set<string>();

    if (body.mode !== 'ai_generation') {
      let query = supabaseAdmin
        .from("questions_bank")
        .select("id, statement, options, correct_index, explanation, topic, subtopic, curriculum_theme, curriculum_subtheme, difficulty, board")
        .eq("review_status", "approved");

      if (subtopics.length > 0) {
        const subtopicFilter = subtopics.map(s => `"${s}"`).join(",");
        query = query.or(`subtopic.in.(${subtopicFilter}),curriculum_subtheme.in.(${subtopicFilter})`);
      } else if (topics.length > 0) {
        const topicFilter = topics.map(t => `"${t}"`).join(",");
        query = query.or(`topic.in.(${topicFilter}),curriculum_theme.in.(${topicFilter}),curriculum_discipline.in.(${topicFilter})`);
      }

      if (examBoard && examBoard !== 'all') {
        query = query.eq("board", profile.label);
      }

      if (excludedIds.length > 0) {
        query = query.not("id", "in", `(${excludedIds.join(",")})`);
      }

      const { data: bankQs } = await query.limit(requestedCount * 2);
      const candidates = bankQs || [];
      console.log(`[SIM_GENERATOR_CANDIDATES_FOUND] count=${candidates.length}`);

      for (const q of candidates) {
        if (finalQuestions.length >= requestedCount) break;
        const hash = makeHash(q.statement);
        const norm = normalizeStatement(q.statement);
        if (seenHashes.has(hash) || seenNormalized.has(norm)) continue;
        
        finalQuestions.push({ ...q, correct: q.correct_index, _source: "bank" });
        seenHashes.add(hash);
        seenNormalized.add(norm);
      }
    }

    console.log(`[SIM_GENERATOR_DEDUP_APPLIED] after_bank=${finalQuestions.length}`);

    // 3. AI Generation
    let insufficientQuestions = finalQuestions.length < requestedCount;
    
    if (insufficientQuestions && body.mode !== 'bank_only' && body.allowAiGeneration === true) {
      step = "ai_generation";
      const deficit = requestedCount - finalQuestions.length;
      console.log(`[SIM_GENERATOR_AI_FALLBACK] deficit=${deficit}`);

      const systemPrompt = QUESTION_MOTOR_PREMIUM + buildBancaBlock(profile);
      const userPrompt = `Gere exatamente ${deficit} questões médicas novas para ${profile.label} sobre ${topics.join(", ")}. NÃO saia destes temas. Dificuldade: ${difficulty}. Retorne apenas JSON array bruto.`;

      try {
        const aiResponse = await ai({
          model: normalizeModel(body.model || AI_MODELS.FAST),
          taskType: "simulados",
          complexity: "alta",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          userId
        });

        const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
        let aiBatch: any[] = [];
        try { aiBatch = parseAiJson(rawContent); } catch { aiBatch = []; }

        for (const q of aiBatch) {
          if (finalQuestions.length >= requestedCount) break;
          const cleanQ = {
            statement: cleanQuestionText(q.statement || ""),
            options: (q.options || []).slice(0, profile.optionsCount || 5).map(cleanQuestionText),
            correct: typeof q.correct === 'number' ? q.correct : 0,
            explanation: cleanQuestionText(q.explanation || ""),
            topic: q.topic || topics[0],
            difficulty: typeof q.difficulty === 'number' ? q.difficulty : 3,
            board: profile.label
          };

          const hash = makeHash(cleanQ.statement);
          const norm = normalizeStatement(cleanQ.statement);
          
          if (!seenHashes.has(hash) && !seenNormalized.has(norm) && cleanQ.options.length >= 4) {
            finalQuestions.push({ ...cleanQ, _source: "generated" });
            seenHashes.add(hash);
            seenNormalized.add(norm);
          }
        }
      } catch (e) {
        console.warn(`[SIM_GENERATOR_AI_ERROR] ${e.message}`);
      }
    }

    insufficientQuestions = finalQuestions.length < requestedCount;

    // 4. Persistence
    step = "persist";
    let sessionId = null;
    
    const { data: sess, error: sessInsertErr } = await supabaseAdmin.from("simulado_sessions").insert({
      user_id: userId,
      mode: body.mode || 'study',
      total_questions: finalQuestions.length,
      status: 'active',
      discipline: body.specialty || topics[0],
      topic: topics[0],
      difficulty: difficulty,
      started_at: new Date().toISOString(),
      metadata: { 
        board: profile.label, 
        requested: requestedCount, 
        insufficientQuestions,
        correlation_id: correlationId 
      }
    }).select().single();

    if (sessInsertErr) console.error(`[SIM_GENERATOR_SESS_INSERT_ERR] ${sessInsertErr.message}`);

    if (sess) {
      sessionId = sess.id;
      const { error: qInsertErr } = await supabaseAdmin.from("simulado_questions").insert(
        finalQuestions.map((q, idx) => ({
          session_id: sessionId,
          question_id: q.id || null,
          order_index: idx,
          question_snapshot: q.id ? null : q,
          is_ai_generated: q._source === "generated"
        }))
      );
      if (qInsertErr) console.error(`[SIM_GENERATOR_QS_INSERT_ERR] ${qInsertErr.message}`);
    }

    console.log(`[SIM_GENERATOR_FINAL_SELECTION] count=${finalQuestions.length} sessionId=${sessionId}`);

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      sessionId: sessionId,
      questions: finalQuestions,
      requestedCount,
      generatedCount: finalQuestions.length,
      insufficientQuestions,
      message: insufficientQuestions ? `Encontramos apenas ${finalQuestions.length} questões para os filtros selecionados.` : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    logger.critical("SIMULADO_CRASH", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}));