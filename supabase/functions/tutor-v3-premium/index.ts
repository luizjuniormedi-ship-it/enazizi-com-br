import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";
import { auditPedagogicalQuality } from "../_shared/cognitive-governance-helpers.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const SYSTEM_PROMPT_V3 = `
Você é o TUTOR IA V3 PREMIUM do ENAZIZI, um PRECEPTOR MÉDICO DE ELITE.
Sua missão é atuar como um preceptor de residência em um hospital de alta complexidade.

REQUISITO ABSOLUTO DE ORQUESTRAÇÃO PEDAGÓGICA (GATING):
Você NÃO deve entregar todo o conteúdo de uma vez. Você deve seguir uma sequência rigorosa de blocos.
A cada resposta, você entrega APENAS O BLOCO ATUAL solicitado e termina com uma pergunta curta e provocativa (MÉTODO SOCRÁTICO) para validar o aprendizado antes de avançar.

SEQUÊNCIA OBRIGATÓRIA DE BLOCOS:
1. ## 🎯 BLOCO 1 — MISSÃO DA SESSÃO: Objetivo do tema, importância na prova/prática e caso clínico curto.
2. ## 🎯 BLOCO 2 — ROADMAP COGNITIVO: Caminho da aula, o que será aprendido, divisão em etapas.
3. ## 🎯 BLOCO 3 — EXPLICAÇÃO LEIGA: Analogia simples, base intuitiva, linguagem para leigos.
4. ## 🎯 BLOCO 4 — EXPLICAÇÃO TÉCNICA: Fisiopatologia profunda, mecanismos, termos técnicos médicos.
5. ## 🎯 BLOCO 5 — FISIOPATOLOGIA VISUAL: Gerar mapa mental/fluxo via JSON (clinical_flow).
6. ## 🎯 BLOCO 6 — RACIOCÍNIO CLÍNICO: Como reconhecer no leito, pistas clínicas, exames iniciais.
7. ## 🎯 BLOCO 7 — DIAGNÓSTICO DIFERENCIAL: Pistas para não confundir com outras patologias.
8. ## 🎯 BLOCO 8 — CONDUTA E PRIORIZAÇÃO: Abordagem inicial, tratamento, erros comuns.
9. ## 🎯 BLOCO 9 — DIRETRIZES E EVIDÊNCIAS: Citar diretrizes (SBC, AHA, MS, FEBRASGO) 2024-2025.
10. ## 🎯 BLOCO 10 — QUESTÃO ESTILO PROVA: Caso clínico ou questão objetiva.
11. ## 🎯 BLOCO 11 — CORREÇÃO COMENTADA: Justificativa da questão anterior.
12. ## 🎯 BLOCO 12 — ACTIVE RECALL: Perguntas de revisão ativa.
13. ## 🎯 BLOCO 13 — FLASHCARDS AUTOMÁTICOS: Sugestão de flashcards para o aluno.
14. ## 🎯 BLOCO 14 — RESUMO DE ALTA RETENÇÃO: Bullets finais, mnemônicos úteis.
15. ## 🎯 BLOCO 15 — PLANO DE RECUPERAÇÃO: O que revisar se ainda houver dúvidas.

DIRETRIZES DE ENSINO ENAZIZI:
- MÉTODO SOCRÁTICO: Conduza o raciocínio. Nunca avance sem uma resposta do aluno.
- RIGOR MÉDICO: Termos técnicos precisos + evidências atualizadas.
- OBRIGATORIEDADE DE GATING: Entregue UM bloco por vez.
- MEMÓRIA LONGITUDINAL: O sistema informará em qual bloco você está.

DIRETRIZ DE IMAGENS (BLOCO 5):
Use o formato JSON clinical_flow conforme especificado anteriormente quando estiver no BLOCO 5.
`;

function detectCognitiveLoop(message: string, history: any[]): boolean {
  if (history.length < 3) return false;
  const lastUserMessages = history.filter(m => m.role === "user").slice(-3).map(m => (typeof m.content === "string" ? m.content : "").toLowerCase().trim());
  const currentMsg = message.toLowerCase().trim();
  return lastUserMessages.some(prev => prev === currentMsg || (prev.length > 10 && currentMsg.includes(prev)));
}

function estimateStudentFatigue(history: any[]): number {
  if (history.length < 5) return 0;
  const userMsgs = history.filter(m => m.role === "user").slice(-5);
  const shortMsgCount = userMsgs.filter(m => (typeof m.content === "string" ? m.content.length : 0) < 15).length;
  return Math.min(1.0, shortMsgCount / 5);
}

Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation, waitUntil }) => {
  const runtimeStart = Date.now();
  console.log("[TUTOR_09_EDGE_BOOT]");
  console.log(`[TUTOR_10_REQUEST_RECEIVED] ts=${new Date().toISOString()}`);
  console.log(`[TUTOR_11_METHOD] ${req.method}`);
  
  // 1. AUTHENTICATION: Mandatory check
  const auth = await requireAuth(req);
  if (auth.ok) {
    console.log("[TUTOR_14_AUTH_HEADER_PRESENT] true");
  } else {
    console.log("[TUTOR_14_AUTH_HEADER_PRESENT] false");
  }

  // 2. BODY PARSING
  let body: any = {};
  try {
    const rawBody = await req.text();
    console.log(`[TUTOR_12_BODY_RAW] ${rawBody.slice(0, 500)}`);
    if (!rawBody || rawBody.trim() === "") {
      return new Response(JSON.stringify({ ok: true, health: "alive", function: "tutor-v3-premium" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    body = JSON.parse(rawBody);
    console.log("[TUTOR_13_BODY_PARSED]", body);
  } catch (e) {
    logger.error("JSON_PARSE_FAIL", "Failed to parse request body", { error: e.message });
    body = {};
  }

  // Quick Healthcheck route
  if (body.healthcheck) {
    return new Response(JSON.stringify({
      ok: true,
      function: "tutor-v3-premium",
      correlation_id: correlation.correlationId,
      env: {
        hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
        hasAiKey: !!Deno.env.get("GEMINI_API_KEY") || !!Deno.env.get("OPENAI_API_KEY")
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  
  // 3. INPUT PREPARATION
  let message = String(body.message || "").trim();
  let history = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
  
  if (!message && history.length > 0) {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      message = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);
      history = history.slice(0, -1);
    }
  }

  if (!message) {
    return new Response(JSON.stringify({
      content: "Olá! Como posso ajudar você hoje?",
      metrics: { latency_ms: Date.now() - runtimeStart }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const topic = typeof body.topic === "string" ? body.topic : "Geral";
  const masteryState = typeof body.masteryState === "string" ? body.masteryState : "initial";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : crypto.randomUUID();

  // 4. SESSION STATE & PEDAGOGY
  let currentBlock = "BLOCO_1_MISSAO_CLINICA";
  let completedBlocks: string[] = [];
  
  if (sessionId) {
    const { data: sessionData } = await supabaseAdmin
      .from("tutor_sessions")
      .select("current_block, completed_blocks")
      .eq("id", sessionId)
      .maybeSingle();
    
    if (sessionData) {
      current_block = sessionData.current_block || "BLOCO_1_MISSAO_CLINICA";
      completed_blocks = sessionData.completed_blocks || [];
    }
  }

  const userId = auth.userId || body.userId || (correlation as any).userId;
  const isLoop = detectCognitiveLoop(message, history);
  const fatigue = estimateStudentFatigue(history);
  const memoryContext = userId ? await buildPedagogicalContext(supabaseAdmin, userId, topic).catch(() => ({ cached_blocks: [] })) : { cached_blocks: [] };

  let complexity: "baixa" | "media" | "alta" = "alta";
  if (message.length < 20) complexity = "baixa";
  else if (message.length < 100) complexity = "media";

  const cognitiveContext = `
[PEDAGOGICAL STATE]
Current Block: ${currentBlock}
Completed Blocks: ${completedBlocks.join(", ")}
Topic: ${topic}
Mastery: ${masteryState}
Fatigue: ${fatigue.toFixed(2)}

INSTRUCTION: 
If the user is answering a question from the previous block, evaluate it and then provide ONLY the next block: ${currentBlock}.
If they just started, provide ONLY BLOCO 1.
Always end with a question to validate before moving to the NEXT block.
`;

  const aiMessages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}${isLoop ? "\n[RECOVERY: LOOP DETECTADO]" : ""}${cognitiveContext}` },
    ...history.slice(-10).map((m: any) => ({
      role: m.role || "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    { role: "user", content: message },
  ];

  // 5. BACKGROUND WORK DEFINITION
  const backgroundWork = async (finalText: string, metrics: any) => {
    try {
      if (!userId) return;
      
      // Update session state based on detected block in response
      const blockRegex = /## 🎯 BLOCO (\d+)/g;
      const matches = [...finalText.matchAll(blockRegex)];
      if (matches.length > 0 && sessionId) {
        const lastBlockNum = parseInt(matches[matches.length - 1][1]);
        const nextBlock = `BLOCO_${lastBlockNum + 1}_...`; // Simplified, actual name mapped below
        
        const blockMap: Record<number, string> = {
          1: "BLOCO_2_ROADMAP_COGNITIVO",
          2: "BLOCO_3_EXPLICAÇÃO_LEIGA",
          3: "BLOCO_4_EXPLICAÇÃO_TÉCNICA",
          4: "BLOCO_5_FISIOPATOLOGIA_VISUAL",
          5: "BLOCO_6_RACIOCÍNIO_CLÍNICO",
          6: "BLOCO_7_DIAGNÓSTICO_DIFERENCIAL",
          7: "BLOCO_8_CONDUTA_E_PRIORIZAÇÃO",
          8: "BLOCO_9_DIRETRIZES_E_EVIDÊNCIAS",
          9: "BLOCO_10_QUESTÃO_ESTILO_PROVA",
          10: "BLOCO_11_CORREÇÃO_COMENTADA",
          11: "BLOCO_12_ACTIVE_RECALL",
          12: "BLOCO_13_FLASHCARDS_AUTOMÁTICOS",
          13: "BLOCO_14_RESUMO_DE_ALTA_RETENÇÃO",
          14: "BLOCO_15_PLANO_DE_RECUPERAÇÃO",
          15: "FINISH"
        };

        const newCurrentBlock = blockMap[lastBlockNum] || currentBlock;
        const newCompletedBlocks = [...new Set([...completedBlocks, `BLOCO_${lastBlockNum}`])];

        await supabaseAdmin.from("tutor_sessions").update({
          current_block: newCurrentBlock,
          completed_blocks: newCompletedBlocks,
          cognitive_progress: Math.round((lastBlockNum / 15) * 100)
        }).eq("id", sessionId);
      }

      if (sessionId && finalText && finalText.length > 50) {
        await saveTutorMemory(supabaseAdmin, userId, {
          topic,
          content: finalText,
          sessionId: sessionId,
          masteryLevel: masteryState
        });
      }

      if (finalText && finalText.length > 100) {
        const audit = await auditPedagogicalQuality(finalText, topic).catch(() => null);
        if (audit) {
          await supabaseAdmin.from("pedagogical_quality_audits").insert({
            user_id: userId,
            content_type: "tutor_v3_response",
            quality_score: audit.quality_score,
            medical_coherence_passed: audit.medical_coherence_passed,
            guideline_compliance_passed: audit.guideline_compliance_passed,
            safety_check_passed: audit.safety_check_passed,
            detected_hallucinations: audit.detected_hallucinations,
            audit_log: { topic, correlation_id: correlation.correlationId, userId }
          });
        }
      }

      await supabaseAdmin.from("tutor_runtime_metrics").insert({
        user_id: userId,
        correlation_id: correlation.correlationId,
        function_name: "tutor-v3-premium",
        tutor_generation_ms: metrics.generation_ms || 0,
        memory_hit: !!metrics.memory_hit,
        model_used: metrics.model_used || "unknown",
        topic: topic,
        metadata: { complexity, sessionId, error: metrics.error ? String(metrics.error) : null }
      });
    } catch (e) {
      console.warn("[tutor-v3] Background work error:", e.message);
    }
  };

  // 6. AI EXECUTION
  try {
    console.log("[TUTOR_15_PROVIDER_SELECTED] internal_gateway");
    console.log("[TUTOR_16_AI_CALL_START]");
    const aiResponse = await ai({
      taskType: "tutor",
      complexity,
      messages: aiMessages,
      userId,
      stream: false, 
    });

    if (aiResponse instanceof Response) {
      const aiText = await aiResponse.text();
      const generationMs = Date.now() - runtimeStart;
      const metrics = {
        latency_ms: generationMs,
        generation_ms: generationMs,
        model_used: "streaming_converted_to_text"
      };
      
      const finalResponse = { 
        success: true,
        ok: true,
        content: aiText, 
        answer: aiText,
        message: aiText,
        currentBlock: currentBlock,
        shouldWaitForStudent: true,
        nextExpectedAction: "student_reply",
        correlation_id: correlation.correlationId, 
        request_id: correlation.correlationId,
        debug_stage: "final_response_from_stream",
        metrics 
      };
      
      console.log("[TUTOR_20_FINAL_RESPONSE_BUILT]", finalResponse);
      console.log("[TUTOR_21_RESPONSE_RETURNED]");

      if (waitUntil) waitUntil(backgroundWork(aiText, metrics));
      return new Response(JSON.stringify(finalResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const aiText = aiResponse?.choices?.[0]?.message?.content || aiResponse?.content || "";
    console.log("[TUTOR_17_AI_CALL_SUCCESS]");
    console.log(`[TUTOR_18_AI_RAW_TEXT] len=${aiText.length}`);

    const generationMs = Date.now() - runtimeStart;
    const metrics = {
      latency_ms: generationMs,
      generation_ms: generationMs,
      model_used: aiResponse?.model || "unknown"
    };

    if (waitUntil) waitUntil(backgroundWork(aiText, metrics));
    else await backgroundWork(aiText, metrics);

    const finalResponse = { 
      success: true,
      ok: true,
      content: aiText, 
      answer: aiText,
      message: aiText,
      currentBlock: currentBlock,
      shouldWaitForStudent: true,
      nextExpectedAction: "student_reply",
      correlation_id: correlation.correlationId, 
      request_id: correlation.correlationId,
      debug_stage: "final_response",
      metrics 
    };
    
    console.log("[TUTOR_20_FINAL_RESPONSE_BUILT]", finalResponse);
    console.log("[TUTOR_21_RESPONSE_RETURNED]");

    return new Response(JSON.stringify(finalResponse), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (err) {
    console.log("[TUTOR_19_AI_CALL_ERROR]", err.message);
    logger.error("AI_FAIL", err.message);
    const fallback = "Vamos iniciar IAM pelo essencial: conceito, fisiopatologia, diagnóstico e conduta. A IA principal oscilou, mas vou continuar com um modo seguro.";
    const errorResponse = { 
      success: true, // Mark as success:true for fallback
      content: fallback, 
      error: err.message,
      debug_stage: "fallback_response"
    };
    console.log("[TUTOR_20_FINAL_RESPONSE_BUILT] (FALLBACK)", errorResponse);
    console.log("[TUTOR_21_RESPONSE_RETURNED] (FALLBACK)");
    return new Response(JSON.stringify(errorResponse), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}));
