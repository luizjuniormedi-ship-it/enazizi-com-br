import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getLessonPrompt,
  getCompactLessonPrompt,
  getRecallPrompt,
  getQuestionPrompt,
  getDiscussionPrompt,
  getScoringPrompt,
  getReinforcementPrompt,
  getFeynmanPrompt,
  getSessionMemoryBlock,
} from "../_shared/enazizi-prompt.ts";
import { aiFetch, getModelForTier } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";


/** Standard JSON response helper */
const json = (data: any, status = 200) => corsResponse(data, status);

// Helper functions (same as before)
function getLevelPrompt(performanceData: unknown): string {
  const data = performanceData as any;
  if (!data || !data.totalQuestions || data.totalQuestions < 5) return "";
  const accuracy = data.totalQuestions > 0 ? (data.correctAnswers / data.totalQuestions) * 100 : 0;
  if (accuracy < 30) {
    return `
NÍVEL DO ALUNO: INICIANTE (taxa de acerto: ${Math.round(accuracy)}%)
- Use linguagem mais SIMPLES e acessível
- Inclua mais EXEMPLOS práticos e analogias do dia a dia
- Reduza profundidade molecular (foque nos conceitos-chave)
- Explique termos técnicos quando usá-los
- Seja mais ENCORAJADOR e motivacional`;
  }
  if (accuracy < 70) {
    return `
NÍVEL DO ALUNO: INTERMEDIÁRIO (taxa de acerto: ${Math.round(accuracy)}%)
- Equilíbrio entre teoria e prática
- Pode usar terminologia técnica com explicações pontuais
- Inclua correlações clínicas mais complexas
- Comece a introduzir pegadinhas de prova`;
  }
  return `
NÍVEL DO ALUNO: AVANÇADO (taxa de acerto: ${Math.round(accuracy)}%)
- Foque em PEGADINHAS, diagnósticos diferenciais RAROS e casos ATÍPICOS
- Use terminologia técnica sem simplificação
- Apresente discussões de conduta controversas
- Inclua detalhes moleculares e referências avançadas
- Desafie com casos de alta complexidade`;
}

function getWeakTopicsPrompt(performanceData: unknown): string {
  const data = performanceData as any;
  if (!data?.weakTopics?.length) return "";
  return `
TEMAS FRACOS DO ALUNO (reforço automático obrigatório):
${data.weakTopics.map((t: string) => `- ❌ ${t}`).join("\n")}

REGRA DE REFORÇO POR ERRO:
- Nos próximos 3-5 blocos, RETOME esses temas fracos com ENFOQUE DIFERENTE do que já foi abordado
- NUNCA ignore os temas fracos — eles devem ser intercalados com o conteúdo novo
- Ao retomar: use ângulo diferente (se errou diagnóstico → foque em conduta; se errou conduta → foque em complicações)`;
}

const STRUCTURED_SIGNAL_BLOCK = `
==================================================
SINAL ESTRUTURADO OBRIGATÓRIO (NÃO REMOVER)
==================================================
SEMPRE QUE você corrigir uma resposta objetiva do aluno (letra A–D) ou
avaliar acerto/erro de uma questão de verificação, ANEXE no FINAL da
mensagem (após todo o feedback humano) o seguinte bloco — exatamente neste
formato, em UMA ÚNICA linha de JSON, entre os marcadores HTML comments:

<!--SIGNAL-->
{"wasCorrect":true,"correctLetter":"B","detectedAnswer":"A","errorCategory":"conceitual","subtopic":"","topic":"","confidence":0.9,"feedbackShort":"","feedbackDetailed":"","shouldReinforce":true,"recommendedNextStep":"review"}
<!--/SIGNAL-->

REGRAS DO BLOCO:
- "wasCorrect" boolean (obrigatório)
- "correctLetter" letra A–D da alternativa correta
- "detectedAnswer" letra A–D que o aluno respondeu
- "errorCategory" um de: conceitual | memorizacao | interpretacao | atencao | desconhecido
- "subtopic" subtema clínico específico (ex: "tratamento da pneumonia comunitária")
- "topic" tema geral
- "confidence" sua confiança na classificação (0.0 a 1.0). Se não tiver certeza, use < 0.5 e errorCategory "desconhecido".
- "feedbackShort" 1 frase resumindo a correção
- "shouldReinforce" true se vale acionar reforço
- "recommendedNextStep" um de: review | tutor | mnemonic | image_quiz | continue

CRÍTICO:
- O bloco SIGNAL deve aparecer SOMENTE quando há correção objetiva (não em explicações teóricas).
- O texto humano acima do bloco continua livre, didático e formatado normalmente.
- O bloco DEVE ser válido JSON em uma linha. NUNCA quebre linhas dentro dele.
- NUNCA mostre o bloco como código visível para o aluno — ele é HTML comment.
`;

function getPhasePrompt(phase: string, topic: string, performanceData: unknown, studyMode?: string): string {
  const levelPrompt = getLevelPrompt(performanceData);
  const weakTopicsPrompt = getWeakTopicsPrompt(performanceData);

  switch (phase) {
    case "performance":
      return `${getDiscussionPrompt()}\nFASE ATUAL: STATE 0 — PAINEL DE DESEMPENHO\n\nDados do aluno:\n${JSON.stringify(performanceData || {}, null, 2)}\n\nMostre o painel organizado:\n## 📊 Painel ENAZIZI\n- Questões respondidas, Taxa de acerto, Pontuação discursiva\n- Raciocínio clínico, Conduta terapêutica\n- Nível estimado, Estimativa de preparo para residência\n## 🧠 Domínio por Especialidade\n## ⚠️ Temas Fracos\n## 📈 Recomendação\nSe não houver dados, informe e sugira começar.`;
    case "lesson":
      if (studyMode === "compact") {
        return `${getCompactLessonPrompt()}\n${levelPrompt}\nFASE ATUAL: EXPLICAÇÃO RÁPIDA (MODO COMPACTO)\nTema: "${topic || "solicitado pelo aluno"}"\n\nFORMATO OBRIGATÓRIO (300-400 palavras MÁXIMO):\n1. **🎯 O que é**\n2. **⚡ Ponto-chave**\n3. **🏥 Aplicação**\n4. **❓ Teste rápido**`;
      }
      return `${getLessonPrompt()}\n${levelPrompt}\n${weakTopicsPrompt}\nFASE ATUAL: BLOCOS TÉCNICOS (STATES 2-6)\nTema: "${topic || "solicitado pelo aluno"}"\n\nSiga o protocolo de 4 mensagens.`;
    case "questions":
      return `${getQuestionPrompt()}\n${weakTopicsPrompt}\nFASE ATUAL: QUESTÃO OBJETIVA (STATE 7)\nTema: "${topic}"\n\nApresente um caso clínico detalhado com 4 alternativas (A-D).`;
    default:
      return `${getLessonPrompt()}\n${levelPrompt}\n${weakTopicsPrompt}\nSiga o fluxo pedagógico.`;
  }
}

async function fetchFallbackQuestion(supabase: any, topic: string) {
  const { data, error } = await supabase
    .from("questions_bank")
    .select("*")
    .or(`topic.ilike.%${topic}%,subtopic.ilike.%${topic}%,statement.ilike.%${topic}%`)
    .eq("review_status", "approved")
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

function formatQuestionAsText(q: any): string {
  const options = Array.isArray(q.options) 
    ? q.options.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}) ${opt}`).join("\n")
    : "";
  return `### 📋 Questão do Banco (Fallback)\n\n${q.statement}\n\n${options}\n\n**Qual sua resposta? (A, B, C ou D)**\n\n<!--SIGNAL-->\n{"wasCorrect":false,"correctLetter":"${String.fromCharCode(65 + (q.correct_index ?? 0))}","isFallback":true}\n<!--/SIGNAL-->`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const auth = await requireAuth(req);
  if (!auth.ok) {
    console.warn(`[study-session] unauthorized id=${requestId}`);
    return auth.response;
  }
  const { userId } = auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  try {
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

    const { messages, phase, topic, performanceData, studyMode, targetExam } = body;
    if (!Array.isArray(messages)) return json({ error: "missing_messages" }, 400);

    let systemPrompt = getPhasePrompt(phase, topic, performanceData, studyMode);
    const bancaProfile = getBancaProfile(targetExam);
    systemPrompt += buildBancaBlock(bancaProfile);
    systemPrompt += "\n" + STRUCTURED_SIGNAL_BLOCK;

    const usedModel = getModelForTier("pro");
    
    try {
      const response = await aiFetch({
        model: usedModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-10)],
        stream: true,
        timeoutMs: 45000,
        userId
      });

      if (!response.ok) throw new Error(`AI_ERROR_${response.status}`);

      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

    } catch (aiErr) {
      console.error(`[study-session] id=${requestId} AI Call failed:`, aiErr);
      if (phase === "questions") {
        const fallback = await fetchFallbackQuestion(supabaseAdmin, topic);
        if (fallback) {
          const content = formatQuestionAsText(fallback);
          return json({ fallbackContent: content, isFallbackActive: true });
        }
      }
      return json({ 
        error: "AI_FAILED", 
        message: "O serviço de IA está instável. Tente novamente.",
        isFallbackActive: true,
        fallbackContent: `⚠️ *A IA está um pouco lenta.* Vamos tentar continuar com foco em ${topic}. O TEP é uma emergência vascular pulmonar crítica. O diagnóstico costuma ser Angio-TC e o tratamento é anticoagulação.`
      }, 500);
    }
  } catch (e) {
    console.error(`[study-session] fatal id=${requestId}`, e);
    return json({ error: "INTERNAL_ERROR", isFallbackActive: true }, 500);
  }
});