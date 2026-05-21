import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  const body = await req.json().catch(() => ({}));
  const { message, history = [], topic, fsrsContext, masteryState } = body;
  
  const rawSessionId = body.sessionId || body.session_id;
  const sessionId = isValidUUID(rawSessionId) ? rawSessionId : null;
  const userId = correlation.userId || body.userId || body.user_id;

  if (!userId) {
    logger.error("MISSING_USER_ID", "No User ID found", { bodyKeys: Object.keys(body) });
    throw new Error("User ID is required.");
  }

  // 1. Governance Checks
  const isLoop = detectCognitiveLoop(message, history);
  const fatigue = estimateStudentFatigue(history);
  const isHighFatigue = fatigue > 0.8;

  // 2. AI Routing
  const msgLower = (message || "").trim().toLowerCase();
  const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|e ai|ei)/i.test(msgLower);
  const isTransition = /^(ok|entendi|compreendido|continue|prossiga|sim|não|perfeito)/i.test(msgLower);
  const isShortQuery = (message || "").length < 50;
  
  let complexity: "baixa" | "media" | "alta" = "alta";
  if (isGreeting || (isTransition && isShortQuery) || isHighFatigue) {
    complexity = "baixa";
  } else if (isShortQuery) {
    complexity = "media";
  }

  // 3. Memory Hydration
  const memoryLookupStart = Date.now();
  let memoryContext;
  try {
    memoryContext = await buildPedagogicalContext(supabaseAdmin, userId, topic || "Geral");
  } catch (e) {
    logger.warn("MEMORY_LOOKUP_FAIL", (e as Error).message);
    memoryContext = {
      previous_mastery: "initial",
      known_misconceptions: [],
      effective_analogies: [],
      weak_topics: [],
      retention_risk: 0.2,
      prior_blocks_summary: "",
      cognitive_pattern: "Visual/Logístico",
      cached_blocks: [],
    };
  }
  const memoryLookupMs = Date.now() - memoryLookupStart;

  // 4. Prompt Engineering
  let systemPromptSuffix = "";
  if (isLoop) systemPromptSuffix = "\n[RECOVERY: LOOP DETECTADO] Mude a abordagem.";
  if (isHighFatigue) systemPromptSuffix = "\n[RECOVERY: FADIGA DETECTADA] Seja conciso e encorajador.";

  const cognitiveContext = `\n[COGNITIVE STATE] Mastery: ${masteryState || "initial"}, Fatigue: ${fatigue.toFixed(2)}, Topic: ${topic || "Geral"}`;
  
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}${systemPromptSuffix}${cognitiveContext}` },
    ...(Array.isArray(history) ? history.slice(-10) : []).map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    { role: "user", content: message },
  ];

  // 5. Execution
  const aiStart = Date.now();
  let aiResponse;
  try {
    aiResponse = await ai({
      taskType: "tutor",
      complexity,
      messages,
      userId,
    }) as any;
  } catch (err) {
    logger.error("AI_FAIL", (err as Error).message);
    return new Response(JSON.stringify({
      content: "## 🎯 BLOCO 1 — MISSÃO DA SESSÃO\nTivemos uma oscilação técnica. Retomamos no tópico: " + (topic || "Geral") + ".",
      metrics: { generation_ms: Date.now() - aiStart, error: true }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const aiText = aiResponse.choices?.[0]?.message?.content || "";
  const generationMs = Date.now() - runtimeStart;
  const isTruncated = aiText.length < 200 && complexity === "alta" && !isGreeting;

  // 6. Governance & Persistence (Non-blocking)
  const persistAndLog = (async () => {
    try {
      const persistenceStart = Date.now();
      if (sessionId) {
        // Try to find pedagogical session by conversation_id
        const { data: pedSess } = await supabaseAdmin
          .from("pedagogical_sessions")
          .select("id")
          .eq("conversation_id", sessionId)
          .maybeSingle();

        const targetSessionId = pedSess?.id;

        if (isLoop || isHighFatigue || isTruncated) {
          await supabaseAdmin.from("cognitive_runtime_events").insert({
            user_id: userId,
            session_id: targetSessionId || null,
            correlation_id: correlation.correlationId,
            event_type: isLoop ? 'LOOP_DETECTED' : isHighFatigue ? 'STUDENT_FATIGUE' : 'TRUNCATION_RISK',
            severity: isTruncated ? 'critical' : 'warning',
            topic: topic || "Geral",
            message: isTruncated ? "Resposta curta em pergunta complexa" : isLoop ? "Repetição detectada" : "Padrão de fadiga",
            metadata: { fatigue, complexity, msgLength: aiText.length }
          });
          
          if (targetSessionId) {
            await supabaseAdmin.from("pedagogical_sessions")
              .update({
                loop_count: isLoop ? 1 : 0, 
                fatigue_index: fatigue,
                cognitive_quality_score: isTruncated ? 5.0 : 9.0,
                updated_at: new Date().toISOString()
              })
              .eq("id", targetSessionId);
          }
        }

        await saveTutorMemory(supabaseAdmin, userId, {
          topic: topic || "Geral",
          content: aiText,
          sessionId: sessionId, // tutor_memory_helpers will check this against tutor_sessions or chat_conversations depending on internal logic
        });
      }

      await supabaseAdmin.from("tutor_runtime_metrics").insert({
        user_id: userId,
        correlation_id: correlation.correlationId,
        function_name: "tutor-v3-premium",
        tutor_generation_ms: generationMs,
        memory_lookup_ms: memoryLookupMs,
        persistence_ms: Date.now() - persistenceStart,
        memory_hit: (memoryContext.cached_blocks?.length ?? 0) > 0,
        prompt_tokens: aiResponse.usage?.prompt_tokens || 0,
        completion_tokens: aiResponse.usage?.completion_tokens || 0,
        model_used: aiResponse.model || null,
        topic: topic || "Geral",
        metadata: { complexity, is_loop: isLoop, fatigue_index: fatigue, is_truncated: isTruncated },
      });
    } catch (e) {
      logger.warn("TELEMETRY_FAIL", (e as Error).message);
    }
  })();

  if (waitUntil) waitUntil(persistAndLog); else await persistAndLog;

  return new Response(JSON.stringify({
    content: aiText,
    correlation_id: correlation.correlationId,
    metrics: { generation_ms: generationMs, complexity, fatigue, is_loop: isLoop },
  }), { headers: { "Content-Type": "application/json" } });
}));