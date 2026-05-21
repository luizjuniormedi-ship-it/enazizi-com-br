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
  return typeof v === "string" && UUID_REGEX.test(v) && v !== NULL_UUID;
}

Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation, waitUntil }) => {
  const runtimeStart = Date.now();
  const body = await req.json().catch(() => ({}));
  const { message, history = [], topic, fsrsContext, masteryState } = body;
  const sessionId = isValidUUID(body.sessionId) ? body.sessionId : null;
  const userId = correlation.userId || body.userId || body.user_id;

  if (!userId) {
    logger.error("MISSING_USER_ID", "No User ID found in correlation or body", { bodyKeys: Object.keys(body) });
    throw new Error("User ID is required for longitudinal memory.");
  }

  if (!message || typeof message !== "string") {
    throw new Error("Message is required.");
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
    ...(Array.isArray(history) ? history.slice(-6) : []).map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    { role: "user", content: message },
  ];

  // 3. AI Router + Governance + Quality Lock
  const aiResponse = await ai({
    taskType: "tutor",
    complexity: "baixa",
    cognitiveState: (masteryState?.toUpperCase?.() as any) || "NOVATO",
    messages,
    userId,
  });

  const aiText = aiResponse.choices?.[0]?.message?.content || "Erro ao gerar resposta.";
  const generationMs = Date.now() - runtimeStart;

  // 4. Persistência idempotente + telemetria (non-blocking)
  let duplicateKeyRecovered = false;
  const persistenceStart = Date.now();

  const persistAndLog = (async () => {
    try {
      if (sessionId) {
        try {
          await saveTutorMemory(supabaseAdmin, userId, {
            topic: topic || "Geral",
            content: aiText,
            sessionId,
          });
        } catch (e) {
          const msg = (e as Error).message || "";
          if (msg.includes("duplicate") || msg.includes("23505")) {
            duplicateKeyRecovered = true;
            logger.info("MEMORY_UPSERT_RECOVERED", "Duplicate key handled via upsert", { topic });
          } else {
            logger.warn("TUTOR_MEMORY_SAVE_FAIL", msg);
          }
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
        metadata: { has_session: !!sessionId },
      });
    } catch (telemetryErr) {
      logger.warn("TUTOR_TELEMETRY_FAIL", (telemetryErr as Error).message);
    }
  })();

  if (waitUntil) waitUntil(persistAndLog); else await persistAndLog;

  return new Response(JSON.stringify({
    content: aiText,
    correlation_id: correlation.correlationId,
    metrics: {
      generation_ms: generationMs,
      memory_lookup_ms: memoryLookupMs,
      memory_hit: (memoryContext.cached_blocks?.length ?? 0) > 0,
    },
  }), {
    headers: { "Content-Type": "application/json" },
  });
}));
