import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";
import { classifyStudentIntent, decideTutorStep, PEDAGOGICAL_BLOCKS, TutorBlockId } from "../_shared/tutor/pedagogical-logic.ts";
import { lookupTutorMemory, lookupRagSemantic, markMemoryReused, saveTutorMemory, estimateQualityScore } from "../_shared/tutor-memory.ts";
import { decideMemoryAction } from "../_shared/memory-orchestrator.ts";
import { detectQuestionReview, buildQRInstruction, REASONING_ERROR_ENUM } from "../_shared/tutor/question-review-detector.ts";
import { normalizeTutorResponse, TutorResponse } from "../_shared/ai-stability-kit.ts";


// Métrica fire-and-forget — nunca trava o fluxo.
async function bumpMetric(supabaseAdmin: any, field: string, delta = 1) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await supabaseAdmin.rpc("memory_metrics_increment", { _day: day, _field: field, _delta: delta });
  } catch (e: any) {
    console.warn("[MEMORY_METRIC_ERROR]", field, e?.message);
  }
}


console.log("[TUTOR_V3_BOOT] Function module loaded");

/**
 * TUTOR V3 PREMIUM — ENTERPRISE HARDENING v6
 * Final centralization and duplication cleanup.
 */
Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation, waitUntil }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    const body = await req.json().catch(() => ({}));
    
    // [TUTOR_V3_OFFICIAL_CLIENT_CALL] - Requirement validation log
    console.log(`[TUTOR_V3_OFFICIAL_CLIENT_CALL] requestId=${requestId} userId=${userId}`);

    // 0. HEALTHCHECK PRE-FLIGHT
    if (body.healthcheck) {
      return corsResponse({ 
        success: true, 
        ok: true, 
        message: "Tutor V3 Premium is operational.",
        requestId 
      }, 200);
    }

    // In development/test with placeholder tokens, allow bypass
    const isTestToken = req.headers.get("authorization")?.includes("ACCESS_TOKEN_PLACEHOLDER");
    if (!userId && !isTestToken) throw new Error("UNAUTHORIZED: Session required");

    // Mock userId for test tokens to allow safe_mode/fallback testing
    const activeUserId = userId || "095cf92f-427d-48e1-accc-31b357b2fa50";

    const { message, sessionId, currentBlock: bodyBlock, newTopic, pedagogicalContext, stream = true, history = [] } = body;

    // ── 1. SESSION RECOVERY & HYDRATION ──────────────────────────────────────────
    let session = null;
    let topic = newTopic || pedagogicalContext?.topic || body.topic;
    
    if (sessionId) {
      const { data, error } = await supabaseAdmin
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (!error && data) {
        session = data;
        if (!topic) topic = session?.topic;
      }
    }

    if (!topic) topic = "Medicina Geral";

    // ── 1.5 QR MODE V3 (Question Review) — Fase 1.3 ─────────────────────────────
    // Detecta intent "question_review" e responde em modo corretor pedagógico.
    // Curto-circuito: bypassa 9 blocos, memória, RAG e persistência de aula.
    const qr = detectQuestionReview(body, message || "");
    if (qr.isQuestionReview) {
      console.log("[QR_MODE_ACTIVATED]", { reason: qr.reason, signals: qr.signals, partial: qr.partial });

      const qrSystemPrompt = `${PROMPT_COMPLETO}\n\n${buildQRInstruction(qr.context, qr.partial)}`;
      const qrAiConfig: any = {
        taskType: "tutor_deep",
        complexity: "alta",
        userId,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: qrSystemPrompt },
          ...history,
          { role: "user", content: message || "Por favor, corrija minha resposta para esta questão." },
        ],
      };

      let qrParsed: any = {};
      let qrRaw = "{}";
      try {
        // QR Mode tem régua de qualidade própria (enum + JSON schema).
        // Bypassa Quality Lock dos 15 blocos pedagógicos do Tutor normal.
        const qrResponse = await ai(qrAiConfig, { retries: 2, skipQualityLock: true });
        qrRaw = qrResponse.choices?.[0]?.message?.content || "{}";
        // [TEMP DIAGNOSTIC — REMOVE AFTER FASE 1.4]
        console.log("[QR_MODE_RAW]", qrRaw?.slice?.(0, 500));
        console.log("[QR_MODE_RAW_KEYS]", (() => { try { return Object.keys(JSON.parse(qrRaw)); } catch { return "PARSE_FAIL"; } })());
        qrParsed = JSON.parse(qrRaw);
      } catch (e: any) {
        console.error("[QR_MODE_PARSE_ERROR]", e?.message, qrRaw.slice(0, 200));
        qrParsed = { content: qrRaw || "Não foi possível gerar a correção agora.", metadata: null };
      }

      // Sanitização defensiva do enum
      const meta = qrParsed.metadata || {};
      if (meta.reasoning_error && !REASONING_ERROR_ENUM.includes(meta.reasoning_error)) {
        console.warn("[QR_MODE_ENUM_DRIFT]", meta.reasoning_error);
        meta.reasoning_error = "Conhecimento insuficiente";
        meta.confidence = "low";
      }
      if (qr.partial && meta.confidence !== "low") meta.confidence = "low";

      return corsResponse({
        success: true,
        ok: true,
        mode: "question_review",
        content: qrParsed.content || "Correção indisponível no momento.",
        metadata: meta,
        topic,
        correlation_id: correlationId,
        debug: { qrReason: qr.reason, qrSignals: qr.signals, qrPartial: qr.partial },
      }, 200);
    }


    // ── 2. LONGITUDINAL MEMORY SYNC ──────────────────────────────────────────────
    let memoryContext = "";
    let masteryLevel = "INITIAL";
    let recoveryMode = false;
    
    if (activeUserId && topic) {
      const { data: mem } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", activeUserId)
        .eq("topic", topic)
        .maybeSingle();
      
      if (mem) {
        masteryLevel = mem.mastery_level || "INITIAL";
        recoveryMode = masteryLevel === "RECOVERY" || (mem.comprehension_score !== null && mem.comprehension_score < 40);
        
        memoryContext = `
[MEMÓRIA COGNITIVA LONGITUDINAL]
- Nível de Domínio: ${masteryLevel}
- Erros em Provas Anteriores: ${mem.misconceptions_detected?.join(", ") || "Nenhum"}
- Blocos Teóricos já Vistos: ${mem.block_title || "Introdução"}
`;
      }
    }

    // ── 3. PEDAGOGICAL ORCHESTRATION (DETERMINISTIC) ──────────────────────
    const prevBlock = (session?.current_block as TutorBlockId) || (bodyBlock as TutorBlockId) || "BLOCO_1_MISSAO_CLINICA";
    const studentIntent = newTopic ? "new_topic" : classifyStudentIntent(message || "");
    const { nextBlock, stayInBlock } = decideTutorStep(prevBlock, studentIntent);
    
    const currentBlockConfig = PEDAGOGICAL_BLOCKS[nextBlock];
    const blockObjective = currentBlockConfig.objective;

    console.log(`[TUTOR_PEDAGOGICAL_DECISION] prev=${prevBlock} intent=${studentIntent} next=${nextBlock}`);

    // [AI COST REDUCTION] ── HYBRID TUTOR: CHECK LOCAL KNOWLEDGE ──────────────────
    const searchTerms = [message || "", topic || ""].join(" ");
    const localFallback = getStaticFallback(searchTerms);
    
    // If we have a premium local summary and the user is asking a basic question
    if (localFallback && (studentIntent === "doubt" || studentIntent === "new_topic") && searchTerms.length < 100) {
      console.log("[LOCAL_KNOWLEDGE_USED]", { topic: localFallback.tema });
      
      const normalizedLocal = normalizeTutorResponse(localFallback, "fallback");
      
      // AI Cost Validation: Log saved cost for local fallback
      waitUntil((async () => {
        try {
          await supabaseAdmin.from("ai_usage_logs").insert({
            user_id: activeUserId,
            model: "local_premium_fallback",
            module: "tutor-v3-premium",
            cache_status: "fallback",
            cache_hit: true,
            cost_saved: 0.01, // Est. value of a tutor call
            success: true,
            latency_ms: 5,
            prompt_type: "doubt_fallback"
          });
        } catch (e) {
          console.warn("[LOG_SAVINGS_FAIL]", (e as any)?.message);
        }
      })());

      return corsResponse({
        success: true,
        ok: true,
        content: normalizedLocal.content,
        currentBlock: nextBlock,
        blockTitle: currentBlockConfig.title,
        teachingPhase: normalizedLocal.teachingPhase,
        shouldWaitForStudent: true,
        socraticQuestion: normalizedLocal.socraticQuestion,
        actionsContext: { topic, block: nextBlock },
        topic,
        correlation_id: correlationId,
        source: "fallback",
        debug: { hybrid_hit: true }
      }, 200);
    }



    // ── 3.5 MEMORY LOOKUP (Tutor knowledge memory + RAG em paralelo) ────────
    // 🚨 P0 EMERGENCY BYPASS — DISABLE_TUTOR_MEMORY flag (v29 incident response)
    const MEMORY_DISABLED = (Deno.env.get("DISABLE_TUTOR_MEMORY") || "").toLowerCase() === "true";
    if (MEMORY_DISABLED) console.log("[TUTOR_SAFE_MODE] DISABLE_TUTOR_MEMORY=true — skipping memory/RAG/trace");

    const userQuestion = (message || "").trim();
    let memoryHit: Awaited<ReturnType<typeof lookupTutorMemory>> = null;
    let ragHits: Awaited<ReturnType<typeof lookupRagSemantic>> = [];

    if (!MEMORY_DISABLED && !newTopic && userQuestion.length >= 8 && studentIntent !== "new_topic") {
      // Lookup paralelo defensivo: memória + RAG nunca devem travar o Tutor
      try {
        const [m, r] = await Promise.all([
          lookupTutorMemory(supabaseAdmin, userQuestion, { userId: activeUserId, topic, specialty: null }),
          lookupRagSemantic(supabaseAdmin, userQuestion, 3),
        ]);
        memoryHit = m;
        ragHits = r;
      } catch (e: any) {
        console.warn("[MEMORY_LOOKUP_FAIL_SOFT]", e?.message);
        memoryHit = null;
        ragHits = [];
      }
    }

    if (!MEMORY_DISABLED) {
      waitUntil(bumpMetric(supabaseAdmin, "total_lookups"));
      if (ragHits.length > 0) waitUntil(bumpMetric(supabaseAdmin, "rag_hits"));
    }

    // Orchestrator decide o que fazer com o hit
    const decision = MEMORY_DISABLED
      ? { action: "regenerate_fresh" as const, reason: "safe_mode", useRagContext: false, memoryId: null as any }
      : decideMemoryAction({
          memoryHit,
          ragHits,
          userProfile: { cognitiveStage: null, difficultyLevel: null },
        });

    const useMemoryDirect = !MEMORY_DISABLED && (decision.action === "use_as_is" || decision.action === "use_with_rag");

    // Fire-and-forget orchestration trace (v23 observability)
    // Fire-and-forget orchestration trace (v23 observability) — bypass em modo seguro
    if (!MEMORY_DISABLED) {
      waitUntil((async () => {
        try {
          await supabaseAdmin.from("memory_orchestration_traces").insert({
            user_id: activeUserId,
            function_name: "tutor-v3-premium",
            question_preview: userQuestion.slice(0, 200),
            exact_hit: !!memoryHit && (memoryHit as any).matchType === "exact",
            semantic_hit: !!memoryHit && (memoryHit as any).matchType !== "exact",
            rag_hit: ragHits.length > 0,
            openai_called: !useMemoryDirect,
            memory_id: memoryHit?.id ?? null,
            orchestrator_action: decision.action,
            orchestrator_reason: decision.reason,
            similarity: memoryHit?.similarity ?? null,
            ab_compared: decision.action === "regenerate_and_compare",
          });
        } catch (e) {
          console.warn("[MEMORY_TRACE_INSERT_FAIL]", (e as any)?.message);
        }
      })());
    }

    if (useMemoryDirect && memoryHit) {
      waitUntil(bumpMetric(supabaseAdmin, decision.action === "use_as_is" ? "exact_hits" : "semantic_hits"));
      waitUntil((async () => {
        await markMemoryReused(supabaseAdmin, memoryHit!.id);
        
        // AI Cost Validation: Log cache savings
        try {
          await supabaseAdmin.from("ai_usage_logs").insert({
            user_id: activeUserId,
            model: "tutor_semantic_cache",
            module: "tutor-v3-premium",
            cache_status: "hit",
            cache_hit: true,
            cost_saved: 0.015,
            success: true,
            latency_ms: 50,
            prompt_type: "semantic_hit",
            request_id: requestId
          });
        } catch (e) {
          console.warn("[LOG_CACHE_SAVINGS_FAIL]", (e as any)?.message);
        }

        if (sessionId && activeUserId) {
          await supabaseAdmin.from("tutor_messages").insert({
            tutor_session_id: sessionId,
            user_id: activeUserId,
            role: "assistant",
            content: memoryHit!.answer,
            metadata: {
              request_id: requestId,
              correlation_id: correlationId,
              block: nextBlock,
              fromMemory: true,
              memoryId: memoryHit!.id,
              memoryReuseCount: memoryHit!.reuseCount + 1,
              memoryQualityScore: memoryHit!.qualityScore,
              promotionStatus: memoryHit!.promotionStatus,
              orchestratorAction: decision.action,
            },
          });
        }
      })());

      const normalized = normalizeTutorResponse(memoryHit, "cache");
      console.log(`[TUTOR_CACHE_HIT] memoryId=${memoryHit.id}`);

      return corsResponse({
        success: true,
        ok: true,
        content: normalized.content,
        currentBlock: nextBlock,
        blockTitle: currentBlockConfig.title,
        teachingPhase: normalized.teachingPhase,
        shouldWaitForStudent: true,
        socraticQuestion: normalized.socraticQuestion,
        actionsContext: { topic, block: nextBlock },
        topic,
        correlation_id: correlationId,
        fromMemory: true,
        memoryId: memoryHit.id,
        source: "cache",
        debug: { studentIntent, nextBlock, memoryHit: true, similarity: memoryHit.similarity, action: decision.action },
      }, 200);
    }



    // ── 3.6 RAG context para enriquecer prompt quando regeneramos ───────────
    let ragContext = "";
    if (decision.useRagContext && ragHits.length > 0) {
      ragContext = "\n\n[CONTEXTO RAG RELEVANTE]\n" +
        ragHits.map((h, i) => `(${i + 1}) ${h.content.slice(0, 600)}`).join("\n---\n");
    }
    if (decision.action === "regenerate_and_compare") {
      console.log("[MEMORY_AB_REGEN_PROCEED]", { memoryId: decision.memoryId });
    }

    // Determine current block from session or decision
    const activeBlock = nextBlock;
    const activeBlockConfig = currentBlockConfig;
    const activeBlockObjective = blockObjective;


    // Determine Cost Tier for AI Routing
    let costTier: "LOW_COST" | "NORMAL" | "PREMIUM" = "NORMAL";
    if (recoveryMode || masteryLevel === "EXPERT") costTier = "PREMIUM";
    if (studentIntent === "doubt" && userQuestion.length < 50) costTier = "LOW_COST";

    // [EMERGENCY RECOVERY] If AI Routing indicates critical instability, force local fallback
    const CIRCUIT_BREAKER_FORCED = (Deno.env.get("FORCE_TUTOR_FALLBACK") || "").toLowerCase() === "true";
    if (CIRCUIT_BREAKER_FORCED) {
      console.warn("[TUTOR_CIRCUIT_BREAKER] Forced fallback active via environment");
      throw new Error("CIRCUIT_BREAKER: Forced local fallback mode");
    }

    const aiConfig: any = {
      taskType: "tutor_deep",
      complexity: "alta",
      costTier,
      userId,
      stream: false, // Force JSON for structured orchestration
      response_format: { type: "json_object" },
      messages: [
        { 
          role: "system", 
          content: `${PROMPT_COMPLETO}
          
          # OBJETIVO OBRIGATÓRIO DO MOMENTO:
          Você está no ${activeBlock}: ${activeBlockConfig.title}.
          Sua missão única agora: ${activeBlockObjective}

          # REGRAS DE SAÍDA JSON:
          Você DEVE retornar um JSON com:
          {
            "content": "Sua explicação em Markdown",
            "socraticQuestion": "Uma pergunta para o aluno",
            "teachingPhase": "ENSINAR",
            "shouldWaitForStudent": true,
            "actionsContext": {
              "topic": "${topic}",
              "block": "${activeBlock}"
            }
          }
          
          TEMA ATUAL: ${topic}
          CONTEXTO ENAMED 2026: ${JSON.stringify(body.enamedContext || {})}
          CONTESTO DE MEMÓRIA: ${memoryContext}${ragContext}`
        },
        ...history,
        { role: "user", content: newTopic ? `Olá. Vamos iniciar o tema ${topic}.` : (message || "Continuar aula") }
      ]
    };


    console.log("[TUTOR_RUNAI_START]", { topic, qLen: userQuestion.length, action: decision.action });
    waitUntil(bumpMetric(supabaseAdmin, "openai_calls"));
    
    const aiConfigToRun = {
      ...aiConfig,
      taskType: "tutor_chat" as any, 
      topic,
      complexity: "high" as any
    };

    const aiResponse = await ai(aiConfigToRun, { retries: 2 });
    const latencyEnd = Date.now();
    console.log("[TUTOR_RUNAI_OK]");

    // AI Cost Validation: Log actual usage
    waitUntil((async () => {
      try {
        const usage = aiResponse.usage || { prompt_tokens: 0, completion_tokens: 0 };
        await supabaseAdmin.from("ai_usage_logs").insert({
          user_id: userId,
          model: aiResponse.model || "openai/gpt-4o-mini",
          module: "tutor-v3-premium",
          cache_status: "miss",
          cache_hit: false,
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          tokens_used: usage.prompt_tokens + usage.completion_tokens,
          cost_estimate: ((usage.prompt_tokens / 1000000) * 0.15) + ((usage.completion_tokens / 1000000) * 0.60),
          success: true,
          latency_ms: latencyEnd - (body.startTime || Date.now()),
          request_id: requestId,
          prompt_type: "tutor_deep"
        });
      } catch (e) {
        console.warn("[LOG_USAGE_FAIL]", (e as any)?.message);
      }
    })());




    // ── 4. STABILITY & PARSING ───────────────────────────────
    const normalized = normalizeTutorResponse(aiResponse, aiResponse.choices ? "openai" : "fallback");
    
    if (normalized.source === "fallback") {
      console.log("[TUTOR_FALLBACK_ACTIVATED]");
    }

    console.log(`[TUTOR_RESPONSE_NORMALIZED] source=${normalized.source} confidence=${normalized.confidence}`);
    
    if (!normalized.content || normalized.content.trim().length === 0) {
      console.error("[TUTOR_EMPTY_RESPONSE_BLOCKED]");
      throw new Error("Empty AI response detected after normalization");
    }

    // ── 5. IDEMPOTENT PERSISTENCE ──────────────────────────
    waitUntil((async () => {
      if (userId && topic) {
        await supabaseAdmin.from("tutor_learning_memory").upsert({
          user_id: userId,
          topic: topic,
          block_title: activeBlock,
          mastery_level: (normalized.metadata as any)?.mastery_level || masteryLevel,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,topic' });

        if (sessionId) {
          await supabaseAdmin.from("tutor_sessions").update({
            current_block: activeBlock,
            updated_at: new Date().toISOString()
          }).eq("id", sessionId);
        }
        
        await supabaseAdmin.from("tutor_messages").insert({
          tutor_session_id: sessionId,
          user_id: userId,
          role: "assistant",
          content: normalized.content,
          metadata: { 
            request_id: requestId, 
            correlation_id: correlationId,
            block: activeBlock,
            blockTitle: activeBlockConfig.title,
            intent: studentIntent,
            socraticQuestion: normalized.socraticQuestion,
            source: normalized.source
          }
        });
      }


      // Save em tutor_knowledge_memory (LGPD-SAFE — Opção C / Hardening v25.1):
      // Toda memória nasce PRIVADA (scope='user'). Promoção para 'global' acontece
      // exclusivamente via tutor-memory-promotion-cron, que sanitiza PII antes.
      if (!MEMORY_DISABLED && userQuestion.length >= 8 && (normalized.content || "").length >= 60 && studentIntent !== "new_topic") {
        const answerText = normalized.content || "";
        const autoQuality = estimateQualityScore(answerText);
        const savedId = await saveTutorMemory(supabaseAdmin, {
          question: userQuestion,
          answer: answerText,
          blocks: (normalized.metadata as any)?.blocks || [],
          topic,
          specialty: null,
          qualityScore: autoQuality,
          modelUsed: aiResponse?.model || "openai",
          source: "tutor_v3",
          scope: "user",
          userId,
          teachingMode: activeBlock,
        });
        if (savedId) {
          console.log("[TUTOR_MEMORY_PRIVATE_SAVE]", { savedId, userId, topic });
          await bumpMetric(supabaseAdmin, "saves");
        } else {
          await bumpMetric(supabaseAdmin, "rejected_saves");
        }
      }
    })());


    return corsResponse({
      success: true,
      ok: true,
      content: normalized.content,
      currentBlock: activeBlock,
      blockTitle: activeBlockConfig.title,
      teachingPhase: normalized.teachingPhase,
      shouldWaitForStudent: true,
      socraticQuestion: normalized.socraticQuestion,
      actionsContext: (normalized.metadata as any)?.actionsContext || { topic, block: activeBlock },
      topic,
      correlation_id: correlationId,
      source: normalized.source,
      debug: {
        studentIntent,
        nextBlock: activeBlock
      }
    }, 200);



  } catch (err: any) {
    logger.critical("HARDENED_RUNTIME_CRASH", err.message);
    console.log("[TUTOR_SAFE_MODE]");
    const safeResponse = normalizeTutorResponse(null, "safe_mode");
    return corsResponse({
      success: true,
      ok: true,
      content: safeResponse.content,
      currentBlock: "BLOCO_1_MISSAO_CLINICA",
      teachingPhase: safeResponse.teachingPhase,
      socraticQuestion: safeResponse.socraticQuestion,
      shouldWaitForStudent: true,
      source: "safe_mode",
      debug_stage: "safe_mode_emergency",
      error: err.message,
      request_id: requestId
    }, 200);
  }


}));