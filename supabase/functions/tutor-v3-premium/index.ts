import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";
import { parseAiJson } from "../_shared/ai-fetch.ts";

const SYSTEM_PROMPT_V3 = `
Você é o TUTOR IA V3 PREMIUM do ENAZIZI, um PRECEPTOR MÉDICO DE ELITE.
Sua missão é atuar como um preceptor de residência em um hospital de alta complexidade.

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (Siga rigorosamente):
1. Missão Clínica: Defina o objetivo do estudo/caso.
2. Roadmap Cognitivo: O caminho que percorreremos.
3. Explicação Leiga: Analogia simples para o conceito.
4. Fisiopatologia Profunda: Mecanismos celulares e moleculares.
5. Raciocínio Clínico: Como um médico pensa diante desse quadro.
6. Diagnóstico: Critérios, exames e armadilhas.
7. Conduta: Passo a passo baseado em evidências.
8. Pegadinhas de Prova: O que as bancas (ENARE, USP, etc) cobram.
9. Active Recall: 3 perguntas de fixação.
10. Questão Residência: Exemplo real ou simulado.
11. Flashcards: Sugestões para o ANKI/FSRS.
12. Resumo Ultraobjetivo: O que levar para a vida.
13. Fluxograma Decisório: Representação textual do algoritmo.
14. Integração Farmacológica: Drogas, doses e mechanisms.
15. Modo Preceptor: Feedback socrático sobre o desempenho do aluno.

DIRETRIZES:
- NUNCA responda como um chatbot comum.
- Use o Método Socrático: faça perguntas que levem o aluno à conclusão.
- Integre disciplinas (ex: correlacione Fisiologia com Farmacologia).
- Seja rigoroso com guidelines (Harrison, Nelson, Sabiston).
- Adapte a profundidade com base no FSRS e Mastery State fornecidos.
- Se detectar cansaço ou erro recorrente, ative RECOVERY MODE.
- MEMÓRIA LONGITUDINAL: Utilize o histórico de explicações e analogias já fornecidas para evitar redundância e garantir continuidade.
`;

Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { message, history = [], topic, fsrsContext, masteryState, sessionId } = await req.json();
  const userId = correlation.userId;

  if (!userId) {
    throw new Error("User ID is required for longitudinal memory.");
  }

  // 1. Build Longitudinal Memory Context
  const memoryContext = await buildPedagogicalContext(supabaseAdmin, userId, topic || 'Geral');
  
  // 2. Prepare AI Call with Memory Integration
  const cognitiveContext = `
[COGNITIVE STATE]
Mastery: ${masteryState || memoryContext.previous_mastery || 'initial'}
FSRS Context: ${JSON.stringify(fsrsContext || {})}
Topic: ${topic || 'Geral'}

[LONGITUDINAL MEMORY]
Prior Explanations: ${memoryContext.prior_blocks_summary}
Effective Analogies: ${memoryContext.effective_analogies.join(", ")}
Known Misconceptions: ${memoryContext.known_misconceptions.join(", ")}
Cognitive Pattern: ${memoryContext.cognitive_pattern}
    `;

  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT_V3}\n${cognitiveContext}` },
    ...history.slice(-6).map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    })),
    { role: "user", content: message }
  ];

  // 3. Call AI via Governance Router
  const aiResponse = await ai({
    taskType: "tutor",
    complexity: "alta",
    cognitiveState: (masteryState?.toUpperCase() as any) || "NOVATO",
    messages,
    userId
  });

  const aiText = aiResponse.choices?.[0]?.message?.content || "Erro ao gerar resposta.";

  // 4. Async Memory Storage (Non-blocking)
  // We can use Deno.onUnhandledRejection if we really want to separate but enterpriseEdgeHandler handles the main flow.
  // For now just await or fire-and-forget
  try {
    await saveTutorMemory(supabaseAdmin, userId, {
      topic: topic || 'Geral',
      content: aiText,
      sessionId
    });
    
    // Log additional tutor metrics
    await supabaseAdmin.from("tutor_runtime_metrics").insert({
      user_id: userId,
      tutor_generation_ms: 0, // Router handles this now in ai_governance_logs
      prompt_tokens: aiResponse.usage?.prompt_tokens || 0,
      completion_tokens: aiResponse.usage?.completion_tokens || 0,
      memory_hit: false
    });
  } catch (e) {
    logger.warn("TUTOR_MEMORY_SAVE_FAIL", e.message);
  }

  return new Response(JSON.stringify({
    content: aiText,
    correlation_id: correlation.correlationId
  }), {
    headers: { "Content-Type": "application/json" }
  });
}));
