import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";
import { auditPedagogicalQuality } from "../_shared/cognitive-governance-helpers.ts";

const SYSTEM_PROMPT_V3 = `
Você é o TUTOR IA V3 PREMIUM do ENAZIZI, um PRECEPTOR MÉDICO DE ELITE.
Sua missão é atuar como um preceptor de residência em um hospital de alta complexidade.

REQUISITO CRÍTICO DE FORMATAÇÃO (O NÃO CUMPRIMENTO RESULTARÁ EM REJEIÇÃO DO SISTEMA):
Você DEVE incluir exatamente estes 15 cabeçalhos no início de cada seção correspondente, sem alterações no texto do cabeçalho:

## 🎯 BLOCO 1 — MISSÃO DA SESSÃO
## 🎯 BLOCO 2 — ROADMAP COGNITIVO
## 🎯 BLOCO 3 — EXPLICAÇÃO LEIGA
## 🎯 BLOCO 4 — EXPLICAÇÃO TÉCNICA
## 🎯 BLOCO 5 — FISIOPATOLOGIA VISUAL
## 🎯 BLOCO 6 — RACIOCÍNIO CLÍNICO
## 🎯 BLOCO 7 — DIAGNÓSTICO DIFERENCIAL
## 🎯 BLOCO 8 — PEGADINHAS DE PROVA
## 🎯 BLOCO 9 — DIRETRIZES E EVIDÊNCIAS
## 🎯 BLOCO 10 — QUESTÃO GUIADA
## 🎯 BLOCO 11 — CORREÇÃO COMENTADA
## 🎯 BLOCO 12 — ACTIVE RECALL
## 🎯 BLOCO 13 — FLASHCARDS AUTOMÁTICOS
## 🎯 BLOCO 14 — RESUMO ESTRATÉGICO
## 🎯 BLOCO 15 — PLANO DE RECUPERAÇÃO

DIRETRIZES:
- NUNCA responda como um chatbot comum.
- Use o Método Socrático: faça perguntas que levem o aluno à conclusão.
- Integre disciplinas (ex: correlacione Fisiologia com Farmacologia).
- Seja rigoroso com guidelines (Harrison, Nelson, Sabiston).
- Adapte a profundidade com base no FSRS e Mastery State fornecidos.
- Se detectar cansaço ou erro recorrente, ative RECOVERY MODE.
- MEMÓRIA LONGITUDINAL: Utilize o histórico de explicações e analogias já fornecidas para evitar redundância e garantir continuidade.
- OBRIGATORIEDADE: Todos os 15 blocos devem estar presentes em TODAS as explicações completas de tópicos.
`;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NULL_UUID = "00000000-0000-0000-0000-000000000000";

function isValidUUID(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (!UUID_REGEX.test(v)) return false;
  if (v === NULL_UUID) return false;
  if (v.startsWith("00000000") || v.includes("fake") || v.includes("test")) return false;
  return true;
}

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
  
  // 1. HARDENING: Resilient Body Parsing
  let body: any = {};
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") {
      return new Response(JSON.stringify({ 
        ok: true, 
        health: "alive", 
        function: "tutor-v3-premium",
        correlation_id: correlation.correlationId,
        timestamp: new Date().toISOString()
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    body = JSON.parse(rawBody);
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
      timestamp: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
        hasServiceRole: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        hasAiKey: !!Deno.env.get("GEMINI_API_KEY") || !!Deno.env.get("OPENAI_API_KEY")
      }
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
  
  // 2. HARDENING: Input Validation & Sanitization
  let message = String(body.message || "").trim();
  let history = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
  
  if (!message && history.length > 0) {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      message = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);
      history = history.slice(0, -1);
    }
  }

  const context = body.context && typeof body.context === "object" ? body.context : {};
  const topic = typeof body.topic === "string" ? body.topic : "Geral";
  const fsrsContext = body.fsrsContext && typeof body.fsrsContext === "object" ? body.fsrsContext : {};
  const masteryState = typeof body.masteryState === "string" ? body.masteryState : "initial";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : crypto.randomUUID();
  const userId = correlation.userId || body.userId || body.user_id;

  if (!message && !body.healthcheck) {
    logger.warn("EMPTY_MESSAGE", "Received empty message, returning early.");
    return new Response(JSON.stringify({
      content: "Olá! Sou seu Tutor ENAZIZI. Como posso ajudar você hoje? Digite um tema médico para começarmos.",
      correlation_id: correlation.correlationId,
      metrics: { latency_ms: Date.now() - runtimeStart, tokens_used: 0, memory_hit: false }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  logger.info("TUTOR_V3_REQUEST_BODY", "Processed payload", {
    correlationId: correlation.correlationId,
    userId,
    topic,
    msgLength: message.length,
    historyLength: history.length,
    hasSessionId: !!sessionId
  });

  if (!userId) {
    logger.error("MISSING_USER_ID", "No User ID found");
    return new Response(JSON.stringify({
      error: "Authentication required",
      message: "User identity could not be verified.",
      correlation_id: correlation.correlationId
    }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  logger.info("TUTOR_V3_AUTH_OK", "User authenticated", { userId });

  // 3. GOVERNANCE: Cognitive Checks
  const isLoop = detectCognitiveLoop(message, history);
  const fatigue = estimateStudentFatigue(history);
  const isHighFatigue = fatigue > 0.8;

  // 4. MEMORY HYDRATION
  const memoryLookupStart = Date.now();
  let memoryContext;
  try {
    memoryContext = await buildPedagogicalContext(supabaseAdmin, userId, topic);
  } catch (e) {
    logger.warn("MEMORY_LOOKUP_FAIL", (e as Error).message);
    memoryContext = { cached_blocks: [] };
  }
  const memoryLookupMs = Date.now() - memoryLookupStart;

  // 5. AI EXECUTION
  let complexity: "baixa" | "media" | "alta" = "alta";
  const msgLower = message.toLowerCase();
  const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|e ai|ei)/i.test(msgLower);
  if (isGreeting || isHighFatigue || message.length < 20) complexity = "baixa";
  else if (message.length < 100) complexity = "media";

  const cognitiveContext = `\n[COGNITIVE STATE] Mastery: ${masteryState}, Fatigue: ${fatigue.toFixed(2)}, Topic: ${topic}`;
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}${isLoop ? "\n[RECOVERY: LOOP DETECTADO]" : ""}${cognitiveContext}` },
    ...history.slice(-6).map((m: any) => ({
      role: m.role || "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    { role: "user", content: message },
  ];

  const aiStart = Date.now();
  let aiResponse;
  let aiText = "";
  let aiError = null;

  // 6. BACKGROUND WORK: Definition
  const backgroundWork = async (finalText: string, metrics: any) => {
    try {
      if (sessionId && finalText) {
        await saveTutorMemory(supabaseAdmin, userId, {
          topic,
          content: finalText,
          sessionId: sessionId,
          masteryLevel: masteryState
        });
      }

      if (finalText) {
        const audit = await auditPedagogicalQuality(finalText, topic);
        await supabaseAdmin.from("pedagogical_quality_audits").insert({
          content_type: "tutor_v3_response",
          quality_score: audit.quality_score,
          medical_coherence_passed: audit.medical_coherence_passed,
          guideline_compliance_passed: audit.guideline_compliance_passed,
          safety_check_passed: audit.safety_check_passed,
          detected_hallucinations: audit.detected_hallucinations,
          audit_log: { topic, correlation_id: correlation.correlationId, userId }
        });
      }

      await supabaseAdmin.from("tutor_runtime_metrics").insert({
        user_id: userId,
        correlation_id: correlation.correlationId,
        function_name: "tutor-v3-premium",
        tutor_generation_ms: metrics.generation_ms,
        memory_lookup_ms: memoryLookupMs,
        memory_hit: !!metrics.memory_hit,
        prompt_tokens: metrics.prompt_tokens || 0,
        completion_tokens: metrics.completion_tokens || 0,
        model_used: metrics.model_used || "unknown",
        topic: topic,
        metadata: { 
          complexity, 
          is_loop: isLoop, 
          fatigue, 
          sessionId,
          error: metrics.error ? String(metrics.error) : null 
        }
      });
    } catch (e) {
      console.warn("[tutor-v3] Background work failed:", e.message);
    }
  };

  try {
    aiResponse = await ai({
      taskType: "tutor",
      complexity,
      messages,
      userId,
      stream: true, 
    });

    if (aiResponse instanceof Response) {
      logger.info("TUTOR_V3_STREAM_START", "Starting streaming response");
      if (waitUntil) {
        waitUntil(backgroundWork("", { generation_ms: 0, memory_hit: false, model_used: "streaming" }));
      }
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
      });
    }
    
    aiText = aiResponse?.choices?.[0]?.message?.content || aiResponse?.content || "";
    logger.info("TUTOR_V3_AI_PROXY_STATUS", "AI Success", { model: aiResponse?.model });
  } catch (err) {
    aiError = err;
    logger.error("TUTOR_V3_FAILURE_POINT", "AI_PROXY_FAIL", { error: err.message });
    aiText = "Sou seu Tutor ENAZIZI. Tivemos uma instabilidade temporária ao processar sua dúvida sobre " + topic + ", mas posso continuar te ajudando com um resumo clínico estratégico do tema. O que especificamente você gostaria de revisar sobre esse tópico agora?";
  }

  const generationMs = Date.now() - aiStart;
  const memoryHit = (memoryContext.cached_blocks?.length ?? 0) > 0;

  const metrics = {
    latency_ms: Date.now() - runtimeStart,
    generation_ms: generationMs,
    memory_hit: !!memoryHit,
    complexity,
    tokens_used: (aiResponse?.usage?.prompt_tokens || 0) + (aiResponse?.usage?.completion_tokens || 0),
    prompt_tokens: aiResponse?.usage?.prompt_tokens || 0,
    completion_tokens: aiResponse?.usage?.completion_tokens || 0,
    model_used: aiResponse?.model || "unknown",
    error: aiError
  };

  if (waitUntil) waitUntil(backgroundWork(aiText, metrics));
  else await backgroundWork(aiText, metrics);

  return new Response(JSON.stringify({ content: aiText, correlation_id: correlation.correlationId, metrics }), { 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
}));
