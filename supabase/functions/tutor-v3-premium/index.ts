import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";

import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId } = correlation;

  try {
    const body = await req.json();
    const { message, sessionId, currentBlock: bodyBlock, newTopic } = body;

    // GET USER FROM AUTH
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = user?.id;

    if (!userId) {
       throw new Error("UNAUTHORIZED: User not found");
    }

    // FETCH SESSION
    let session = null;
    let sessionTopic = null;
    if (sessionId) {
      const { data } = await supabaseAdmin.from("tutor_sessions").select("current_block, topic").eq("id", sessionId).maybeSingle();
      session = data;
      sessionTopic = data?.topic;
    }

    // currentBlock standard
    let currentBlock = session?.current_block ?? bodyBlock ?? "BLOCO_1_MISSAO_CLINICA";
    
    // HANDLE TOPIC CHANGE
    if (newTopic) {
      logger.info("TOPIC_CHANGE", `Changing topic to: ${newTopic}`);
      sessionTopic = newTopic;
      currentBlock = "BLOCO_1_MISSAO_CLINICA";
      
      if (sessionId) {
        await supabaseAdmin.from("tutor_sessions").update({
          topic: newTopic,
          current_block: currentBlock,
          updated_at: new Date().toISOString()
        }).eq("id", sessionId);
      }
    }

    // LONGITUDINAL MEMORY FETCH
    let memoryContext = "";
    if (userId && sessionTopic) {
      const { data: memoryData } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", userId)
        .eq("topic", sessionTopic)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memoryData) {
        memoryContext = `
[MEMÓRIA LONGITUDINAL DO ALUNO]
- Tema já estudado antes: SIM
- Nível de domínio anterior: ${memoryData.mastery_level || 'Não registrado'}
- Principais erros prévios (Misconceptions): ${memoryData.misconceptions_detected?.join(", ") || 'Nenhum'}
- Analogias que funcionaram: ${memoryData.effective_analogies?.join(", ") || 'Nenhuma'}
- Ponto onde o aluno costuma travar: ${memoryData.explanation_summary || 'Não identificado'}
- Último bloco atingido anteriormente: ${memoryData.block_title || 'Não registrado'}
`;
        logger.info("MEMORY_HYDRATED", `Memory found for topic: ${sessionTopic}`);
      } else {
        memoryContext = `
[MEMÓRIA LONGITUDINAL DO ALUNO]
- Tema já estudado antes: NÃO
`;
      }
    }

    // AI Call using Unified Wrapper
    const aiResponse = await ai({
      taskType: "tutor",
      complexity: "média",
      userId,
      messages: [
        { role: "system", content: `${PROMPT_COMPLETO}\n\nASSUNTO: ${sessionTopic || "Assunto Geral"}\nBLOCO ATUAL: ${currentBlock}\n${memoryContext}` },
        { role: "user", content: newTopic ? `Olá preceptor, quero mudar de assunto para: ${newTopic}. Vamos começar do Bloco 1 com um novo caso clínico.` : message }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }, { skipQualityLock: false });

    const rawContent = aiResponse.choices?.[0]?.message?.content || "{}";
    let parsedContent;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (e) {
      logger.error("AI_PARSE_ERROR", "Error parsing AI response JSON", { rawContent });
      parsedContent = { content: rawContent };
    }

    const content = parsedContent.content || "Ocorreu um erro ao gerar a resposta da IA.";
    const socraticQuestion = parsedContent.socraticQuestion || "";

    // Simple advancement logic (gating)
    let nextBlock = currentBlock;
    const blocks = ["BLOCO_1_MISSAO_CLINICA", "BLOCO_2_ROADMAP", "BLOCO_3_FISIOPATOLOGIA", "BLOCO_4_CONDUTA", "BLOCO_5_INFLEXAO", "BLOCO_6_FECHAMENTO"];
    
    // Check for explicit continuation
    const userWantsNext = !newTopic && (
                          message?.toLowerCase().includes("continuar") || 
                          message?.toLowerCase().includes("próximo") || 
                          message?.toLowerCase().includes("proximo"));

    if (userWantsNext) {
      const currentIndex = blocks.indexOf(currentBlock);
      if (currentIndex !== -1 && currentIndex < blocks.length - 1) {
        nextBlock = blocks[currentIndex + 1];
      }
    }

    // MEMORY UPDATE (PERSISTENCE)
    if (userId && sessionTopic) {
      await supabaseAdmin.from("tutor_learning_memory").upsert({
        user_id: userId,
        topic: sessionTopic,
        block_title: nextBlock,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,topic' });
    }

    // UPDATE SESSION
    if (sessionId && nextBlock !== currentBlock) {
      await supabaseAdmin.from("tutor_sessions").update({
        current_block: nextBlock,
        updated_at: new Date().toISOString()
      }).eq("id", sessionId);
    }

    return corsResponse({
      success: true,
      content: content + (socraticQuestion ? `\n\n${socraticQuestion}` : ""),
      currentBlock: nextBlock,
      topic: sessionTopic,
      teachingMode: parsedContent.teachingMode || "PRECEPTOR",
      interactionMode: parsedContent.interactionMode || "BALANCED_SOCRATIC",
      socraticQuestion: socraticQuestion,
      shouldWaitForStudent: true,
      minimumTeachingDelivered: parsedContent.minimumTeachingDelivered ?? true,
      correlation_id: correlationId,
      request_id: requestId,
      debug_stage: "stable_v3_ready",
      memory_active: !!memoryContext
    }, 200);

  } catch (error) {
    logger.error("FATAL_HANDLER_ERROR", error.message, { stack: error.stack });
    return corsResponse({
      success: true,
      content: "Preceptor ENAZIZI: Tive um pequeno problema técnico, mas estou aqui. Poderia repetir sua última dúvida?",
      currentBlock: "ERROR_RECOVERED",
      shouldWaitForStudent: true,
      debug_stage: "error_fallback",
      error: error.message
    }, 200);
  }
}));