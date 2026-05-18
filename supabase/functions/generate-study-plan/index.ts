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

REGRAS DE OURO:
1. FOCO TOTAL: Priorize Clínica Médica, Cirurgia, Pediatria, GO e Preventiva.
2. ESTRUTURA: Retorne um JSON estrito.
3. CARGA: O aluno tem ${hoursPerDay}h por dia, ${daysPerWeek} dias por semana.
4. DATA DA PROVA: ${examDate}.

FORMATO JSON ESPERADO:
{
  "weeklySchedule": [
    {
      "day": "Segunda-feira",
      "tasks": [
        { "time": "08:00", "subject": "Cardiologia: Hipertensão", "duration": "90min", "type": "theory", "details": "Foco em novas diretrizes" },
        { "time": "09:30", "subject": "Questões: Hipertensão", "duration": "30min", "type": "practice" }
      ]
    }
    // ... total 7 dias
  ],
  "subjects": ["Cardiologia", "Pneumologia", "Gastroenterologia", "Infectologia", "Nefrologia"],
  "topicMap": [
    { "topic": "Cardiologia", "subtopics": ["HAS", "IC", "SCA", "Valvopatias"] }
  ],
  "tips": "Foque em questões da banca escolhida.",
  "detectedSpecialty": "Clínica Médica"
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
