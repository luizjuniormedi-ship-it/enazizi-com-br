import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";
import { auditPedagogicalQuality } from "../_shared/cognitive-governance-helpers.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const SYSTEM_PROMPT_V3 = `
Você é o TUTOR IA V3 PREMIUM do ENAZIZI, um PRECEPTOR MÉDICO DE ELITE.
Sua missão é atuar como um preceptor de residência em um hospital de alta complexidade.

REQUISITO CRÍTICO DE FORMATAÇÃO:
Você DEVE incluir exatamente estes 15 cabeçalhos no início de cada seção correspondente:

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
- Use o Método Socrático.
- Seja rigoroso com guidelines médicos.
- MEMÓRIA LONGITUDINAL: Use o contexto anterior para evitar redundância.
- OBRIGATORIEDADE: Todos os 15 blocos devem estar presentes em explicações completas.
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
  
  // 1. AUTHENTICATION: Mandatory check
  const auth = await requireAuth(req);
  if (!auth.ok) {
    logger.error("AUTH_FAILED", "Unauthorized access attempt");
    return auth.response;
  }
  const userId = auth.userId;
  logger.info("AUTH_OK", "User authenticated", { userId });

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

  // 4. CONTEXT & GOVERNANCE
  const isLoop = detectCognitiveLoop(message, history);
  const fatigue = estimateStudentFatigue(history);
  const memoryContext = await buildPedagogicalContext(supabaseAdmin, userId, topic).catch(() => ({ cached_blocks: [] }));

  let complexity: "baixa" | "media" | "alta" = "alta";
  if (message.length < 20) complexity = "baixa";
  else if (message.length < 100) complexity = "media";

  const cognitiveContext = `\n[COGNITIVE STATE] Mastery: ${masteryState}, Fatigue: ${fatigue.toFixed(2)}, Topic: ${topic}`;
  const aiMessages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}${isLoop ? "\n[RECOVERY: LOOP DETECTADO]" : ""}${cognitiveContext}` },
    ...history.slice(-6).map((m: any) => ({
      role: m.role || "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    { role: "user", content: message },
  ];

  // 5. BACKGROUND WORK DEFINITION
  const backgroundWork = async (finalText: string, metrics: any) => {
    try {
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
    const aiResponse = await ai({
      taskType: "tutor",
      complexity,
      messages: aiMessages,
      userId,
      stream: true, 
    });

    if (aiResponse instanceof Response) {
      logger.info("STREAM_START", "Starting stream");
      if (waitUntil) waitUntil(backgroundWork("", { generation_ms: 0, model_used: "streaming" }));
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
      });
    }
    
    const aiText = aiResponse?.choices?.[0]?.message?.content || aiResponse?.content || "";
    const generationMs = Date.now() - runtimeStart;
    const metrics = {
      latency_ms: generationMs,
      generation_ms: generationMs,
      model_used: aiResponse?.model || "unknown"
    };

    if (waitUntil) waitUntil(backgroundWork(aiText, metrics));
    else await backgroundWork(aiText, metrics);

    return new Response(JSON.stringify({ content: aiText, correlation_id: correlation.correlationId, metrics }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (err) {
    logger.error("AI_FAIL", err.message);
    const fallback = "Houve uma instabilidade temporária no processamento de sua dúvida sobre " + topic + ". Posso te ajudar com um resumo rápido agora?";
    return new Response(JSON.stringify({ content: fallback, error: err.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}));
