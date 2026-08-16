import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, hasCorruptQuestionText, parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { SIMULADO_MOTOR_PREMIUM, QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";
import { TopicEngine } from "../_shared/topic-engine.ts";
import { validateFinalQuestionTopic } from "../_shared/topic-guard.ts";
import { resolveTopicGranularity, logTopicFidelity } from "../_shared/topic-fidelity/topic-resolver.ts";
import { recordTopicFidelity } from "../_shared/topic-fidelity/telemetry.ts";
import { runAI } from "../_shared/ai-runtime-orchestrator.ts";
import { NVIDIA_MODEL_REGISTRY } from "../_shared/nvidia-provider.ts";

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

const hasUnsafeClinicalLanguage = (parts: string[]): boolean => {
  const normalized = normalizeStatement(parts.join(" "));
  // Known medication-name hallucination observed in production. The valid
  // terms are "nitroglicerina" and "óxido nítrico"; this inverted hybrid is
  // neither and must never be shown as a clinical alternative or rationale.
  return normalized.includes("nitrogeniooxido");
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

    const rawCount = Number(body.count ?? body.questionCount);
    const requestedCount = Math.max(
      1,
      Math.min(Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 5, 100),
    );
    const rawTopics = Array.isArray(body.topics ?? body.selectedTopics)
      ? (body.topics ?? body.selectedTopics)
      : [body.specialty || "Clínica Médica"];
    const sanitizedTopics = (rawTopics as any[])
      .filter((t: any) => typeof t === "string" && t.trim())
      .map((t: string) => t.trim());
    const topics = sanitizedTopics.length > 0
      ? sanitizedTopics
      : [typeof body.specialty === "string" && body.specialty.trim()
        ? body.specialty.trim()
        : "Clínica Médica"];
    const subtopics = Array.isArray(body.subtopics ?? body.selectedSubtopics)
      ? (body.subtopics ?? body.selectedSubtopics)
          .filter((s: any) => typeof s === "string" && s.trim())
          .map((s: string) => s.trim())
      : [];
    const examBoard = body.targetExam || body.examBoard;
    const difficulty = body.difficulty || "misto";

    const topicEngine = new TopicEngine(supabaseAdmin);
    await topicEngine.loadAliases(topics, subtopics);

    // ── TOPIC FIDELITY (Sprint V1 / Fase 2 — observacional) ───────────────────
    try {
      for (const t of topics) {
        const tfResult = resolveTopicGranularity(String(t));
        logTopicFidelity("question-generator", tfResult);
        recordTopicFidelity(supabaseAdmin, {
          source: "question-generator",
          userId,
          result: tfResult,
          metadata: { count: requestedCount, examBoard: examBoard || null, correlationId },
        }).catch(() => {});
      }
    } catch (e: any) {
      console.warn("[TOPIC_FIDELITY_HOOK_ERROR]", e?.message);
    }


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
      const buildBaseQuery = () => supabaseAdmin
        .from("eligible_questions_bank")
        .select("id, statement, options, correct_index, explanation, topic, subtopic, curriculum_theme, curriculum_subtheme, difficulty, board");

      const applyExclusion = (q: any) =>
        excludedIds.length > 0 ? q.not("id", "in", `(${excludedIds.join(",")})`) : q;

      let candidates: any[] = [];
      const allTerms = [...topics, ...subtopics];
      const topicOr = allTerms
        .flatMap((t: string) => [`topic.ilike.%${t}%`, `curriculum_theme.ilike.%${t}%`, `subtopic.ilike.%${t}%`, `curriculum_subtheme.ilike.%${t}%`])
        .join(",");

      let q = buildBaseQuery().or(topicOr);
      q = applyExclusion(q);
      const { data } = await q.limit(requestedCount * 10);
      candidates = data || [];
      
      console.log(`[SIM_GENERATOR_CANDIDATES_FOUND] count=${candidates.length}`);

      for (const q of candidates) {
        if (finalQuestions.length >= requestedCount) break;
        
        const matchResult = topicEngine.calculateScore(q, topics, subtopics);
        
        // FINAL TOPIC GUARD - accept only a match in the complete requested scope.
        const requestedPairs = subtopics.length > 0
          ? topics.flatMap((topic) => subtopics.map((subtopic) => ({ topic, subtopic })))
          : topics.map((topic) => ({ topic, subtopic: undefined }));
        const guardResults = requestedPairs.map(({ topic, subtopic }) =>
          validateFinalQuestionTopic(q, topic, subtopic)
        );
        const guardResult = guardResults.find((result) => result.allowed) ?? guardResults[0];
        const primaryVisibleTopic = typeof q.topic === "string" && !["geral", "general"].includes(normalizeStatement(q.topic))
          ? q.topic
          : q.curriculum_theme;
        const visibleTopic = {
          topic: primaryVisibleTopic,
        };
        const visibleTopicAllowed = topics.some((topic) =>
          validateFinalQuestionTopic(visibleTopic, topic).allowed
        );
        
        if (!guardResult?.allowed || !visibleTopicAllowed) {
          console.log(`[SIM_TOPIC_GUARD_REJECTED] question_id=${q.id} reason=${guardResult?.reason} visible_topic=${primaryVisibleTopic || "missing"} requested=${topics.join("|")}`);
          continue;
        }

        if (
          hasCorruptQuestionText(q.statement) ||
          hasCorruptQuestionText(q.explanation) ||
          (Array.isArray(q.options) && q.options.some(hasCorruptQuestionText))
        ) {
          console.log(`[SIM_TEXT_QUALITY_REJECTED] question_id=${q.id} reason=invalid_encoding`);
          continue;
        }

        const hash = makeHash(q.statement);
        const norm = normalizeStatement(q.statement);
        if (seenHashes.has(hash) || seenNormalized.has(norm)) continue;
        
        finalQuestions.push({ 
          ...q, 
          correct: q.correct_index, 
          _source: "bank",
          _topic_match_score: matchResult.score,
          _match_type: matchResult.matchType,
          _guard: guardResult
        });
        
        seenHashes.add(hash);
        seenNormalized.add(norm);
      }
    }

    if (body.mode === "ai_generation") {
      step = "ai_generation";
      const specificTopic = typeof body.generationContext?.subtopic === "string"
        ? body.generationContext.subtopic.trim()
        : "";
      const focus = [
        `Especialidades: ${topics.join(", ")}`,
        subtopics.length ? `Subtemas obrigatórios: ${subtopics.join(", ")}` : "",
        specificTopic ? `Tema específico obrigatório: ${specificTopic}` : "",
        examBoard ? `Estilo da banca: ${examBoard}` : "",
        `Dificuldade: ${difficulty}`,
      ].filter(Boolean).join("\n");

      const generationMessages = [
        {
          role: "system",
          content: `${QUESTION_MOTOR_PREMIUM}\n\n${SIMULADO_MOTOR_PREMIUM}\n\nSEGURANÇA CLÍNICA OBRIGATÓRIA: cada questão deve ter exatamente cinco alternativas distintas, uma única resposta inequivocamente correta e explicação que justifique a correta e descarte as demais. Não invente doses, indicações, contraindicações, achados de exame ou recomendações. Não associe tratamento a achado sem relação causal. PROIBIDO usar a expressão inexistente "nitrogênio óxido"; quando clinicamente indicado, o fármaco antianginoso correto é nitroglicerina, enquanto "óxido nítrico" é outro composto e não deve ser confundido com ela. Se não tiver segurança factual, não gere a questão. Revise internamente coerência entre caso, pergunta, resposta e explicação antes de retornar.\n\nRetorne SOMENTE JSON válido no formato {"questions":[{"statement":"...","options":["...","...","...","...","..."],"correct":0,"explanation":"...","topic":"...","subtopic":"...","difficulty":"..."}]}. correct é índice numérico de 0 a 4. Não use markdown.`,
        },
        {
          role: "user",
          content: `Gere exatamente ${requestedCount} questões inéditas de múltipla escolha em português brasileiro.\n${focus}`,
        },
      ];

      const aiInput: Parameters<typeof runAI>[0] = {
        taskType: "question_generation",
        // Clinical questions require the reasoning-tier NVIDIA model. Provider
        // fallback remains NVIDIA -> Cerebras -> existing safe fallbacks.
        modelOverride: NVIDIA_MODEL_REGISTRY.reasoning.id,
        specialty: topics[0],
        topic: specificTopic || subtopics[0] || topics[0],
        complexity: difficulty === "facil" ? "medium" : "high",
        requiresReasoning: true,
        requiresJSON: true,
        budgetMode: "premium",
        userId,
        requestId: correlationId,
        supabase: supabaseAdmin,
        messages: generationMessages,
      };

      const appendValidatedQuestions = (aiResult: any): boolean => {
        const parsed = parseAiJson<any>(aiResult.content);
        const generated = Array.isArray(parsed) ? parsed : parsed?.questions;
        if (!Array.isArray(generated)) return false;

        for (const raw of generated) {
        if (finalQuestions.length >= requestedCount) break;
        const statement = cleanQuestionText(raw?.statement || raw?.question || raw?.enunciado);
        const options = Array.isArray(raw?.options || raw?.alternatives)
          ? (raw.options || raw.alternatives).map((option: unknown) => cleanQuestionText(option))
          : [];
        const correct = Number(raw?.correct ?? raw?.correct_index ?? raw?.correctIndex);
        const explanation = cleanQuestionText(raw?.explanation || raw?.rationale || raw?.explicacao);
        const normalizedOptions = options.map((option: string) => normalizeStatement(option));
        if (
          !statement ||
          hasUnsafeClinicalLanguage([statement, ...options, explanation]) ||
          options.length !== 5 ||
          new Set(normalizedOptions).size !== 5 ||
          options.some((option: string) => option.length < 2) ||
          !explanation || explanation.length < 40 ||
          !Number.isInteger(correct) ||
          correct < 0 ||
          correct >= options.length
        ) continue;

        const hash = makeHash(statement);
        const norm = normalizeStatement(statement);
        if (seenHashes.has(hash) || seenNormalized.has(norm)) continue;
        finalQuestions.push({
          statement,
          options,
          correct,
          correct_index: correct,
          explanation,
          topic: cleanQuestionText(raw?.topic) || topics[0],
          subtopic: cleanQuestionText(raw?.subtopic) || subtopics[0] || specificTopic || null,
          difficulty: cleanQuestionText(raw?.difficulty) || difficulty,
          _source: "generated",
          _provider: aiResult.provider,
          _model: aiResult.model,
        });
        seenHashes.add(hash);
        seenNormalized.add(norm);
      }

        return finalQuestions.length > 0;
      };

      const aiResult = await runAI(aiInput);
      if (aiResult.provider === "template" || aiResult.errorCode) {
        throw new Error(aiResult.errorCode || "AI_PROVIDER_UNAVAILABLE");
      }
      appendValidatedQuestions(aiResult);

      // A provider can return syntactically valid but clinically rejected
      // questions. Retry once with the available Cerebras provider and a
      // corrective prompt; the Lovable gateway rejects this payload with 400.
      // never expose the rejected batch and never loop indefinitely.
      if (finalQuestions.length === 0) {
        console.warn(`[AI_QUALITY_RETRY] provider=${aiResult.provider} model=${aiResult.model}`);
        const qualityRetry = await runAI({
          ...aiInput,
          providerOverride: "cerebras",
          modelOverride: "gpt-oss-120b",
          benchmarkMode: true,
          messages: [
            ...generationMessages,
            { role: "user", content: "O lote anterior foi rejeitado por segurança clínica. Gere um lote novo, revise nomenclatura farmacológica e não reutilize alternativas do lote anterior." },
          ],
        });
        if (qualityRetry.provider !== "template" && !qualityRetry.errorCode) {
          appendValidatedQuestions(qualityRetry);
        }
      }

      if (finalQuestions.length === 0) throw new Error("AI_INVALID_RESPONSE: nenhuma questão válida");
    }

    console.log(`[SIM_GENERATOR_DEDUP_APPLIED] after_bank=${finalQuestions.length}`);

    let insufficientQuestions = finalQuestions.length < requestedCount;
    
    if (insufficientQuestions) {
      console.log(`[SIM_INSUFFICIENT_TOPIC_BANK] requested=${requestedCount} final=${finalQuestions.length}`);
    }

    // 4. Persistence
    step = "persist";
    let sessionId = null;
    
    const { data: sess } = await supabaseAdmin.from("simulado_sessions").insert({
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

    if (sess) {
      sessionId = sess.id;
      const persistenceTasks: PromiseLike<any>[] = [];
      const bankQuestions = finalQuestions.filter((q) => q.id);
      if (bankQuestions.length > 0) {
        persistenceTasks.push(supabaseAdmin.from("simulado_questions").insert(
          bankQuestions.map((q, idx) => ({
            session_id: sessionId,
            question_id: q.id,
            order_index: idx,
            is_ai_generated: q._source === "generated"
          }))
        ));
      }
      persistenceTasks.push(supabaseAdmin.from("topic_generation_logs").insert({
          user_id: userId,
          requested_topic: topics[0],
          canonical_topic: topicEngine.identifyCanonical(topics[0]),
          curriculum_competency: subtopics[0] || null,
          matched_question_ids: finalQuestions.map(q => q.id).filter(Boolean),
          insufficient_bank_flag: insufficientQuestions,
          correlation_id: correlationId,
          metadata: {
            requested_count: requestedCount,
            generated_count: finalQuestions.length,
            match_types: finalQuestions.map(q => q._match_type),
            guard_forensics: finalQuestions.map(q => q._guard)
          }
        }));
      await Promise.all(persistenceTasks);
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      sessionId: sessionId,
      questions: finalQuestions,
      requestedCount,
      generatedCount: finalQuestions.length,
      status: finalQuestions.length >= requestedCount ? "complete" : "partial",
      source: body.mode === "ai_generation" ? "ai" : "bank",
      provider: finalQuestions[0]?._provider || null,
      model: finalQuestions[0]?._model || null,
      correlationId,
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
