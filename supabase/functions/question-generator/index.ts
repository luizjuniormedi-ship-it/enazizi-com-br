import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { cleanQuestionText, hasCorruptQuestionText, parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { SIMULADO_MOTOR_PREMIUM, QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock, getOfficialBoardAvailability } from "../_shared/banca-profiles.ts";
import { AI_MODELS, normalizeModel } from "../_shared/ai-models.ts";
import { validateQuestionAgainstBoard } from "../_shared/board-validator.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";
import { TopicEngine } from "../_shared/topic-engine.ts";
import { validateFinalQuestionTopic } from "../_shared/topic-guard.ts";
import { resolveTopicGranularity, logTopicFidelity } from "../_shared/topic-fidelity/topic-resolver.ts";
import { recordTopicFidelity } from "../_shared/topic-fidelity/telemetry.ts";
import { runAI } from "../_shared/ai-runtime-orchestrator.ts";
import { NVIDIA_MODEL_REGISTRY } from "../_shared/nvidia-provider.ts";
import {
  collectPaginatedRows,
  ENAMED_PREPARATORY_FRESHNESS_POLICY,
  getAcceptedVisibleTopicLabels,
  isCanonicalGeneralBlueprint,
  classifyVisibleTopicBucket,
  getCorpusDifficultyPlan,
  selectByDifficultyQuota,
  selectByTopicAndDifficultyQuota,
  type TopicWeight,
} from "./difficulty-quota.ts";

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
  const requestStartedAt = Date.now();
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
    const rawTopicWeights = body.generationContext?.customDistribution ??
      body.generationContext?.topicWeights ?? body.topicWeights;
    const requestedTopicWeights: TopicWeight[] = Array.isArray(rawTopicWeights)
      ? rawTopicWeights
          .filter((item: any) => typeof item?.topic === "string" && item.topic.trim() && Number(item.weight) > 0)
          .map((item: any) => ({
            topic: item.topic.trim(),
            weight: Number(item.weight),
            subtopics: Array.isArray(item.subtopics)
              ? item.subtopics
                  .filter((subtopic: any) => typeof subtopic?.name === "string" && subtopic.name.trim())
                  .map((subtopic: any) => ({ name: subtopic.name.trim() }))
              : undefined,
          }))
          .filter((item: TopicWeight) => topics.includes(item.topic))
      : [];

    const isGeneralHundred = ["geral", "all"].includes(String(examBoard ?? "").trim().toLowerCase()) &&
      requestedCount === 100 && body.mode !== "ai_generation";
    if (isGeneralHundred && !isCanonicalGeneralBlueprint(requestedTopicWeights)) {
      return new Response(JSON.stringify({
        success: false,
        errorCode: "TOPIC_BLUEPRINT_REQUIRED",
        error: "O Preparatório ENAMED de 100 questões exige o blueprint canônico completo.",
        correlationId,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const officialAvailability = body.mode === "prova_real"
      ? getOfficialBoardAvailability(typeof examBoard === "string" ? examBoard : null)
      : null;
    if (officialAvailability && !officialAvailability.canGenerateOfficialExam) {
      logger.warn("OFFICIAL_BOARD_NOT_READY", officialAvailability.reason, {
        board: examBoard,
        status: officialAvailability.status,
        correlationId,
      });
      return new Response(JSON.stringify({
        success: false,
        errorCode: "BOARD_NOT_READY",
        error: officialAvailability.reason,
        board: examBoard,
        boardStatus: officialAvailability.status,
        correlationId,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Historical Dedup (Last 7 days)
    step = "historical_dedup";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const historySnapshotAt = new Date(requestStartedAt).toISOString();
    
    const recentSessions = await collectPaginatedRows<any>(async (from, to) => {
      const { data, error } = await supabaseAdmin.from("simulado_sessions").select("id")
        .eq("user_id", userId).gt("started_at", sevenDaysAgo).lte("started_at", historySnapshotAt).order("id").range(from, to);
      if (error) throw error;
      return data || [];
    });
    const sessionIds = recentSessions.map(s => s.id);

    const practiceHistory = await collectPaginatedRows<any>(async (from, to) => {
      const { data, error } = await supabaseAdmin.from("practice_attempts").select("question_id")
        .eq("user_id", userId).gt("created_at", sevenDaysAgo).lte("created_at", historySnapshotAt).order("id").range(from, to);
      if (error) throw error;
      return data || [];
    });

    const simuladoHistory: any[] = [];
    for (let offset = 0; offset < sessionIds.length; offset += 100) {
      const sessionChunk = sessionIds.slice(offset, offset + 100);
      simuladoHistory.push(...await collectPaginatedRows<any>(async (from, to) => {
        const { data, error } = await supabaseAdmin.from("simulado_questions").select("question_id")
          .in("session_id", sessionChunk).order("id").range(from, to);
        if (error) throw error;
        return data || [];
      }));
    }

    const requestAvoidIds = Array.isArray(body.avoidIds)
      ? body.avoidIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const historicalExcludedIds = Array.from(new Set([
      ...(practiceHistory || []).map(p => p.question_id),
      ...(simuladoHistory || []).map(s => s.question_id),
    ].filter(Boolean)));
    const historicalExcludedIdSet = new Set(historicalExcludedIds);
    const requestAvoidIdSet = new Set(requestAvoidIds);

    console.log(`[SIM_GENERATOR_RECENT_EXCLUDED] historical=${historicalExcludedIds.length} request=${requestAvoidIds.length}`);

    // 2. Fetch from Bank (Strict filtering)
    step = "bank_fetch";
    let finalQuestions: any[] = [];
    let difficultyDistribution: ReturnType<typeof selectByDifficultyQuota<any>> | null = null;
    const difficultyPlan = getCorpusDifficultyPlan(examBoard, difficulty);
    const seenHashes = new Set<string>();
    const seenNormalized = new Set<string>();

    if (body.mode !== 'ai_generation') {
      const buildBaseQuery = () => supabaseAdmin
        .from("eligible_questions_bank")
        .select("id, statement, options, correct_index, explanation, topic, subtopic, curriculum_theme, curriculum_subtheme, difficulty, board");

      let candidates: any[] = [];
      // Keep topic and subtopic scopes in their canonical columns. Mixing topic
      // terms into subtopic columns produced large false-positive candidate
      // windows; the final guard then rejected the whole next page even when
      // the requested board still had enough eligible questions.
      const topicOr = [
        ...topics.flatMap((t: string) => [`topic.ilike.%${t}%`, `curriculum_theme.ilike.%${t}%`]),
        ...subtopics.flatMap((t: string) => [`subtopic.ilike.%${t}%`, `curriculum_subtheme.ilike.%${t}%`]),
      ]
        .join(",");

      const profileTopicCount = Object.keys(profile.specialtyWeights || {}).length;
      const isFullOfficialBlueprint = Boolean(examBoard) &&
        subtopics.length === 0 &&
        profileTopicCount > 0 &&
        topics.length >= profileTopicCount;
      // A full official-exam card already scopes the corpus by exact board.
      // Applying a 20+ clause ILIKE OR over the eligibility view is redundant
      // and can exceed the UI timeout for 100-question exams. Keep that filter
      // only for genuine topic/subtopic selections.
      const buildScopedQuery = (difficultyScore?: number) => {
        let query = isFullOfficialBlueprint ? buildBaseQuery() : buildBaseQuery().or(topicOr);
        if (examBoard && !["all", "geral"].includes(String(examBoard).toLowerCase())) {
          query = query.ilike("board", String(examBoard));
        }
        if (difficultyScore) query = query.eq("difficulty", difficultyScore);
        return query;
      };

      const fetchDifficultyStratum = async (difficultyScore: number) => {
        const rows: any[] = [];
        const pageSize = 200;
        const maxPages = 5;
        for (let page = 0; page < maxPages; page++) {
          const from = page * pageSize;
          const { data, error } = await buildScopedQuery(difficultyScore)
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < pageSize) break;
        }
        return rows;
      };

      if (difficultyPlan && isGeneralHundred) {
        // Fetch each canonical topic x difficulty cell independently so a
        // dominant specialty or difficulty cannot consume another cell's
        // bounded PostgREST window. Queries are short and concurrency-limited.
        const bankFetchStartedAt = Date.now();
        let bankFetchQueries = 0;
        const fetchTopicDifficultyWindow = async (weight: TopicWeight, difficultyScore: number) => {
          const labels = getAcceptedVisibleTopicLabels(weight);
          const visibleTopicOr = labels.flatMap((label) => [
            `topic.ilike.${label}`,
            `curriculum_theme.ilike.${label}`,
          ]).join(",");
          const rows: any[] = [];
          const freshTarget = Math.ceil(requestedCount * weight.weight / 100);
          const pageSize = 100;
          for (let from = 0, pageNumber = 0;; from += pageSize, pageNumber++) {
            if (Date.now() - bankFetchStartedAt > 20_000) {
              throw new Error("BALANCED_FETCH_TIMEOUT: aquisição tema x dificuldade excedeu 20s");
            }
            if (pageNumber >= 20) throw new Error("BALANCED_FETCH_PAGE_LIMIT: célula excedeu 2000 itens sem suficiência fresca");
            bankFetchQueries++;
            const { data, error } = await buildBaseQuery().or(visibleTopicOr)
              .eq("difficulty", difficultyScore).order("id", { ascending: true })
              .range(from, from + pageSize - 1);
            if (error) throw error;
            const page = data || [];
            rows.push(...page);
            const canonicalFresh = rows.filter((question) =>
              !historicalExcludedIdSet.has(question.id) &&
              classifyVisibleTopicBucket(question, [weight])?.bucket === weight.topic
            ).length;
            if (canonicalFresh >= freshTarget || page.length < pageSize) break;
          }
          return rows;
        };
        const cells = requestedTopicWeights.flatMap((weight) => [3, 4, 5].map((score) => ({ weight, score })));
        for (let offset = 0; offset < cells.length; offset += 6) {
          const chunk = cells.slice(offset, offset + 6);
          candidates.push(...(await Promise.all(chunk.map(({ weight, score }) =>
            fetchTopicDifficultyWindow(weight, score)))).flat());
        }
        candidates = Array.from(new Map(candidates.map((question) => [question.id, question])).values());
        console.log(`[SIM_BALANCED_FETCH] queries=${bankFetchQueries} candidates=${candidates.length} duration_ms=${Date.now() - bankFetchStartedAt}`);
      } else if (difficultyPlan) {
        const strata = await Promise.all([3, 4, 5].map(fetchDifficultyStratum));
        candidates = strata.flat();
      } else {
        const { data, error } = await buildScopedQuery()
          .order("id", { ascending: true })
          .limit(Math.max(requestedCount * 4, 200));
        if (error) throw error;
        candidates = data || [];
      }
      
      console.log(`[SIM_GENERATOR_CANDIDATES_FOUND] count=${candidates.length}`);

      const eligibleQuestions: any[] = [];
      for (const q of candidates) {
        // Applying hundreds of UUIDs through PostgREST's URL-based `not.in`
        // can exceed the request-line limit and was previously misreported as
        // an empty bank. The candidate window is bounded, so enforce the same
        // historical exclusion safely in memory.
        if (requestAvoidIdSet.has(q.id)) continue;
        const historicalReuse = historicalExcludedIdSet.has(q.id);
        // Small study sessions remain freshness-first. A 100-question quota
        // may reuse historical items only as a last resort; duplicates inside
        // the current exam are still forbidden by requestAvoidIdSet/hashes.
        if (historicalReuse && !difficultyPlan) continue;
        
        const matchResult = topicEngine.calculateScore(q, topics, subtopics);
        
        // FINAL TOPIC GUARD - accept only a match in the complete requested scope.
        const requestedPairs = subtopics.length > 0
          ? topics.flatMap((topic) => subtopics.map((subtopic) => ({ topic, subtopic })))
          : topics.map((topic) => ({ topic, subtopic: undefined }));
        const guardResults = requestedPairs.map((pair) => ({
          pair,
          result: validateFinalQuestionTopic(q, pair.topic, pair.subtopic),
        }));
        const allowedGuard = guardResults.find((entry) => entry.result.allowed) ?? guardResults[0];
        const guardResult = allowedGuard?.result;
        const primaryVisibleTopic = typeof q.topic === "string" && !["geral", "general"].includes(normalizeStatement(q.topic))
          ? q.topic
          : q.curriculum_theme;
        const visibleTopic = {
          topic: primaryVisibleTopic,
        };
        const visibleTopicAllowed = topics.some((topic) =>
          validateFinalQuestionTopic(visibleTopic, topic).allowed
        );
        const visibleTopicClassification = requestedTopicWeights.length > 0
          ? classifyVisibleTopicBucket(q, requestedTopicWeights)
          : null;
        const topicAllowed = requestedTopicWeights.length > 0
          ? Boolean(visibleTopicClassification)
          : Boolean(guardResult?.allowed && visibleTopicAllowed);
        
        if (!topicAllowed) {
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
        
        eligibleQuestions.push({
          ...q, 
          correct: q.correct_index, 
          _source: "bank",
          _topic_match_score: matchResult.score,
          _match_type: matchResult.matchType,
          _guard: guardResult,
          _historical_reuse: historicalReuse,
          _requested_topic: visibleTopicClassification?.bucket || allowedGuard?.pair.topic,
          _visible_topic: visibleTopicClassification?.visibleTopic || primaryVisibleTopic,
          _topic_bucket: visibleTopicClassification?.bucket || allowedGuard?.pair.topic,
          _difficulty_bucket: difficultyPlan
            ? (q.difficulty === 3 ? "easy" : q.difficulty === 4 ? "medium" : q.difficulty === 5 ? "hard" : "unclassified")
            : undefined,
        });
        
        seenHashes.add(hash);
        seenNormalized.add(norm);

        if (!difficultyPlan && eligibleQuestions.length >= requestedCount) {
          break;
        }
      }

      if (difficultyPlan) {
        const quotaOptions = isGeneralHundred
          ? { freshnessPolicy: ENAMED_PREPARATORY_FRESHNESS_POLICY }
          : undefined;
        difficultyDistribution = requestedTopicWeights.length > 0
          ? selectByTopicAndDifficultyQuota(eligibleQuestions, requestedCount, difficultyPlan.mix, requestedTopicWeights, quotaOptions)
          : selectByDifficultyQuota(eligibleQuestions, requestedCount, difficultyPlan.mix, quotaOptions);
        finalQuestions = difficultyDistribution.questions;
        console.log(`[SIM_DIFFICULTY_QUOTA] target=${JSON.stringify(difficultyDistribution.target)} actual=${JSON.stringify(difficultyDistribution.actual)} available=${JSON.stringify(difficultyDistribution.available)} shortage=${JSON.stringify(difficultyDistribution.shortage)} exact=${difficultyDistribution.exact}`);
        if (difficultyDistribution.topicTarget) {
          console.log(`[SIM_TOPIC_QUOTA] target=${JSON.stringify(difficultyDistribution.topicTarget)} actual=${JSON.stringify(difficultyDistribution.topicActual)} shortage=${JSON.stringify(difficultyDistribution.topicShortage)} classification=visible-topic-blueprint-v1 exact=${difficultyDistribution.exact}`);
        }
      } else {
        finalQuestions = eligibleQuestions.slice(0, requestedCount);
      }
    }

    if (isGeneralHundred && difficultyDistribution && !difficultyDistribution.exact) {
      const difficultyMetadata = {
        target: difficultyDistribution.target,
        actual: difficultyDistribution.actual,
        shortage: difficultyDistribution.shortage,
        topicTarget: difficultyDistribution.topicTarget,
        topicActual: difficultyDistribution.topicActual,
        topicShortage: difficultyDistribution.topicShortage,
        freshnessPolicy: difficultyDistribution.freshnessPolicy,
        freshnessActual: difficultyDistribution.freshnessActual,
      };
      return new Response(JSON.stringify({
        success: false,
        errorCode: difficultyDistribution.freshnessActual?.blockedByReuseLimit
          ? "FRESHNESS_SHORTAGE"
          : "QUOTA_SHORTAGE",
        error: difficultyDistribution.freshnessActual?.blockedByReuseLimit
          ? "O corpus recente não permite montar 100 questões dentro do limite de reutilização."
          : "O corpus não permite montar 100 questões respeitando simultaneamente tema e dificuldade.",
        difficultyDistribution: difficultyMetadata,
        correlationId,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          topic: topics[0],
          subtopic: specificTopic || subtopics[0] || cleanQuestionText(raw?.subtopic) || cleanQuestionText(raw?.topic) || null,
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
    const persistedSources = new Set(finalQuestions.map((question) =>
      question._source === "generated" ? "ai" : "bank"
    ));
    const sessionSource = persistedSources.size > 1
      ? "mixed"
      : (persistedSources.values().next().value || (body.mode === "ai_generation" ? "ai" : "bank"));
    
    if (insufficientQuestions) {
      console.log(`[SIM_INSUFFICIENT_TOPIC_BANK] requested=${requestedCount} final=${finalQuestions.length}`);
    }

    // 4. Persistence
    step = "persist";
    let sessionId = null;
    const generationDurationMs = Date.now() - requestStartedAt;
    const difficultyMetadata = difficultyDistribution
      ? {
          target: difficultyDistribution.target,
          actual: difficultyDistribution.actual,
          available: difficultyDistribution.available,
          shortage: difficultyDistribution.shortage,
          exact: difficultyDistribution.exact,
          scale: difficultyPlan?.scale,
          calibrationStatus: difficultyPlan?.calibrationStatus,
          historicalReuseCount: difficultyDistribution.historicalReuseCount,
          historicalReuseIds: difficultyDistribution.questions.filter((q) => q._historical_reuse).map((q) => q.id),
          freshnessPolicy: difficultyDistribution.freshnessPolicy,
          freshnessActual: difficultyDistribution.freshnessActual,
          topicTarget: difficultyDistribution.topicTarget,
          topicActual: difficultyDistribution.topicActual,
          topicShortage: difficultyDistribution.topicShortage,
          topicClassification: difficultyDistribution.topicTarget ? "visible-topic-blueprint-v1" : null,
          unclassifiedTopicCount: difficultyDistribution.topicTarget
            ? difficultyDistribution.questions.filter((q) => !q._topic_bucket).length
            : 0,
        }
      : null;

    const { data: sess, error: sessionError } = await supabaseAdmin.from("simulado_sessions").insert({
      user_id: userId,
      mode: body.mode || 'study',
      total_questions: finalQuestions.length,
      status: 'active',
      discipline: body.specialty || topics[0],
      topic: topics[0],
      difficulty: difficulty,
      source: sessionSource,
      started_at: new Date().toISOString(),
      metadata: { 
        board: profile.label, 
        requested: requestedCount, 
        insufficientQuestions,
        correlation_id: correlationId,
        generation_duration_ms: generationDurationMs,
        difficulty_distribution: difficultyMetadata,
      }
    }).select().single();

    if (sessionError || !sess) throw sessionError || new Error("Falha ao persistir sessão do simulado");
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
    const persistenceResults = await Promise.all(persistenceTasks);
    const persistenceError = persistenceResults.find((result) => result?.error)?.error;
    if (persistenceError) throw persistenceError;
    if (bankQuestions.length > 0) {
      const { count: persistedCount, error: countError } = await supabaseAdmin
        .from("simulado_questions")
        .select("question_id", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if (countError) throw countError;
      if (persistedCount !== bankQuestions.length) {
        throw new Error(`Persistência incompleta: ${persistedCount ?? 0}/${bankQuestions.length} questões vinculadas`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      sessionId: sessionId,
      questions: finalQuestions,
      requestedCount,
      generatedCount: finalQuestions.length,
      status: finalQuestions.length >= requestedCount ? "complete" : "partial",
      source: sessionSource,
      provider: finalQuestions[0]?._provider || null,
      model: finalQuestions[0]?._model || null,
      correlationId,
      insufficientQuestions,
      generationDurationMs,
      difficultyDistribution: difficultyMetadata,
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
