import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";
import { classifyStudentIntent, decideTutorStep, PEDAGOGICAL_BLOCKS, TutorBlockId } from "../_shared/tutor/pedagogical-logic.ts";


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
          CONTESTO DE MEMÓRIA: ${memoryContext}`
        },
        ...history,
        { role: "user", content: newTopic ? `Olá. Vamos iniciar o tema ${topic}.` : (message || "Continuar aula") }
      ]
    };


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
            intent: studentIntent
          }
        });

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