import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";
import { auditPedagogicalQuality } from "../_shared/cognitive-governance-helpers.ts";
import { requireAuth } from "../_shared/require-auth.ts";

console.log("[TUTOR_01_BOOT]");

const SYSTEM_PROMPT_V3 = `
Você é o TUTOR IA V3 PREMIUM do ENAZIZI, um PRECEPTOR MÉDICO DE ELITE.
Sua missão é atuar como um preceptor de residência médica seguindo rigorosamente a sequência pedagógica ENAZIZI.

REQUISITO ABSOLUTO: RESPOSTA EM JSON
Você deve responder EXCLUSIVAMENTE em formato JSON seguindo este schema:
{
  "success": true,
  "content": "Conteúdo textual do bloco (Markdown permitido). NÃO incluir o título do bloco aqui.",
  "currentBlock": "IDENTIFICADOR_DO_BLOCO",
  "blockTitle": "Título Amigável do Bloco",
  "socraticQuestion": "Uma pergunta curta e provocativa para validar o aprendizado.",
  "shouldWaitForStudent": true,
  "actionsContext": {
    "topic": "Assunto principal",
    "block": "IDENTIFICADOR_DO_BLOCO",
    "keyPoints": ["Ponto 1", "Ponto 2"],
    "clinicalCase": "Caso clínico curto se houver",
    "studentWeakness": "Análise opcional da dúvida do aluno"
  }
}

SEQUÊNCIA OBRIGATÓRIA DE BLOCOS (GATING):
1. BLOCO_1_MISSAO_CLINICA: Objetivo do tema, por que importa na prova/prática, caso clínico curto.
2. BLOCO_2_ROADMAP_COGNITIVO: Caminho da aula, o que será aprendido.
3. BLOCO_3_EXPLICAÇÃO_LEIGA: Analogia simples, base intuitiva.
4. BLOCO_4_EXPLICAÇÃO_TÉCNICA: Fisiopatologia profunda, mecanismos moleculares.
5. BLOCO_5_FISIOPATOLOGIA_VISUAL: Incluir no "content" um JSON de type "clinical_flow".
6. BLOCO_6_RACIOCÍNIO_CLÍNICO: Reconhecimento à beira do leito, pistas clínicas.
7. BLOCO_7_DIAGNÓSTICO_DIFERENCIAL: Pistas para não confundir.
8. BLOCO_8_CONDUTA_E_PRIORIZAÇÃO: Abordagem inicial, tratamento.
9. BLOCO_9_DIRETRIZES_E_EVIDÊNCIAS: SBC, AHA, MS, FEBRASGO 2024-2025.
10. BLOCO_10_QUESTÃO_ESTILO_PROVA: Caso clínico ou questão objetiva.
11. BLOCO_11_CORREÇÃO_COMENTADA: Justificativa.
12. BLOCO_12_ACTIVE_RECALL: Perguntas de revisão ativa.
13. BLOCO_13_FLASHCARDS_AUTOMÁTICOS: Sugestões.
14. BLOCO_14_RESUMO_DE_ALTA_RETENÇÃO: Bullets finais.
15. BLOCO_15_PLANO_DE_RECUPERAÇÃO: Próximos passos.

REGRAS PEDAGÓGICAS:
- Comece SEMPRE pelo BLOCO_1_MISSAO_CLINICA quando um novo tema for introduzido ou na primeira mensagem da sessão.
- Se o aluno falar apenas o nome de uma doença (ex: "IAM", "Sepse"), considere como o início de uma nova explicação no BLOCO_1.
- Nunca pule blocos. Avance apenas um por vez após a resposta do aluno.
- Use o Método Socrático: Não dê a resposta completa de cara, faça o aluno pensar.
- JAMAIS mostre o JSON bruto para o aluno no campo "content", exceto se for o "clinical_flow" estruturado que o frontend já sabe renderizar.
- Se o aluno estiver no meio de um bloco, valide a resposta dele antes de passar o conteúdo do próximo.
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
  console.log("[TUTOR_02_HANDLER_START]");
  
  // 1. AUTHENTICATION
  const auth = await requireAuth(req);

  // 2. BODY PARSING
  let body: any = {};
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") {
      return new Response(JSON.stringify({ ok: true, health: "alive", function: "tutor-v3-premium" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("[TUTOR_09_BODY_PARSE_ERROR]", e.message);
    body = {};
  }

  if (body.healthcheck) {
    return new Response(JSON.stringify({
      ok: true,
      function: "tutor-v3-premium",
      correlation_id: correlation.correlationId
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

  let topic = typeof body.topic === "string" ? body.topic : "Geral";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : crypto.randomUUID();

  // 4. SESSION STATE & PEDAGOGY
  let currentBlock = "BLOCO_1_MISSAO_CLINICA";
  let completedBlocks: string[] = [];
  let sessionTopic = "";
  
  if (sessionId) {
    try {
      const { data: sessionData } = await supabaseAdmin
        .from("tutor_sessions")
        .select("current_block, completed_blocks, topic")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (sessionData) {
        currentBlock = sessionData.current_block || "BLOCO_1_MISSAO_CLINICA";
        completedBlocks = sessionData.completed_blocks || [];
        sessionTopic = sessionData.topic || "";
      }
    } catch (err) {
      console.error("[TUTOR_14_SESSION_FETCH_CRASH]", err.message);
    }
  }

  // Topic detection and reset logic
  if (topic === "Geral") {
    if (sessionTopic && message.length >= 50) {
      topic = sessionTopic;
    } else if (message.length < 50) {
      topic = message;
    }
  }

  // If the user explicitly mentions a new topic or we detected a new one
  if (topic !== "Geral" && sessionTopic && topic.toLowerCase() !== sessionTopic.toLowerCase() && message.length < 50) {
    console.log("[TUTOR_TOPIC_CHANGE] Resetting to Block 1");
    currentBlock = "BLOCO_1_MISSAO_CLINICA";
    completedBlocks = [];
    // Reset session in DB
    await supabaseAdmin.from("tutor_sessions").update({ 
      topic: topic, 
      current_block: "BLOCO_1_MISSAO_CLINICA", 
      completed_blocks: [],
      cognitive_progress: 0
    }).eq("id", sessionId);
  } else if (!sessionTopic && topic !== "Geral") {
     await supabaseAdmin.from("tutor_sessions").update({ topic: topic }).eq("id", sessionId);
  }

  const userId = auth.userId || body.userId || (correlation as any).userId;
  const isLoop = detectCognitiveLoop(message, history);
  const fatigue = estimateStudentFatigue(history);
  
  const cognitiveContext = `
[PEDAGOGICAL STATE]
Current Block: ${currentBlock}
Completed Blocks: ${completedBlocks.join(", ")}
Topic: ${topic}
Mastery: ${masteryState}
Fatigue: ${fatigue.toFixed(2)}

INSTRUCTION: 
If the user is answering a question from the previous block, evaluate it and then provide ONLY the next block.
The block you should provide now is: ${currentBlock}.
If this is the start of a session (no history), start with BLOCO_1_MISSAO_CLINICA.
Always end with a question to validate before moving to the NEXT block.
RESPOND ONLY WITH VALID JSON AS SPECIFIED IN THE SYSTEM PROMPT.
`;

  const aiMessages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}${isLoop ? "\n[RECOVERY: LOOP DETECTADO]" : ""}${cognitiveContext}` },
    ...history.slice(-10).map((m: any) => ({
      role: m.role || "user",
      content: typeof m.content === "string" ? m.content : (m.content?.text || JSON.stringify(m.content)),
    })),
    { role: "user", content: message },
  ];

  // 5. BACKGROUND WORK DEFINITION
  const backgroundWork = async (parsedAi: any, metrics: any) => {
    try {
      if (!userId || !sessionId) return;
      
      const lastBlock = parsedAi.currentBlock;
      if (lastBlock) {
        const blockMap: Record<string, string> = {
          "BLOCO_1_MISSAO_CLINICA": "BLOCO_2_ROADMAP_COGNITIVO",
          "BLOCO_2_ROADMAP_COGNITIVO": "BLOCO_3_EXPLICAÇÃO_LEIGA",
          "BLOCO_3_EXPLICAÇÃO_LEIGA": "BLOCO_4_EXPLICAÇÃO_TÉCNICA",
          "BLOCO_4_EXPLICAÇÃO_TÉCNICA": "BLOCO_5_FISIOPATOLOGIA_VISUAL",
          "BLOCO_5_FISIOPATOLOGIA_VISUAL": "BLOCO_6_RACIOCÍNIO_CLÍNICO",
          "BLOCO_6_RACIOCÍNIO_CLÍNICO": "BLOCO_7_DIAGNÓSTICO_DIFERENCIAL",
          "BLOCO_7_DIAGNÓSTICO_DIFERENCIAL": "BLOCO_8_CONDUTA_E_PRIORIZAÇÃO",
          "BLOCO_8_CONDUTA_E_PRIORIZAÇÃO": "BLOCO_9_DIRETRIZES_E_EVIDÊNCIAS",
          "BLOCO_9_DIRETRIZES_E_EVIDÊNCIAS": "BLOCO_10_QUESTÃO_ESTILO_PROVA",
          "BLOCO_10_QUESTÃO_ESTILO_PROVA": "BLOCO_11_CORREÇÃO_COMENTADA",
          "BLOCO_11_CORREÇÃO_COMENTADA": "BLOCO_12_ACTIVE_RECALL",
          "BLOCO_12_ACTIVE_RECALL": "BLOCO_13_FLASHCARDS_AUTOMÁTICOS",
          "BLOCO_13_FLASHCARDS_AUTOMÁTICOS": "BLOCO_14_RESUMO_DE_ALTA_RETENÇÃO",
          "BLOCO_14_RESUMO_DE_ALTA_RETENÇÃO": "BLOCO_15_PLANO_DE_RECUPERAÇÃO",
          "BLOCO_15_PLANO_DE_RECUPERAÇÃO": "FINISH"
        };

        const newCurrentBlock = blockMap[lastBlock] || lastBlock;
        const newCompletedBlocks = [...new Set([...completedBlocks, lastBlock])];

        const blockNumMatch = lastBlock.match(/BLOCO_(\d+)/);
        const progress = blockNumMatch ? Math.round((parseInt(blockNumMatch[1]) / 15) * 100) : 0;

        await supabaseAdmin.from("tutor_sessions").update({
          current_block: newCurrentBlock,
          completed_blocks: newCompletedBlocks,
          cognitive_progress: progress,
          topic: topic
        }).eq("id", sessionId);
      }

      const finalText = parsedAi.content || "";
      if (finalText.length > 50) {
        await saveTutorMemory(supabaseAdmin, userId, {
          topic,
          content: finalText,
          sessionId: sessionId,
          masteryLevel: masteryState
        });
      }

      if (finalText.length > 100) {
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
    } catch (e) {
      console.warn("[TUTOR_BG_ERROR]", e.message);
    }
  };

  // 6. AI EXECUTION
  try {
    const aiResponse = await ai({
      taskType: "tutor",
      complexity,
      messages: aiMessages,
      userId,
      stream: false, 
      expectedBlock: currentBlock
    });

    let aiRawText = "";
    if (aiResponse instanceof Response) {
      aiRawText = await aiResponse.text();
    } else {
      aiRawText = aiResponse?.choices?.[0]?.message?.content || aiResponse?.content || "";
    }
    
    // Clean JSON from potential markdown blocks
    const cleanedJson = aiRawText.replace(/```json\n?|\n?```/g, "").trim();
    let parsedAi;
    try {
      parsedAi = JSON.parse(cleanedJson);
    } catch (e) {
      console.error("[TUTOR_JSON_PARSE_ERROR]", e.message, cleanedJson);
      parsedAi = {
        success: true,
        content: aiRawText,
        currentBlock: currentBlock,
        blockTitle: "Continuação Pedagógica",
        socraticQuestion: "O que você acha disso?",
        shouldWaitForStudent: true,
        actionsContext: { topic, block: currentBlock }
      };
    }

    const generationMs = Date.now() - runtimeStart;
    const metrics = {
      latency_ms: generationMs,
      generation_ms: generationMs,
      model_used: (aiResponse as any)?.model || "unknown"
    };

    const finalResponse = { 
      ...parsedAi,
      ok: true,
      correlation_id: correlation.correlationId, 
      request_id: correlation.correlationId,
      metrics 
    };
    
    if (waitUntil) waitUntil(backgroundWork(parsedAi, metrics));
    else backgroundWork(parsedAi, metrics); 

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[TUTOR_AI_ERROR]", err.message);
    const fallback = "O preceptor está revisando o caso. Vamos focar no essencial: " + topic + ". Como você abordaria este paciente inicialmente?";
    const errorResponse = { 
      success: true,
      content: fallback, 
      currentBlock: currentBlock,
      blockTitle: "Modo de Segurança",
      socraticQuestion: "Qual sua conduta imediata?",
      shouldWaitForStudent: true,
      actionsContext: { topic, block: currentBlock },
      error: err.message,
      correlation_id: correlation.correlationId
    };
    
    return new Response(JSON.stringify(errorResponse), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}));