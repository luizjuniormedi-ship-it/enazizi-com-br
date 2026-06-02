import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
// Contract layer v1 — símbolos estáveis (vide _shared/contracts/README.md)
import { cleanQuestionText, parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";

// safeHash: btoa não aceita caracteres não-Latin1 (acentos pt-BR quebram).
// Usamos uma hash determinística baseada em char codes + slug normalizado.
function safeHash(input: string, len = 100): string {
  const normalized = (input || "")
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
}


/**
 * ENAZIZI — ADAPTIVE QUESTION-GENERATOR v13 (HARD FIX)
 * Final consolidation of stability and quantity enforcement.
 */

Deno.serve(enterpriseEdgeHandler("question-generator", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { requestId, correlationId } = correlation;
  let step = "start";

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
    console.log(`[QUESTION_GEN_START] correlation_id=${correlationId}`);
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
      topics: bodyTopics,
      specialty: bodySpecialty
    } = body;

    const requestedCount = Math.min(Number(count) || 5, 100);
    const specialty = bodySpecialty || "Clínica Médica";
    const topics = Array.isArray(bodyTopics) ? bodyTopics : [specialty];
    const examBoard = targetExam || body.examBoard;

    console.log(`[QUESTION_GEN_BOARD] target=${examBoard || 'Geral'} requestedCount=${requestedCount}`);
    step = "auth_validation";
    const authResult = await requireAuth(req);
    if (!authResult.ok) return authResult.response;
    const userId = authResult.userId;

    step = "load_profile";
    const bancaResolution = resolveBanca(examBoard);
    const profile = bancaResolution.profile;

    let finalQuestions: any[] = [];
    const seenHashes = new Set<string>();

    step = "load_bank";
    if (body.forceAi !== true) {
      let query = supabaseAdmin.from("questions_bank").select("*").in("topic", topics);
      if (examBoard && examBoard !== 'all') query = query.eq("board", profile.label);
      if (avoidIds.length > 0) query = query.not("id", "in", `(${avoidIds.join(",")})`);
      const { data: bankQs } = await query.limit(requestedCount);
      if (bankQs) {
        for (const q of bankQs) {
          const hash = safeHash(q.statement, 100);
          if (!seenHashes.has(hash)) {
            finalQuestions.push({ ...q, correct: q.correct_index, _source: "bank" });
            seenHashes.add(hash);
          }
        }
      }
    }

    step = "ai_generation";
    // P0.1 — Global deadline (38s) to stay under frontend 45s timeout.
    const DEADLINE_MS = 38_000;
    const startedAt = Date.now();
    const deadlineReached = () => (Date.now() - startedAt) >= DEADLINE_MS;

    // P0.2 — Reorder providers: force Gemini-first while OpenAI quota is exhausted.
    // Ignore caller-supplied openai/* override during the crisis.
    const requestedModel = body.model && !String(body.model).startsWith("openai/")
      ? body.model
      : AI_MODELS.FAST; // gemini-2.5-flash

    // Fire-and-forget forensic log insert (P0.3 — never block generation on telemetry).
    const logForensicAsync = (payload: Record<string, any>) => {
      supabaseAdmin.from("forensic_quality_logs").insert(payload).then(
        () => {},
        (e: any) => console.warn(`[FORENSIC_LOG_FAIL] ${e?.message || e}`)
      );
    };

    let attempts = 0;
    // P0.4 — accept controlled degradation (<=2 attempts is enough when partial OK).
    while (finalQuestions.length < requestedCount && attempts < 2 && !deadlineReached()) {
      attempts++;
      const deficit = requestedCount - finalQuestions.length;
      const elapsed = Date.now() - startedAt;
      console.log(`[QUESTION_GEN_COUNT] deficit=${deficit} attempt=${attempts}/2 elapsed_ms=${elapsed} model=${requestedModel}`);

      const systemPrompt = QUESTION_MOTOR_PREMIUM + buildBancaBlock(profile);
      const userPrompt = `Gere exatamente ${deficit} questões médicas novas para ${profile.label} sobre ${topics.join(", ")}. Dificuldade: ${difficulty}. Retorne apenas JSON array bruto.`;

      let aiResponse: any = null;
      try {
        aiResponse = await ai({
          model: normalizeModel(requestedModel),
          taskType: "simulados",
          complexity: "alta",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          userId
        });
      } catch (e: any) {
        console.warn(`[AI_CALL_FAIL] attempt=${attempts} err=${e?.message || e}`);
        continue;
      }

      const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
      let aiBatch: any[] = [];
      try { aiBatch = parseAiJson(rawContent); } catch { continue; }

      if (!Array.isArray(aiBatch)) continue;

      for (const q of aiBatch) {
        if (finalQuestions.length >= requestedCount) break;
        if (deadlineReached()) {
          console.warn(`[DEADLINE_HIT] elapsed_ms=${Date.now() - startedAt} stopping forensic loop`);
          break;
        }
        const cleanQ = {
          statement: cleanQuestionText(q.statement || ""),
          options: (q.options || []).slice(0, profile.optionsCount || 5).map(cleanQuestionText),
          correct: typeof q.correct === 'number' ? q.correct : 0,
          explanation: cleanQuestionText(q.explanation || ""),
          topic: q.topic || topics[0],
          difficulty: typeof q.difficulty === 'number' ? q.difficulty : 3,
          board: profile.label
        };

        // Forensic Validation v14 (still serial — but log insert is async).
        const forensic = await analyzeQuestionForensic(cleanQ, profile, supabaseAdmin);
        const validation = validateQuestionAgainstBoard(cleanQ, profile);

        const hash = safeHash(cleanQ.statement, 50);

        // P0.4 — Controlled degradation: accept if content has >=4 options
        // and forensic score is reasonable, even if "Wrong options count" was flagged.
        const hasMinimumOptions = cleanQ.options.length >= 4;
        const reasonableScore = forensic.fidelity_score >= 60;
        const strictPass = forensic.isValid && validation.isValid;
        const softPass = hasMinimumOptions && reasonableScore;
        const accept = (strictPass || softPass) && !seenHashes.has(hash);

        logForensicAsync({
          board: profile.label,
          fidelity_score: forensic.fidelity_score,
          structural_score: forensic.structural_score,
          lexical_score: forensic.lexical_score,
          cognitive_score: forensic.cognitive_score,
          pedagogical_score: forensic.pedagogical_score,
          ai_pattern_score: forensic.ai_pattern.aiLikelihoodScore,
          flags: forensic.reasons,
          decision: accept ? (strictPass ? 'ACCEPT' : 'ACCEPT_SOFT') : 'REJECT',
          correlation_id: correlationId,
          raw_response_preview: cleanQ.statement.substring(0, 200)
        });

        if (accept) {
          finalQuestions.push({ ...cleanQ, _source: "generated", forensic_score: forensic.fidelity_score });
          seenHashes.add(hash);
          console.log(`[FORENSIC_${strictPass ? 'ACCEPT' : 'ACCEPT_SOFT'}] score=${forensic.fidelity_score} opts=${cleanQ.options.length} banca=${profile.label}`);
        } else {
          console.log(`[FORENSIC_REJECT] score=${forensic.fidelity_score} opts=${cleanQ.options.length} reasons=${forensic.reasons.join(',')}`);
        }
      }
    }

    const partial = finalQuestions.length < requestedCount;
    if (partial) {
      console.warn(`[QUESTION_GEN_PARTIAL] returned=${finalQuestions.length}/${requestedCount} elapsed_ms=${Date.now() - startedAt} deadline_hit=${deadlineReached()}`);
    }

    step = "persist";
    let sessionId = null;
    if (saveToBank) {
      const generated = finalQuestions.filter(q => q._source === "generated");
      if (generated.length > 0) {
        await supabaseAdmin.from("questions_bank").insert(generated.map(q => ({
          user_id: userId, statement: q.statement, options: q.options, correct_index: q.correct,
          explanation: q.explanation, topic: q.topic, difficulty: q.difficulty, board: q.board, is_global: false, review_status: 'approved',
          board_similarity_score: q.forensic_score, quality_tier: q.forensic_score >= 90 ? 'GOLD' : 'SILVER'

        })));
      }
    }

    if (createSession) {
      const { data: sess, error: sessionError } = await supabaseAdmin.from("simulado_sessions").insert({
        user_id: userId, mode: mode, total_questions: finalQuestions.length, status: 'active',
        discipline: specialty, topic: topics[0], difficulty: difficulty,
        source: finalQuestions.every(q => q._source === 'bank') ? 'bank' : 'mixed', started_at: new Date().toISOString(),
        metadata: { board: profile.label, requested_count: requestedCount, correlation_id: correlationId }
      }).select().single();
      if (sessionError) {
        return jsonError("SESSION_CREATE_FAILED", 500, {
          message: sessionError.message,
          code: sessionError.code,
          details: sessionError.details,
          hint: sessionError.hint,
        });
      }
      if (sess) {
        sessionId = sess.id;
        await supabaseAdmin.from("simulado_questions").insert(finalQuestions.map((q, idx) => ({
          session_id: sessionId, question_id: q.id || null, order_index: idx, question_snapshot: q.id ? null : q, is_ai_generated: q._source === "generated"
        })));
      }
    }

    console.log(`[QUESTION_GEN_FINAL_OK] total=${finalQuestions.length}/${requestedCount} partial=${partial} sessionId=${sessionId}`);
    return new Response(JSON.stringify({
      success: true,
      partial,
      requested: requestedCount,
      returned: finalQuestions.length,
      session_id: sessionId,
      sessionId: sessionId,
      questions: finalQuestions,
      total_questions: finalQuestions.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return jsonError("INTERNAL_ERROR", 500, { message: error.message });
  }
}));
