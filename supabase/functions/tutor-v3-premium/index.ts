
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, getServiceClient, getUserIdFromRequest, jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { auditPedagogicalQuality } from "../_shared/cognitive-governance-helpers.ts";
import { buildPedagogicalContext, saveTutorMemory } from "../_shared/tutor-memory-helpers.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);
    const { message, history, context, topic, fsrsContext, masteryState, sessionId } = await req.json();

    // 1. Build Longitudinal Memory Context (Phase 5)
    const memoryContext = await buildPedagogicalContext(supabase, userId, topic || 'Geral');
    let isMemoryHit = false;
    let fastPathResponse = null;

    // 2. Fast Path Check (Phase 4)
    // If user asks for a review of a topic already in memory and mastery is high
    if (message.toLowerCase().includes("revisão") || message.toLowerCase().includes("resumo")) {
      const relevantBlock = memoryContext.cached_blocks.find(b => 
        b.topic.toLowerCase() === (topic || '').toLowerCase()
      );
      if (relevantBlock && memoryContext.previous_mastery === 'mastered') {
        isMemoryHit = true;
        fastPathResponse = `[FAST PATH MEMORY]\nCom base no seu domínio prévio deste tema, aqui está sua revisão personalizada:\n\n${relevantBlock.generated_content}`;
      }
    }

    if (isMemoryHit && fastPathResponse) {
      return jsonResponse({
        content: fastPathResponse,
        metrics: {
          latency_ms: Date.now() - startTime,
          memory_hit: true,
          tokens_saved: 1500 // Estimated
        }
      });
    }

    // 3. Prepare AI Call with Memory Integration
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

    // 4. Call AI
    const aiResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model: "gpt-4o",
        temperature: 0.7,
        stream: false
      })
    });

    const aiResult = await aiResponse.json();
    const aiText = aiResult.choices?.[0]?.message?.content || "Erro ao gerar resposta.";
    const generationTime = Date.now() - startTime;

    // 5. Async Memory Storage & Telemetry (Non-blocking)
    (async () => {
      try {
        // Save new memory block
        await saveTutorMemory(supabase, userId, {
          topic: topic || 'Geral',
          content: aiText,
          sessionId
        });

        const audit = await auditPedagogicalQuality(aiText, JSON.stringify(context || {}));

        await supabase.from("pedagogical_quality_audits").insert({
          content_type: 'tutor_v3_premium',
          quality_score: audit.quality_score,
          medical_coherence_passed: audit.medical_coherence_passed,
          guideline_compliance_passed: audit.guideline_compliance_passed,
          safety_check_passed: audit.safety_check_passed,
          detected_hallucinations: audit.detected_hallucinations,
          audit_log: { context, topic, userId, generationTime, memory_hit: isMemoryHit }
        });

        await supabase.from("tutor_runtime_metrics").insert({
          user_id: userId,
          tutor_generation_ms: generationTime,
          prompt_tokens: aiResult.usage?.prompt_tokens || 0,
          completion_tokens: aiResult.usage?.completion_tokens || 0,
          memory_hit: isMemoryHit
        });
      } catch (e) {
        console.error("[TutorV3Premium] Async Background Error:", e);
      }
    })();

    return jsonResponse({
      content: aiText,
      metrics: {
        latency_ms: generationTime,
        memory_hit: isMemoryHit,
        tokens_used: aiResult.usage?.total_tokens || 0
      }
    });

  } catch (error) {
    console.error("[TutorV3Premium] Critical Error:", error);
    return errorResponse(error.message, 500);
  }
});

