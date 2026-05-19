
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
- Se detectar que o aluno está cansado ou errando muito, ative o RECOVERY MODE: explicações mais lentas, mais analogias e suporte emocional.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);
    const { message, history, context, topic } = await req.json();

    // 1. Get User Health/State for Adaptation
    const { data: health } = await supabase
      .from("pedagogical_health_indices")
      .select("health_score, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cognitiveState = health?.metadata?.detected_cognitive_state || 'estabilidade_ideal';
    
    // 2. Prepare AI Call
    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT_V3}\nESTADO ATUAL DO ALUNO: ${cognitiveState}\nSAÚDE PEDAGÓGICA: ${health?.health_score || 100}` },
      ...history,
      { role: "user", content: message }
    ];

    // 3. Call AI (Using proxy to AI Gateway)
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model: "gpt-4o", // Premium model for V3
        temperature: 0.7
      })
    });

    const aiResult = await response.json();
    const aiText = aiResult.choices[0].message.content;

    // 4. Anti-Hallucination Audit
    const audit = await auditPedagogicalQuality(aiText, JSON.stringify(context));

    // 5. Save Audit Log
    await supabase.from("pedagogical_quality_audits").insert({
      content_type: 'tutor_response',
      quality_score: audit.quality_score,
      medical_coherence_passed: audit.medical_coherence_passed,
      guideline_compliance_passed: audit.guideline_compliance_passed,
      safety_check_passed: audit.safety_check_passed,
      detected_hallucinations: audit.detected_hallucinations,
      audit_log: { context, topic, userId }
    });

    // 6. Asynchronously trigger health governor for background updates
    edgeFunctions.invoke('pedagogical-health-governor', {
      body: { userId },
      headers: { Authorization: req.headers.get('Authorization')! }
    }).catch(e => console.error("Async Health Update Error:", e));

    // 7. Return Response
    return jsonResponse({
      content: aiText,
      audit: {
        score: audit.quality_score,
        status: audit.quality_score > 70 ? 'approved' : 'warning'
      }
    });

  } catch (error) {
    console.error("[TutorV3Premium] Error:", error);
    return errorResponse(error.message, 500);
  }
});
