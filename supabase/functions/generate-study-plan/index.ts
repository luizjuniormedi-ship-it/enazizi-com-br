/**
 * @legacy-write
 * @deprecated-flow — APOSENTADA na sprint final do Planner.
 *
 * Esta edge function escreve em study_plans (shape semanal weeklySchedule).
 * Não é mais chamada pelo onboarding nem por nenhum fluxo principal do ENAZIZI.
 *
 * Fonte viva oficial do Planner: daily_plans + daily_plan_tasks (diário, gerado por planner-orchestrator-v1).
 * Mantida apenas para retrocompatibilidade da UX semanal de StudyPlan/StudyPlanContent (ambos isolados).
 *
 * NÃO REATIVAR sem redesign completo do gerador para o shape diário.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito\s+(penal|civil|constitucional|tributário)|jur[ií]dic|processo\s+penal|stf|stj|delegad[oa]|advogad[oa]|pol[ií]cia\s+federal|c[oó]digo\s+penal|a[cç][aã]o\s+penal|engenharia\s+(civil|elétrica|mecânica)|contabilidade|ciências\s+contábeis)/i;

// For edital/cronograma: only reject clearly non-medical content, accept everything else
// Medical subjects often have generic names (e.g., "Atenção Básica", "Saúde da Família", "Urgência")
const isNonMedicalContent = (text: string) => NON_MEDICAL_CONTENT_REGEX.test(text);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Loop 3E: getClaims + getUser fallback antes de qualquer chamada IA.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;
  const authHeader = req.headers.get("Authorization")!;

  try {
    // Service role para bypass de RLS em escritas internas
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Client scoped to user for RLS queries
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { examDate, hoursPerDay, daysPerWeek, editalText, currentPlanId, targetExam, targetExams } = await req.json();

    // Load target_exam from profile if not passed directly
    let bancaKeys: string[] = targetExams || (targetExam ? [targetExam] : []);
    if (bancaKeys.length === 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("target_exam, target_exams")
        .eq("user_id", userId)
        .single();
      const p = prof as any;
      if (Array.isArray(p?.target_exams) && p.target_exams.length > 0) {
        bancaKeys = p.target_exams;
      } else if (p?.target_exam) {
        bancaKeys = [p.target_exam];
      }
    }
    const bancaProfile = bancaKeys.length > 0 ? getBancaProfile(bancaKeys[0]) : getBancaProfile(null);
    const bancaBlock = buildBancaBlock(bancaProfile);

    if (!examDate || !hoursPerDay || !daysPerWeek) {
      return new Response(JSON.stringify({ error: "Missing required fields: examDate, hoursPerDay, daysPerWeek" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const editalPreview = String(editalText || "").slice(0, 8000);
    if (editalPreview && isNonMedicalContent(editalPreview)) {
      return new Response(JSON.stringify({ error: "Edital rejeitado: somente conteúdo médico é permitido para gerar cronograma." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const daysUntilExam = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const prompt = `Você é um especialista em planejamento de estudos médicos para Residência Médica no Brasil.

⛔ RESTRIÇÃO: Somente conteúdo de MEDICINA, SAÚDE e CIÊNCIAS BIOMÉDICAS.

Dados do aluno:
- Data da prova: ${examDate} (${daysUntilExam} dias restantes)
- Horas disponíveis por dia: ${hoursPerDay}
- Dias de estudo por semana: ${daysPerWeek}
${editalPreview ? `\n📋 CONTEÚDO PROGRAMÁTICO / CRONOGRAMA ENVIADO PELO ALUNO:\n---\n${editalPreview}\n---` : ""}
${bancaBlock}

🎯 INSTRUÇÕES CRÍTICAS:

1. **EXTRAIA TODOS OS TEMAS**: Leia CADA linha do conteúdo acima. Todo tópico mencionado DEVE aparecer. NÃO IGNORE NENHUM.

2. **DESDOBRE EM SUBTÓPICOS**: Para cada tema, liste os subtópicos essenciais que o aluno precisa dominar. Exemplo:
   - Tema: "Bronquiolite" → Subtópicos: ["Etiologia (VSR)", "Fisiopatologia", "Quadro clínico", "Diagnóstico diferencial", "Tratamento e suporte", "Critérios de internação"]

3. **IDENTIFIQUE A ESPECIALIDADE** do documento (ex: Pediatria, Clínica Médica).

4. **RESPEITE A ORDEM CRONOLÓGICA** se houver datas.

5. **REVISÃO ESPAÇADA OBRIGATÓRIA**: Para CADA tema estudado, programe revisões espaçadas:
   - **D1**: Revisão rápida no DIA SEGUINTE ao estudo (duração: 30min, type: "revisao")
   - **D7**: Revisão intermediária 7 DIAS após o estudo (duração: 30min, type: "revisao")
   - **D30**: Revisão de consolidação 30 DIAS após o estudo (duração: 20min, type: "revisao")
   - Distribua as revisões nos dias disponíveis SEM ultrapassar ${hoursPerDay}h/dia
   - Se houver conflito de horário, priorize revisões D1 > D7 > D30

6. **LIMITE DE TEMPO**: O total de horas por dia (estudo + revisão + questões) NÃO pode ultrapassar ${hoursPerDay}h. Se necessário, mova blocos para o próximo dia disponível.

Retorne APENAS um JSON válido (sem markdown, sem \`\`\`) no formato:
{
  "detectedSpecialty": "Pediatria",
  "topicMap": [
    {
      "topic": "Infecções de Vias Aéreas Superiores",
      "subtopics": ["IVAS virais", "Otite média aguda", "Sinusite", "Faringite estreptocócica", "Diagnóstico diferencial"]
    }
  ],
  "subjects": ["Infecções de Vias Aéreas Superiores", "Bronquiolite", ...todos os temas],
  "reviewSchedule": [
    {
      "topic": "Bronquiolite",
      "studyDay": "Seg",
      "studyWeek": 1,
      "d1": { "day": "Ter", "week": 1 },
      "d7": { "day": "Seg", "week": 2 },
      "d30": { "day": "Seg", "week": 5 }
    }
  ],
  "weeklySchedule": [
    {
      "day": "Seg",
      "week": 1,
      "tasks": [
        { "time": "08:00", "subject": "Bronquiolite", "duration": "2h", "type": "estudo", "details": "Etiologia (VSR), fisiopatologia obstrutiva, quadro clínico típico" },
        { "time": "10:00", "subject": "Bronquiolite - Questões", "duration": "1h", "type": "questoes", "details": "Resolver questões sobre critérios de internação" }
      ]
    },
    {
      "day": "Ter",
      "week": 1,
      "tasks": [
        { "time": "08:00", "subject": "Revisão D1: Bronquiolite", "duration": "30min", "type": "revisao", "details": "Revisar conceitos-chave: VSR, score de gravidade, critérios de internação" },
        { "time": "08:30", "subject": "Pneumonias", "duration": "2h", "type": "estudo", "details": "Classificação por agente, típica vs atípica" }
      ]
    }
  ],
  "tips": "Dica estratégica personalizada",
  "totalTopicsExtracted": 12
}

REGRAS OBRIGATÓRIAS:
- O campo "topicMap" DEVE conter TODOS os temas com seus subtópicos (mínimo 3 subtópicos por tema)
- O campo "details" em cada task é OBRIGATÓRIO - seja específico sobre O QUE estudar
- O campo "reviewSchedule" é OBRIGATÓRIO - liste TODOS os temas com suas datas de revisão D1, D7 e D30
- O campo "week" em cada dia do weeklySchedule indica a semana (1, 2, 3...)
- Blocos de revisão DEVEM ter type "revisao" e subject começando com "Revisão D1:", "Revisão D7:" ou "Revisão D30:"
- Use os dias: Seg, Ter, Qua, Qui, Sex, Sáb, Dom (apenas ${daysPerWeek} dias)
- Tipos válidos: "estudo", "revisao", "simulado", "questoes"
- TODOS os temas do topicMap DEVEM estar distribuídos no weeklySchedule
- Respeite o limite de ${hoursPerDay}h/dia incluindo revisões
- Se não houver edital, use temas padrão das 5 grandes áreas de residência médica
- Cada tema deve ter pelo menos: 1 bloco de estudo teórico + 1 bloco de questões + 3 blocos de revisão (D1, D7, D30)`;

    const startMs = Date.now();
    const aiResp = await aiFetch({
      messages: [{ role: "user", content: prompt }],
    });
    const elapsed = Date.now() - startMs;

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      logAiUsage({ userId, functionName: "generate-study-plan", modelUsed: "openai/gpt-5-mini", success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast", errorMessage: `status ${aiResp.status}` }).catch(() => {});
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    logAiUsage({ userId, functionName: "generate-study-plan", modelUsed: "openai/gpt-5-mini", success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});

    const aiData = await aiResp.json();
    const raw = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");

    // Extract JSON from response
    let planJson;
    try {
      // Try direct parse first
      planJson = JSON.parse(raw);
    } catch {
      try {
        // Try extracting from markdown code blocks
        const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          planJson = JSON.parse(codeBlockMatch[1].trim());
        } else {
          // Try extracting any JSON object
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            planJson = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in response");
          }
        }
      } catch {
        console.error("Failed to parse AI response:", raw);
        return new Response(JSON.stringify({ error: "Falha ao processar resposta da IA. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const safeSubjects = Array.isArray(planJson?.subjects)
      ? planJson.subjects.map(String).filter((s: string) => !isNonMedicalContent(s))
      : [];

    const safeWeeklySchedule = Array.isArray(planJson?.weeklySchedule)
      ? planJson.weeklySchedule
          .map((day: any) => ({
            day: String(day?.day || ""),
            tasks: Array.isArray(day?.tasks)
              ? day.tasks
                  .map((t: any) => ({
                    time: String(t?.time || ""),
                    subject: String(t?.subject || ""),
                    duration: String(t?.duration || ""),
                    type: String(t?.type || "estudo"),
                  }))
                  .filter((t: any) => !isNonMedicalContent(`${t.subject}`))
              : [],
          }))
          .filter((d: any) => d.tasks.length > 0)
      : [];

    if (safeWeeklySchedule.length === 0) {
      return new Response(JSON.stringify({ error: "A IA retornou um cronograma sem conteúdo médico válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build suggested simulado config based on subject distribution
    const subjectCounts: Record<string, number> = {};
    for (const day of safeWeeklySchedule) {
      for (const task of day.tasks) {
        const subj = task.subject;
        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
      }
    }
    const totalTasks = Object.values(subjectCounts).reduce((s, c) => s + c, 0);
    const suggestedSimulado = {
      totalQuestions: 40,
      timeMinutes: 120,
      distribution: Object.entries(subjectCounts).map(([subject, count]) => ({
        subject,
        questions: Math.max(1, Math.round((count / totalTasks) * 40)),
      })).sort((a, b) => b.questions - a.questions),
    };

    // Save to DB
    const planData = {
      user_id: userId,
      plan_json: {
        ...planJson,
        subjects: safeSubjects,
        weeklySchedule: safeWeeklySchedule,
        suggestedSimulado,
        config: { examDate, hoursPerDay, daysPerWeek, hasEdital: !!editalText },
        generatedAt: new Date().toISOString(),
      },
    };

    let result;
    if (currentPlanId) {
      const { data, error } = await supabase
        .from("study_plans")
        .update({ plan_json: planData.plan_json })
        .eq("id", currentPlanId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("study_plans")
        .insert(planData)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return new Response(JSON.stringify({ plan: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});