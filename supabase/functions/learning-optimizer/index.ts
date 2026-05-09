import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito|jur[ií]d|penal|constitucional|processo penal|inquérito|inqu[eé]rito|stf|stj|delegad|advogad|pol[ií]cia federal|c[oó]digo penal|a[cç][aã]o penal|inform[aá]tica|tecnologia da informa[cç][aã]o|engenharia|contabil|economia|administra[cç][aã]o)/i;
const MEDICAL_CONTENT_REGEX = /(medicin|sa[uú]de|paciente|diagn[oó]st|tratament|sintom|doen[cç]|fisiopat|farmac|anatom|cl[íi]nic|cirurg|pediatr|ginec|obstetr|preventiva|resid[eê]ncia|enare|revalida|protocolo|diretriz|sus|revis[aã]o|estudo|D1|D3|D7|D15|D30|flashcard|simulad)/i;

const isMedicalContent = (text: string) => MEDICAL_CONTENT_REGEX.test(text) && !NON_MEDICAL_CONTENT_REGEX.test(text);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { performanceData, examDate, dailyHours, completedTopics, weakAreas, flashcardsDue, recentErrors, scheduledTopics, activeTopics } = await req.json();

    const sanitizeTopicList = (value: unknown) => Array.isArray(value)
      ? value.map(String).filter((t) => isMedicalContent(t) || t.length < 60)
      : [];

    const safeCompletedTopics = sanitizeTopicList(completedTopics);
    const safeWeakAreas = sanitizeTopicList(weakAreas);
    const safeRecentErrors = sanitizeTopicList(recentErrors);

    const safePerformanceData = Object.fromEntries(
      Object.entries(performanceData || {}).filter(([k]) => !NON_MEDICAL_CONTENT_REGEX.test(k))
    );

    // Process scheduled topics from cronograma
    const safeScheduledTopics = Array.isArray(scheduledTopics)
      ? scheduledTopics.map((t: any) => ({
          topic: String(t?.topic || ""),
          specialty: String(t?.specialty || ""),
          subtopics: String(t?.subtopics || ""),
          reviewType: String(t?.reviewType || ""),
          overdue: Boolean(t?.overdue),
          risk: String(t?.risk || "baixo"),
        })).filter(t => t.topic.length > 0)
      : [];
    // Process active topics (new topics added today, no reviews yet)
    const safeActiveTopics = Array.isArray(activeTopics)
      ? activeTopics.map((t: any) => ({
          topic: String(t?.topic || ""),
          specialty: String(t?.specialty || ""),
          subtopics: String(t?.subtopics || ""),
        })).filter(t => t.topic.length > 0)
      : [];

    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

    const scheduledSection = safeScheduledTopics.length > 0
      ? `\n\nTEMAS AGENDADOS NO CRONOGRAMA (OBRIGATÓRIOS - DEVEM APARECER NOS BLOCOS):
${safeScheduledTopics.map(t => `- ${t.topic} (${t.specialty}) — Revisão ${t.reviewType}${t.overdue ? " ⚠️ ATRASADA" : ""} | Risco: ${t.risk}${t.subtopics ? ` | Subtópicos: ${t.subtopics}` : ""}`).join("\n")}

REGRA: Esses temas DEVEM ser incluídos como blocos no plano. Revisões atrasadas têm prioridade máxima.`
      : "";

    const activeSection = safeActiveTopics.length > 0
      ? `\n\nTEMAS NOVOS DO CRONOGRAMA (PRIMEIRO CONTATO - INCLUIR COMO BLOCOS type: "study"):
${safeActiveTopics.map(t => `- ${t.topic} (${t.specialty})${t.subtopics ? ` | Subtópicos: ${t.subtopics}` : ""}`).join("\n")}

REGRA: Esses temas foram adicionados hoje e o aluno ainda não estudou. Inclua como blocos de estudo inicial (type: "study") com priority: "high".`
      : "";

    // Process error bank for personalized tips
    const safeRecentErrorDetails = Array.isArray(recentErrors)
      ? recentErrors.slice(0, 15).map(String)
      : [];

    const errorSection = safeRecentErrorDetails.length > 0
      ? `\n\nERROS RECENTES DO ALUNO (para gerar dicas personalizadas):
${safeRecentErrorDetails.map(e => `- ${e}`).join("\n")}
REGRA: As "tips" devem ser baseadas nesses erros reais, sugerindo revisão específica dos conceitos errados.`
      : "";

    const systemPrompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). Todos os blocos, títulos, dicas e descrições DEVEM ser em português. NUNCA use inglês.

Você é o Learning Optimization Agent, um agente de IA especializado em otimizar o estudo diário para Residência Médica e disciplinas de saúde em geral.

⛔ RESTRIÇÃO DE ESCOPO:
Você gera planos para MEDICINA, SAÚDE e CIÊNCIAS BIOMÉDICAS, incluindo disciplinas curriculares de cursos de saúde.
NUNCA inclua Direito, Engenharia ou áreas completamente fora da saúde.

DATA DE HOJE: ${today}

Sua função é decidir EXATAMENTE o que o aluno deve estudar hoje, baseado em:
- Áreas fracas (erros recentes)
- Flashcards pendentes de revisão (SRS)
- Desempenho por área
- Tempo disponível
- Proximidade da prova
- Temas agendados no cronograma inteligente

DADOS DO ALUNO:
- Data da prova: ${examDate || "Não definida"}
- Horas disponíveis hoje: ${dailyHours || 4}h
- Tópicos já estudados: ${JSON.stringify(safeCompletedTopics)}
- Áreas fracas: ${JSON.stringify(safeWeakAreas)}
- Flashcards pendentes: ${flashcardsDue || 0}
- Erros recentes: ${JSON.stringify(safeRecentErrors)}
- Desempenho geral: ${JSON.stringify(safePerformanceData)}${scheduledSection}${activeSection}${errorSection}

RETORNE um plano do dia estruturado em JSON com a seguinte estrutura:
{
  "greeting": "mensagem motivacional curta",
  "focus_areas": ["área1", "área2"],
  "blocks": [
    {
      "order": 1,
      "type": "study|review|practice|flashcards",
      "topic": "nome do tópico",
      "duration_minutes": 60,
      "description": "o que fazer neste bloco",
      "priority": "high|medium|low",
      "reason": "por que este bloco foi escolhido",
      "summary": "Resumo de 2 frases do conteúdo do tópico para dar contexto ao aluno antes de estudar",
      "learning_goal": "Objetivo de aprendizagem: o que o aluno deve saber ao final deste bloco",
      "prerequisite": "Nome de um tópico pré-requisito que o aluno precisa dominar antes, ou null se não houver"
    }
  ],
  "total_minutes": 240,
  "tips": ["dica personalizada baseada nos erros recentes"],
  "review_reminder": "lembrete sobre revisões pendentes"
}

Regras:
- Priorize áreas com mais erros
- Inclua revisão SRS se houver flashcards pendentes
- Distribua entre teoria + prática
- Respeite o tempo disponível
- Se a prova está próxima (< 30 dias), foque em revisão e simulados
- Temas agendados no cronograma DEVEM aparecer como blocos (type: "review")
- Revisões atrasadas devem ter priority: "high"
- Cada bloco DEVE ter: summary (2 frases contextualizando o conteúdo), learning_goal (objetivo claro de aprendizagem com "Ao final, você saberá..."), e prerequisite (tópico pré-requisito ou null)
- As tips DEVEM ser personalizadas baseadas nos erros recentes do aluno, não genéricas
- Sempre em português brasileiro
- RETORNE APENAS O JSON, sem texto adicional`;

    const response = await aiFetch({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Gere meu plano de estudo otimizado para hoje." },
      ],
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = sanitizeAiContent(data.choices?.[0]?.message?.content || "");
    
    let plan: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse plan");
      plan = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Falha ao processar plano diário gerado." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeFocusAreas = Array.isArray(plan?.focus_areas)
      ? plan.focus_areas.map(String).filter((t: string) => !NON_MEDICAL_CONTENT_REGEX.test(t))
      : [];

    const safeBlocks = Array.isArray(plan?.blocks)
      ? plan.blocks
          .map((b: any, i: number) => ({
            order: Number(b?.order ?? i + 1),
            type: String(b?.type || "study"),
            topic: String(b?.topic || "Revisão"),
            duration_minutes: Number(b?.duration_minutes || 30),
            description: String(b?.description || ""),
            priority: String(b?.priority || "medium"),
            reason: String(b?.reason || ""),
            summary: String(b?.summary || ""),
            learning_goal: String(b?.learning_goal || ""),
            prerequisite: b?.prerequisite ? String(b.prerequisite) : null,
          }))
          .filter((b: any) => !NON_MEDICAL_CONTENT_REGEX.test(`${b.topic} ${b.description} ${b.reason}`))
      : [];

    if (safeBlocks.length === 0) {
      return new Response(JSON.stringify({ error: "A IA retornou um plano sem conteúdo válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeTips = Array.isArray(plan?.tips)
      ? plan.tips.map(String).filter((tip: string) => !NON_MEDICAL_CONTENT_REGEX.test(tip))
      : [];

    const safePlan = {
      greeting: String(plan?.greeting || "Vamos focar na sua evolução hoje."),
      focus_areas: safeFocusAreas,
      blocks: safeBlocks,
      total_minutes: Number(plan?.total_minutes || safeBlocks.reduce((acc: number, b: any) => acc + b.duration_minutes, 0)),
      tips: safeTips,
      review_reminder: String(plan?.review_reminder || ""),
    };

    return new Response(JSON.stringify(safePlan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("learning-optimizer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
