// generate-study-plan - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";

Deno.serve(enterpriseEdgeHandler("generate-study-plan", async ({ req, logger, waitUntil, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { examDate, hoursPerDay, daysPerWeek, editalText, strictMode } = body;

  logger.info("PLAN_GEN_START", "Starting study plan generation", { 
    userId: user.id, 
    examDate, 
    hoursPerDay, 
    daysPerWeek 
  });

  const { data: plan, error: insertErr } = await supabaseAdmin
    .from("study_plans")
    .insert({ 
      user_id: user.id, 
      status: "processing",
      current_step: "Analisando perfil e objetivos...",
      progress: 10
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  waitUntil((async () => {
    try {
      // Step 2: Extract topics (if edital provided) or use defaults
      await supabaseAdmin.from("study_plans").update({ current_step: "Mapeando temas da prova...", progress: 30 }).eq("id", plan.id);
      
      const systemPrompt = `Você é o Diretor Pedagógico da ENAZIZI, uma plataforma de elite para preparação de residência médica.
Sua missão é criar um Cronograma de Estudos de ALTO IMPACTO baseado em evidências (Ciclo de Estudos + Repetição Espaçada).

Sua missão é criar um plano de estudos médico completo, inteligente, realista e adaptativo baseado no perfil do aluno, edital, prova, PDF enviado, desempenho e tempo disponível.

Você NÃO é um gerador genérico de tarefas.
Você funciona como um estrategista pedagógico de alta performance.

────────────────────────────
1. OBJETIVO
────────────────────────────
Criar um cronograma completo e coerente que:
- cubra todo o edital;
- respeite o tempo disponível;
- priorize temas de maior incidência;
- priorize disciplinas fracas;
- integre revisões FSRS;
- integre simulados;
- integre Banco de Erros;
- integre Tutor IA;
- gere Missão do Dia;
- adapte-se conforme desempenho futuro.

────────────────────────────
2. LÓGICA DE PRIORIZAÇÃO
────────────────────────────
Prioridade deve considerar:
PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) - (DomínioAtual × 2)

Também considerar: tempo sem revisar, recorrência de erro, dificuldade da disciplina, carga horária restante, fadiga cognitiva, equilíbrio semanal.

────────────────────────────
3. ESTRUTURA DO CRONOGRAMA
────────────────────────────
Cada dia deve conter:
1. Aula principal;
2. Explicação Tutor IA;
3. Questões;
4. Revisão FSRS;
5. Banco de Erros;
6. Flashcards;
7. Mini revisão;
8. Mini simulado (quando necessário);
9. Resumo do dia.

REGRAS CRÍTICAS:
- Nunca criar cronograma impossível;
- Nunca inventar conteúdo fora do edital/PDF;
- Sempre justificar prioridades.

FORMATO JSON ESPERADO:
{
  "weeklySchedule": [
    {
      "day": "Segunda-feira",
      "tasks": [
        { "time": "08:00", "subject": "Cardiologia: Hipertensão", "duration": "90min", "type": "theory", "priority": 95, "details": "Foco em novas diretrizes", "integration": "Tutor IA + Questões" }
      ]
    }
  ],
  "subjects": ["Cardiologia", "..."],
  "topicMap": [ { "topic": "Cardiologia", "subtopics": ["HAS", "IC"] } ],
  "tips": "...",
  "detectedSpecialty": "..."
}

Se strictMode for true e editalText for fornecido, use APENAS os temas do edital.`;

      const userMessage = `Gere um plano de estudos personalizado.
Disponibilidade: ${hoursPerDay}h/dia, ${daysPerWeek} dias/semana.
Data da prova: ${examDate}.
${editalText ? `Edital: ${editalText.slice(0, 3000)}` : "Use os temas mais incidentes em provas de residência médica no Brasil (ENARE, USP, SUS-SP)."}

Retorne APENAS o JSON.`;

      const aiResponse = await ai({
        taskType: "planner",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        complexity: "high"
      });

      const planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "{}");
      
      if (!planJson.weeklySchedule) {
        throw new Error("Falha ao gerar estrutura do cronograma.");
      }

      await supabaseAdmin.from("study_plans").update({ 
        plan_json: planJson, 
        status: "completed",
        current_step: "Finalizado",
        progress: 100
      }).eq("id", plan.id);

      logger.info("PLAN_GEN_SUCCESS", "Study plan generated successfully", { planId: plan.id });

    } catch (err) {
      logger.error("PLAN_GEN_ERROR", err.message, { planId: plan.id });
      await supabaseAdmin.from("study_plans").update({ 
        status: "error", 
        error_message: err.message,
        current_step: "Erro na geração" 
      }).eq("id", plan.id);
    }
  })());

  return new Response(JSON.stringify({ success: true, planId: plan.id }), { 
    status: 202, 
    headers: { "Content-Type": "application/json" } 
  });
}));
