// generate-daily-plan - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";

Deno.serve(enterpriseEdgeHandler("generate-daily-plan", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  logger.info("DAILY_PLAN_START", "Starting daily mission generation", { userId: user.id });

  // 1. Fetch current status (reviews, errors, profile)
  const [revisoesRes, errorsRes, profileRes] = await Promise.all([
    supabaseAdmin.from("revisoes")
      .select("id, tema_id, data_revisao, prioridade")
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .lte("data_revisao", today)
      .order("prioridade", { ascending: false })
      .limit(10),
    supabaseAdmin.from("error_bank")
      .select("id, tema, subtema, vezes_errado")
      .eq("user_id", user.id)
      .eq("dominado", false)
      .order("vezes_errado", { ascending: false })
      .limit(5),
    supabaseAdmin.from("profiles")
      .select("daily_study_hours, target_exams")
      .eq("user_id", user.id)
      .single()
  ]);

  const dailyHours = profileRes.data?.daily_study_hours || 4;
  
  // 2. Build context for AI
  const context = {
    pendingReviews: revisoesRes.data || [],
    topErrors: errorsRes.data || [],
    dailyHours,
    targetExams: profileRes.data?.target_exams || []
  };

  const systemPrompt = `Você é o Planner Inteligente do ENAZIZI.
Sua missão é adaptar diariamente o estudo do aluno usando desempenho real, FSRS, Banco de Erros, simulados e telemetria cognitiva.
Você NÃO cria apenas tarefas. Você toma decisões pedagógicas adaptativas.

────────────────────────────
1. OBJETIVO
────────────────────────────
Decidir: o que estudar hoje, o que revisar, o que recuperar, o que priorizar.

────────────────────────────
2. MISSÃO DO DIA
────────────────────────────
Monte:
1. Aquecimento;
2. Aula principal;
3. Questões guiadas;
4. Correção;
5. Revisões FSRS;
6. Recuperação de erros;
7. Flashcards;
8. Mini simulado;
9. Resumo final.

────────────────────────────
3. REGRAS ADAPTATIVAS
────────────────────────────
- Se aluno erra muito: aumentar revisão, reduzir carga nova, ativar recuperação.
- Se aluno atrasa: reorganizar cronograma, priorizar essencial.
- Prova se aproximando: aumentar incidência e revisão ativa.

FORMATO JSON:
{
  "tasks": [
    { 
      "type": "review", 
      "topic": "Cardiologia", 
      "priority": 90, 
      "estimated_minutes": 20, 
      "rationale": "Baseado em revisão FSRS pendente",
      "meta": { "revisao_id": "uuid" } 
    },
    { "type": "error_fix", "topic": "Pneumologia", "priority": 85, "estimated_minutes": 15, "rationale": "Recuperação de erro recorrente no banco" },
    { "type": "study", "topic": "Ginecologia", "priority": 70, "estimated_minutes": 45, "rationale": "Novo tema do cronograma macro" }
  ]
}`;

  const aiResponse = await ai({
    taskType: "planner",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Gere a missão do dia com base: ${JSON.stringify(context)}` }
    ]
  });

  const planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "{}");
  const tasks = planJson.tasks || [];

  const { data: finalPlan, error: planErr } = await supabaseAdmin
    .from("daily_plans")
    .upsert({
      user_id: user.id,
      plan_date: today,
      plan_json: { tasks, generated_at: new Date().toISOString(), source: "generate-daily-plan" },
      total_blocks: tasks.length,
      completed_count: 0
    }, { onConflict: "user_id,plan_date" })
    .select("id")
    .single();

  if (planErr) throw planErr;

  return new Response(JSON.stringify({ success: true, planId: finalPlan.id, tasks }), {
    headers: { "Content-Type": "application/json" }
  });
}));
