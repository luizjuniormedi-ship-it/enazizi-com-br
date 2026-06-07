import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { SIMULADO_MOTOR_PREMIUM, QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";

/**
 * ENAZIZI — HOTFIX P0 SIMULADO GENERATOR
 * Final Version: Fixed Foreign Key, Strict Filtering, Historical Dedup.
 */

const normalizeStatement = (s: string) => {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w]/g, "");
};

const makeHash = (statement: string): string => {
  const normalized = (statement || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
  return btoa(unescape(encodeURIComponent(normalized)));
};

Deno.serve(enterpriseEdgeHandler("generate-adaptive-simulado", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { correlationId } = correlation;
  let step = "start";

  try {
    const body = await req.json().catch(() => ({}));
    const authResult = await requireAuth(req);
    if (!authResult.ok) return authResult.response;
    const userId = authResult.userId;

    const requestedCount = Math.min(Number(body.target_question_count || body.count || body.questionCount) || 10, 100);
    const topics = Array.isArray(body.topics || body.selectedTopics) ? (body.topics || body.selectedTopics) : [body.topic || body.specialty || "Clínica Médica"];
    const subtopics = Array.isArray(body.subtopics || body.selectedSubtopics) ? (body.subtopics || body.selectedSubtopics) : [];
    const examBoard = body.targetExam || body.examBoard || "ENARE";
    
    console.log(`[SIM_GENERATOR_FILTERS_RECEIVED] userId=${userId} requested=${requestedCount} topics=${topics.join(",")} subtopics=${subtopics.join(",")} board=${examBoard}`);

    const bancaResolution = resolveBanca(examBoard);
    const profile = bancaResolution.profile;

    // 1. Historical Dedup (Last 7 days)
    step = "historical_dedup";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentSessions } = await supabaseAdmin
      .from("simulado_sessions")
      .select("id")
      .eq("user_id", userId)
      .gt("started_at", sevenDaysAgo);
      
    const sessionIds = (recentSessions || []).map(s => s.id);
    
    const [practiceHistory, simuladoHistory] = await Promise.all([
      supabaseAdmin.from("practice_attempts").select("question_id").eq("user_id", userId).gt("created_at", sevenDaysAgo),
      sessionIds.length > 0 
        ? supabaseAdmin.from("simulado_questions").select("question_id").in("session_id", sessionIds)
        : Promise.resolve({ data: [] })
    ]);

    const excludedIds = Array.from(new Set([
      ...(practiceHistory.data || []).map(p => p.question_id),
      ...(simuladoHistory.data || []).map(s => s.question_id)
    ].filter(Boolean))).slice(0, 500); 

    console.log(`[SIM_GENERATOR_RECENT_EXCLUDED] count=${excludedIds.length}`);

    // 2. Fetch from Bank (Strict filtering)
    step = "bank_fetch";
    let finalQuestions: any[] = [];
    const seenHashes = new Set<string>();
    const seenNormalized = new Set<string>();

    if (body.mode !== 'ai_generation') {
      const buildBaseQuery = () => supabaseAdmin
        .from("questions_bank")
        .select("id, statement, options, correct_index, explanation, topic, subtopic, curriculum_theme, curriculum_subtheme, difficulty, board")
        .eq("review_status", "approved");

      const applyExclusion = (q: any) =>
        excludedIds.length > 0 ? q.not("id", "in", `(${excludedIds.join(",")})`) : q;

      let candidates: any[] = [];

      if (subtopics.length > 0 && topics.length > 0) {
        const subOr = subtopics
          .flatMap((s: string) => [`subtopic.ilike.%${s}%`, `curriculum_subtheme.ilike.%${s}%`])
          .join(",");
        let q = buildBaseQuery().in("topic", topics).or(subOr);
        q = applyExclusion(q);
        const { data } = await q.limit(requestedCount * 3);
        candidates = data || [];
        console.log(`[SIM_GENERATOR_SUBTOPIC_MATCH] count=${candidates.length}`);
      }

      if (candidates.length === 0 && topics.length > 0) {
        let q = buildBaseQuery().in("topic", topics);
        q = applyExclusion(q);
        const { data } = await q.limit(requestedCount * 3);
        candidates = data || [];
        console.log(`[SIM_GENERATOR_TOPIC_MATCH] count=${candidates.length}`);
      }

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

    let insufficientQuestions = finalQuestions.length < requestedCount;
    if (insufficientQuestions) {
      console.log(`[SIM_GENERATOR_INSUFFICIENT_QUESTIONS] requested=${requestedCount} final=${finalQuestions.length}`);
    }

    // 4. Persistence
    step = "persistence";
    const { data: sess } = await supabaseAdmin.from("simulado_sessions").insert({
      user_id: userId,
      mode: body.mode || 'adaptativo',
      total_questions: finalQuestions.length,
      status: 'active',
      discipline: body.discipline || body.specialty || topics[0],
      topic: topics[0],
      started_at: new Date().toISOString(),
      metadata: { board: profile.label, requested: requestedCount, insufficientQuestions, correlation_id: correlationId }
    }).select().single();

    if (sess) {
      await supabaseAdmin.from("simulado_questions").insert(
        finalQuestions.map((q, idx) => ({
          session_id: sess.id,
          question_id: q.id,
          order_index: idx,
          is_ai_generated: q._source === "generated"
        }))
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: sess?.id, 
      questions: finalQuestions,
      requestedCount,
      generatedCount: finalQuestions.length,
      insufficientQuestions,
      message: insufficientQuestions ? `Encontramos apenas ${finalQuestions.length} questões para os filtros selecionados.` : undefined
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