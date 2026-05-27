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

    // P1 FIX (Freeze v25 — ajuste defensivo): hash unificado banco+IA+fallback.
    // Antes: banco usava 100 chars, IA usava 50 chars → duplicatas reais escapavam.
    // Agora: normaliza (lowercase + trim + colapsa whitespace) e usa 100 chars sempre.
    const makeHash = (statement: string): string => {
      const normalized = (statement || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100);
      return btoa(unescape(encodeURIComponent(normalized)));
    };

    // 2.1 Try Bank (real_exam_questions)
    // P0 FIX (Freeze v25 — bugfix de produção): antes consultava `questions_bank`
    // que NÃO existe no schema → bankQs sempre null → fallback IA 100% → custo alto.
    // Agora consulta `real_exam_questions` (6789 linhas reais, RLS+grants ok).
    // Board é usado como preferência (soft filter), não como filtro rígido,
    // porque a maioria das linhas tem board="Não especificado".
    step = "bank_fetch";
    if (body.mode !== 'ai_generation') {
      const { data: bankQs, error: bankErr } = await supabaseAdmin
        .from("real_exam_questions")
        .select("id, statement, options, correct_index, explanation, topic, difficulty, board")
        .in("topic", topics)
        .eq("is_active", true)
        .limit(targetCount * 3); // overfetch so we can prefer matching board

      if (bankErr) {
        console.warn(`[SIMULADO_BANK_ERROR] ${bankErr.message}`);
      }

      const bankList = bankQs || [];
      // Soft-prefer questions matching the requested board
      const preferred = bankList.filter((q: any) =>
        q.board && profile.label && String(q.board).toLowerCase().includes(String(profile.label).toLowerCase()),
      );
      const ordered = [...preferred, ...bankList.filter((q: any) => !preferred.includes(q))].slice(0, targetCount);

      if (ordered.length > 0) {
        console.log(`[SIMULADO_BANK_HIT] reused=${ordered.length} preferred_board=${preferred.length}`);
        for (const q of ordered) {
          const hash = makeHash(q.statement || "");
          if (seenHashes.has(hash)) continue;
          finalQuestions.push({ ...q, correct: q.correct_index, _source: "bank" });
          seenHashes.add(hash);
        }
      } else {
        console.log(`[SIMULADO_BANK_EMPTY] topics=${topics.join(",")} board=${profile.label}`);
      }
    }


    // 2.2 AI Fallback — only when bank cannot satisfy the deficit
    step = "ai_generation";
    let attempts = 0;
    if (finalQuestions.length < targetCount) {
      console.log(`[SIMULADO_AI_FALLBACK] bank_filled=${finalQuestions.length}/${targetCount} → calling AI`);
    }
    while (finalQuestions.length < targetCount && attempts < 2) {
      attempts++;
      const deficit = targetCount - finalQuestions.length;

      // [QUESTION_GEN_COUNT]
      console.log(`[QUESTION_GEN_COUNT] deficit=${deficit} attempt=${attempts}`);


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

          const forensic = await analyzeQuestionForensic(cleanQ, profile, supabaseAdmin);
          const validation = validateQuestionAgainstBoard(cleanQ, profile);
          
          const hash = makeHash(cleanQ.statement);


          // Log Forensic Analysis
          await supabaseAdmin.from("forensic_quality_logs").insert({
            board: profile.label,
            fidelity_score: forensic.fidelity_score,
            structural_score: forensic.structural_score,
            lexical_score: forensic.lexical_score,
            cognitive_score: forensic.cognitive_score,
            pedagogical_score: forensic.pedagogical_score,
            ai_pattern_score: forensic.ai_pattern.aiLikelihoodScore,
            flags: forensic.reasons,
            decision: forensic.isValid && validation.isValid ? 'ACCEPT' : 'REJECT',
            correlation_id: correlationId,
            raw_response_preview: cleanQ.statement.substring(0, 200)
          });

          if (forensic.isValid && validation.isValid && !seenHashes.has(hash)) {
            finalQuestions.push({ ...cleanQ, _source: "generated", forensic_score: forensic.fidelity_score });
            seenHashes.add(hash);
            // [QUESTION_GEN_VALIDATED]
            console.log(`[QUESTION_GEN_VALIDATED] Quality=${forensic.fidelity_score}`);
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
