import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";
import { classifyStudentIntent, decideTutorStep, PEDAGOGICAL_BLOCKS, TutorBlockId } from "../_shared/tutor/pedagogical-logic.ts";
import { lookupTutorMemory, lookupRagSemantic, markMemoryReused, saveTutorMemory, estimateQualityScore } from "../_shared/tutor-memory.ts";
import { decideMemoryAction } from "../_shared/memory-orchestrator.ts";

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

    if (!userId) throw new Error("UNAUTHORIZED: Session required");

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

    // ── 2. LONGITUDINAL MEMORY SYNC ──────────────────────────────────────────────
    let memoryContext = "";
    let masteryLevel = "INITIAL";
    let recoveryMode = false;
    
    if (userId && topic) {
      const { data: mem } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", userId)
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
          lookupTutorMemory(supabaseAdmin, userQuestion, { userId, topic, specialty: null }),
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
    waitUntil((async () => {
      try {
        await supabaseAdmin.from("memory_orchestration_traces").insert({
          user_id: userId,
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

    if (useMemoryDirect && memoryHit) {
      waitUntil(bumpMetric(supabaseAdmin, decision.action === "use_as_is" ? "exact_hits" : "semantic_hits"));
      waitUntil((async () => {
        await markMemoryReused(supabaseAdmin, memoryHit!.id);
        if (sessionId && userId) {
          await supabaseAdmin.from("tutor_messages").insert({
            tutor_session_id: sessionId,
            user_id: userId,
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

      return corsResponse({
        success: true,
        ok: true,
        content: memoryHit.answer,
        currentBlock: nextBlock,
        blockTitle: currentBlockConfig.title,
        teachingPhase: "ENSINAR",
        shouldWaitForStudent: true,
        socraticQuestion: "",
        actionsContext: { topic, block: nextBlock },
        topic,
        correlation_id: correlationId,
        fromMemory: true,
        memoryId: memoryHit.id,
        memoryReuseCount: memoryHit.reuseCount + 1,
        memoryQualityScore: memoryHit.qualityScore,
        memoryScope: memoryHit.scope,
        memoryBlocks: memoryHit.blocks,
        promotionStatus: memoryHit.promotionStatus,
        orchestratorAction: decision.action,
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


    const aiConfig: any = {
      taskType: "tutor_deep",
      complexity: "alta",
      userId,
      stream: false, // Force JSON for structured orchestration
      response_format: { type: "json_object" },
      messages: [
        { 
          role: "system", 
          content: `${PROMPT_COMPLETO}
          
          # OBJETIVO OBRIGATÓRIO DO MOMENTO:
          Você está no ${nextBlock}: ${currentBlockConfig.title}.
          Sua missão única agora: ${blockObjective}

          # REGRAS DE SAÍDA JSON:
          Você DEVE retornar um JSON com:
          {
            "content": "Sua explicação em Markdown",
            "socraticQuestion": "Uma pergunta para o aluno",
            "teachingPhase": "ENSINAR",
            "shouldWaitForStudent": true,
            "actionsContext": {
              "topic": "${topic}",
              "block": "${nextBlock}"
            }
          }
          
          TEMA ATUAL: ${topic}
          CONTESTO DE MEMÓRIA: ${memoryContext}${ragContext}`
        },
        ...history,
        { role: "user", content: newTopic ? `Olá. Vamos iniciar o tema ${topic}.` : (message || "Continuar aula") }
      ]
    };

    console.log("[MEMORY_MISS_OPENAI]", { topic, qLen: userQuestion.length, action: decision.action });
    waitUntil(bumpMetric(supabaseAdmin, "openai_calls"));
    const aiResponse = await ai(aiConfig, { retries: 2 });

    // ── 4. STABILITY & PARSING ───────────────────────────────
    const rawAi = aiResponse.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawAi);
    } catch (e) {
      console.error("[TUTOR_JSON_PARSE_ERROR]", e, rawAi);
      parsed = { 
        content: rawAi, 
        socraticQuestion: "Ficou clara essa explicação?",
        teachingPhase: "ENSINAR",
        shouldWaitForStudent: true
      };
    }


    // ── 5. IDEMPOTENT PERSISTENCE ──────────────────────────
    waitUntil((async () => {
      if (userId && topic) {
        await supabaseAdmin.from("tutor_learning_memory").upsert({
          user_id: userId,
          topic: topic,
          block_title: nextBlock,
          mastery_level: parsed.mastery_level || masteryLevel,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,topic' });

        if (sessionId) {
          await supabaseAdmin.from("tutor_sessions").update({
            current_block: nextBlock,
            updated_at: new Date().toISOString()
          }).eq("id", sessionId);
        }
        
        await supabaseAdmin.from("tutor_messages").insert({
          tutor_session_id: sessionId,
          user_id: userId,
          role: "assistant",
          content: parsed.content || "Resposta processada.",
          metadata: { 
            request_id: requestId, 
            correlation_id: correlationId,
            block: nextBlock,
            blockTitle: currentBlockConfig.title,
            intent: studentIntent,
            socraticQuestion: parsed.socraticQuestion,
            actionsContext: parsed.actionsContext
          }

        });

      }

      // Save em tutor_knowledge_memory (global) — só quando houve pergunta real do aluno.
      // Quality gate v22.1 bloqueia respostas ruins automaticamente.
      if (userQuestion.length >= 8 && (parsed.content || "").length >= 60 && studentIntent !== "new_topic") {
        const answerText = parsed.content || "";
        const autoQuality = estimateQualityScore(answerText);
        const savedId = await saveTutorMemory(supabaseAdmin, {
          question: userQuestion,
          answer: answerText,
          blocks: parsed.blocks || [],
          topic,
          specialty: null,
          qualityScore: autoQuality,
          modelUsed: aiResponse?.model || "openai",
          source: "tutor_v3",
          scope: "global",
          teachingMode: nextBlock,
        });
        if (savedId) {
          await bumpMetric(supabaseAdmin, "saves");
        } else {
          await bumpMetric(supabaseAdmin, "rejected_saves");
        }
      }
    })());


    return corsResponse({
      success: true,
      ok: true,
      content: parsed.content || "Tutor V3 respondeu.",
      currentBlock: nextBlock,
      blockTitle: currentBlockConfig.title,
      teachingPhase: parsed.teachingPhase || "ENSINAR",
      shouldWaitForStudent: parsed.shouldWaitForStudent ?? true,
      socraticQuestion: parsed.socraticQuestion || "",
      actionsContext: parsed.actionsContext || { topic, block: nextBlock },
      topic,
      correlation_id: correlationId,
      debug: {
        studentIntent,
        nextBlock
      }
    }, 200);


  } catch (err) {
    logger.critical("HARDENED_RUNTIME_CRASH", err.message);
    return corsResponse({
      success: true,
      ok: true,
      content: "Tutor V3 em modo seguro. Vamos começar pelo essencial do tema.",
      currentBlock: "BLOCO_1_MISSAO_CLINICA",
      shouldWaitForStudent: true,
      error: err.message,
      request_id: requestId
    }, 200);
  }
}));