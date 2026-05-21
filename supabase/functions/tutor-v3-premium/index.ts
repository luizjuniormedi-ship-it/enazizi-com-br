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
  // Check for common placeholders/test IDs
  if (v.startsWith("00000000") || v.includes("fake") || v.includes("test")) return false;
  return true;
}

Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation, waitUntil }) => {
  const runtimeStart = Date.now();
  const body = await req.json().catch(() => ({}));
  const { message, history = [], topic, fsrsContext, masteryState } = body;
  
  // Hardening Session ID
  const rawSessionId = body.sessionId || body.session_id;
  const sessionId = isValidUUID(rawSessionId) ? rawSessionId : null;
  const userId = correlation.userId || body.userId || body.user_id;

  if (!userId) {
    logger.error("MISSING_USER_ID", "No User ID found in correlation or body", { bodyKeys: Object.keys(body) });
    throw new Error("User ID is required for longitudinal memory.");
  }

  if (!message || typeof message !== "string") {
    throw new Error("Message is required.");
  }

  // AI Routing Logic
  const msgLower = message.trim().toLowerCase();
  const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|e ai|ei)/i.test(msgLower);
  const isTransition = /^(ok|entendi|compreendido|continue|prossiga|sim|não|perfeito)/i.test(msgLower);
  const isShortQuery = message.length < 50;
  
  // Decide complexity based on intent
  let complexity: "baixa" | "media" | "alta" = "alta";
  if (isGreeting || (isTransition && isShortQuery)) {
    complexity = "baixa";
  } else if (isShortQuery) {
    complexity = "media";
  }

  // 1. Hidratação longitudinal — tolerante a falha
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

  // 2. Prompt com contexto cognitivo + memória
  const cognitiveContext = `
[COGNITIVE STATE]
Mastery: ${masteryState || memoryContext.previous_mastery || "initial"}
FSRS Context: ${JSON.stringify(fsrsContext || {})}
Topic: ${topic || "Geral"}

[LONGITUDINAL MEMORY]
Prior Explanations: ${memoryContext.prior_blocks_summary || "(primeira interação neste tema)"}
Effective Analogies: ${(memoryContext.effective_analogies || []).join(", ") || "(nenhuma registrada)"}
Known Misconceptions: ${(memoryContext.known_misconceptions || []).join(", ") || "(nenhuma)"}
Cognitive Pattern: ${memoryContext.cognitive_pattern}
`;

  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}\n${cognitiveContext}` },
    ...(Array.isArray(history) ? history.slice(-10) : []).map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    { role: "user", content: message },
  ];

  // 3. AI Router + Governance + Quality Lock
  const aiStart = Date.now();
  let aiResponse;
  try {
    const aiPromise = ai({
      taskType: "tutor",
      complexity: complexity,
      cognitiveState: (masteryState?.toUpperCase?.() as any) || "NOVATO",
      messages,
      userId,
    });

    // Race against a 45s timeout for enterprise stability
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("AI_MODEL_TIMEOUT")), 45000)
    );

    aiResponse = await Promise.race([aiPromise, timeoutPromise]) as any;
  } catch (err) {
    logger.error("AI_GENERATION_FAILED", (err as Error).message, { 
      correlationId: correlation.correlationId,
      complexity 
    });
    
    // Recovery Fallback: Minimal pedagogical response if model fails
    return new Response(JSON.stringify({
      content: "## 🎯 BLOCO 1 — MISSÃO DA SESSÃO\nPeço desculpas, tive uma oscilação momentânea na conexão. Poderia repetir sua última dúvida? Manteremos o foco no tópico: " + (topic || "Geral") + ".\n\n[RECOVERY_MODE_ACTIVE]",
      correlation_id: correlation.correlationId,
      error: (err as Error).message === "AI_MODEL_TIMEOUT" ? "timeout" : "model_failure",
      metrics: { generation_ms: Date.now() - aiStart, error: true }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const aiText = aiResponse.choices?.[0]?.message?.content || "Erro ao gerar resposta.";
  const generationMs = Date.now() - runtimeStart;

  // 4. Persistência idempotente + telemetria (non-blocking)
  let duplicateKeyRecovered = false;
  let sessionSkipped = false;
  const persistenceStart = Date.now();

  const persistAndLog = (async () => {
    try {
      if (sessionId) {
        try {
          // Check if session actually exists to avoid FK error
          const { data: sessCheck } = await supabaseAdmin
            .from("tutor_sessions")
            .select("id")
            .eq("id", sessionId)
            .maybeSingle();

          if (sessCheck) {
            await saveTutorMemory(supabaseAdmin, userId, {
              topic: topic || "Geral",
              content: aiText,
              sessionId,
            });
          } else {
            sessionSkipped = true;
            logger.info("SESSION_PERSISTENCE_SKIPPED", "Session ID not found in database", { sessionId });
          }
        } catch (e) {
          const msg = (e as Error).message || "";
          if (msg.includes("duplicate") || msg.includes("23505")) {
            duplicateKeyRecovered = true;
          } else {
            logger.warn("TUTOR_MEMORY_SAVE_FAIL", msg);
          }
        }
      } else {
        sessionSkipped = true;
        if (rawSessionId) {
          logger.info("SESSION_INVALID_SKIPPED", "Invalid or temporary session ID provided", { rawSessionId });
        }
      }

      await supabaseAdmin.from("tutor_runtime_metrics").insert({
        user_id: userId,
        correlation_id: correlation.correlationId,
        function_name: "tutor-v3-premium",
        tutor_generation_ms: generationMs,
        memory_lookup_ms: memoryLookupMs,
        persistence_ms: Date.now() - persistenceStart,
        memory_hit: (memoryContext.cached_blocks?.length ?? 0) > 0,
        duplicate_key_recovered: duplicateKeyRecovered,
        prompt_tokens: aiResponse.usage?.prompt_tokens || 0,
        completion_tokens: aiResponse.usage?.completion_tokens || 0,
        model_used: aiResponse.model || null,
        topic: topic || "Geral",
        metadata: { 
          has_session: !!sessionId, 
          session_skipped: sessionSkipped,
          complexity_assigned: complexity,
          is_greeting: isGreeting,
          is_transition: isTransition
        },
      });
    } catch (telemetryErr) {
      logger.warn("TUTOR_TELEMETRY_FAIL", (telemetryErr as Error).message);
    }
  })();

  if (waitUntil) waitUntil(persistAndLog); else await persistAndLog;

  return new Response(JSON.stringify({
    content: aiText,
    correlation_id: correlation.correlationId,
    request_id: crypto.randomUUID(),
    metrics: {
      generation_ms: generationMs,
      memory_lookup_ms: memoryLookupMs,
      memory_hit: (memoryContext.cached_blocks?.length ?? 0) > 0,
      complexity: complexity,
      session_skipped: sessionSkipped
    },
  }), {
    headers: { "Content-Type": "application/json" },
  });
}));
