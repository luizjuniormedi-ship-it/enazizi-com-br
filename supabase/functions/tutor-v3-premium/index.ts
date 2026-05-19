
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, getServiceClient, getUserIdFromRequest, jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { auditPedagogicalQuality } from "../_shared/cognitive-governance-helpers.ts";

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
14. Integração Farmacológica: Drogas, doses e mecanismos.
15. Modo Preceptor: Feedback socrático sobre o desempenho do aluno.

DIRETRIZES:
- NUNCA responda como um chatbot comum.
- Use o Método Socrático: faça perguntas que levem o aluno à conclusão.
- Integre disciplinas (ex: correlacione Fisiologia com Farmacologia).
- Seja rigoroso com guidelines (Harrison, Nelson, Sabiston).
- Adapte a profundidade com base no FSRS e Mastery State fornecidos.
- Se detectar cansaço ou erro recorrente, ative RECOVERY MODE.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);
    const { message, history, context, topic, fsrsContext, masteryState } = await req.json();

    // 1. Context Window Trimming - Keep only last 6 messages
    const trimmedHistory = history.slice(-6).map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));

    // 2. Prepare AI Call with FSRS and Mastery Integration
    const cognitiveContext = `
[COGNITIVE STATE]
Mastery: ${masteryState || 'initial'}
FSRS Context: ${JSON.stringify(fsrsContext || {})}
Topic: ${topic || 'Geral'}
    `;

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT_V3}\n${cognitiveContext}` },
      ...trimmedHistory,
      { role: "user", content: message }
    ];

    // 3. Call AI (Using proxy to AI Gateway)
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
        stream: false // Hotfix goal: stable first, streaming can be separate
      })
    });

    const aiResult = await aiResponse.json();
    const aiText = aiResult.choices?.[0]?.message?.content || "Erro ao gerar resposta.";
    const generationTime = Date.now() - startTime;

    // 4. Async Governance & Telemetry (Non-blocking)
    const auditPromise = auditPedagogicalQuality(aiText, JSON.stringify(context || {}));
    
    // Fire and forget (almost) but we handle it after response to not block user
    (async () => {
      try {
        const auditStart = Date.now();
        const audit = await auditPromise;
        const auditDuration = Date.now() - auditStart;

        await supabase.from("pedagogical_quality_audits").insert({
          content_type: 'tutor_v3_premium',
          quality_score: audit.quality_score,
          medical_coherence_passed: audit.medical_coherence_passed,
          guideline_compliance_passed: audit.guideline_compliance_passed,
          safety_check_passed: audit.safety_check_passed,
          detected_hallucinations: audit.detected_hallucinations,
          audit_log: { context, topic, userId, generationTime }
        });

        await supabase.from("tutor_runtime_metrics").insert({
          user_id: userId,
          tutor_generation_ms: generationTime,
          audit_ms: auditDuration,
          prompt_tokens: aiResult.usage?.prompt_tokens || 0,
          completion_tokens: aiResult.usage?.completion_tokens || 0
        });

        // Trigger health updates
        await supabase.functions.invoke('pedagogical-health-governor', {
          body: { userId, sessionOutcome: { score: audit.quality_score } },
          headers: { Authorization: req.headers.get('Authorization')! }
        });
      } catch (e) {
        console.error("[TutorV3Premium] Async Background Error:", e);
      }
    })();

    // 5. Return Response Quickly
    return jsonResponse({
      content: aiText,
      metrics: {
        latency_ms: generationTime
      }
    });

  } catch (error) {
    console.error("[TutorV3Premium] Critical Error:", error);
    return errorResponse(error.message, 500);
  }
});
