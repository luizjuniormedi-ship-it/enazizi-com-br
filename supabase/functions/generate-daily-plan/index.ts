// generate-daily-plan - ENAZIZI COORDENADOR ADAPTATIVO (PLANNER INTELIGENTE)
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { calculatePremiumPriority, calculateExamProximityScore, calculateFsrsRiskScore } from "../_shared/study-prioritization.ts";


Deno.serve(enterpriseEdgeHandler("generate-daily-plan", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  logger.info("DAILY_PLAN_START", "Starting Adaptive Coordinator", { userId: user.id });

  // 1. Fetch current status (reviews, errors, profile, progress, scores)
  const [revisoesRes, errorsRes, profileRes, studyPlanRes, approvalRes, fsrsRes] = await Promise.all([
    supabaseAdmin.from("revisoes")
      .select("id, tema_id, data_revisao, prioridade, estabilidade, dificuldade")
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .lte("data_revisao", today)
      .order("prioridade", { ascending: false })
      .limit(10),
    supabaseAdmin.from("error_bank")
      .select("id, tema, subtema, vezes_errado, ultima_tentativa")
      .eq("user_id", user.id)
      .eq("dominado", false)
      .order("vezes_errado", { ascending: false })
      .limit(5),
    supabaseAdmin.from("profiles")
      .select("daily_study_hours, target_exams, level, study_streak, exam_date")
      .eq("user_id", user.id)
      .single(),
    supabaseAdmin.from("study_plans")
      .select("plan_json")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("approval_scores")
      .select("score, phase, review_score")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("fsrs_cards")
      .select("stability, difficulty, reps")
      .eq("user_id", user.id)
      .limit(30),
    supabaseAdmin.from("pedagogical_health_indices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("pedagogical_memory_layer")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const profileData = profileRes.data;
  const healthData = healthRes.data;
  const memoryData = memoryRes.data;

  // Calculate real days until exam
  const examDate = profileData?.exam_date ? new Date(profileData.exam_date) : null;
  const daysUntilExam = examDate 
    ? Math.max(0, Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 90;



  const dailyHours = profileRes.data?.daily_study_hours || 4;
  
  // 2. Pre-calculate Prioritization Variables
  const daysUntilExam = profileRes.data?.target_exams?.[0] ? 60 : 90; // Placeholder until we have specific target dates per exam
  const proximityScore = calculateExamProximityScore(daysUntilExam);

  // 3. Build context for AI with calculated priorities
  const context = {
    pendingReviews: (revisoesRes.data || []).map(r => ({
      ...r,
      master_priority: calculatePremiumPriority({
        errorRate: 0.2, // Need to fetch from performance_metrics if available
        fallProbability: 0.5,
        fsrsRisk: calculateFsrsRiskScore(r.estabilidade),
        examProximity: proximityScore,
        currentMastery: 0.4
      })
    })),
    topErrors: (errorsRes.data || []).map(e => ({
      ...e,
      master_priority: calculatePremiumPriority({
        errorRate: Math.min(1, (e.vezes_errado || 1) / 5),
        fallProbability: 0.7,
        fsrsRisk: 0.8, // High risk if actively making errors
        examProximity: proximityScore,
        currentMastery: 0.1
      })
    })),
    dailyHours,
    targetExams: profileRes.data?.target_exams || [],
    studentLevel: profileRes.data?.level || "beginner",
    macroPlan: studyPlanRes.data?.plan_json || null,
    currentScore: approvalRes.data || { score: 0, phase: "base" },
    fsrsStability: fsrsRes.data?.length ? (fsrsRes.data.reduce((acc, c) => acc + (c.stability || 0), 0) / fsrsRes.data.length) : 0,
    proximityScore,
    pedagogicalHealth: healthData || { health_score: 100 },
    learningMemory: memoryData || {},
    isPreExamMode: daysUntilExam < 15,
    daysUntilExam,
    today
  };




  const systemPrompt = `Você é o Planner Inteligente do ENAZIZI (Coordenador Adaptativo).

Sua missão é adaptar diariamente o estudo do aluno usando desempenho real, FSRS, Banco de Erros, simulados e telemetria cognitiva.

Você NÃO cria apenas tarefas. Você toma decisões pedagógicas adaptativas em tempo real.

────────────────────────────
1. OBJETIVO
────────────────────────────

Decidir: o que estudar hoje, o que revisar, o que recuperar, o que priorizar.
Atuar como um coordenador pedagógico de alta performance.

────────────────────────────
2. LÓGICA DE PRIORIZAÇÃO (OBRIGATÓRIA)
────────────────────────────

Você DEVE calcular a prioridade de cada tema usando a seguinte fórmula mental:
PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) - (DomínioAtual × 2)

────────────────────────────
3. MISSÃO DO DIA (ESTRUTURA)
────────────────────────────

Monte a sequência ideal para hoje:
1. Aquecimento Rápido (Mental/Foco);
2. Aula principal (Teoria) ou Tutor IA;
3. Questões guiadas com correção focada;
4. Revisões FSRS (Espaçada);
5. Recuperação de erros (Banco de Erros);
6. Flashcards (Memorização);
7. Mini simulado (Validação);
8. Resumo final e performance.

────────────────────────────
4. SAÍDA ESPERADA (JSON)
────────────────────────────

{
  "tasks": [
    {
      "type": "tutor_lesson|question_practice|fsrs_review|error_recovery|flashcards|mini_simulado|summary",
      "title": "Título curto e direto",
      "topic": "Tópico clínico exato",
      "subject": "Especialidade/Disciplina",
      "priority": 0-100,
      "estimated_minutes": 0,
      "rationale": "Justificativa pedagógica baseada no desempenho",
      "objectives": ["...", "..."]
    }
  ],
  "daily_focus": "Tema principal do dia",
  "ai_coach_tip": "Dica de performance",
  "expected_outcome": "O que o aluno deve dominar ao fim do dia"
}
`;



────────────────────────────
6. REGRAS CRÍTICAS
────────────────────────────

Nunca:
- ignorar revisão vencida;
- ignorar erro recorrente;
- gerar sobrecarga;
- criar tarefas genéricas;
- repetir conteúdo sem motivo.

Sempre:
- priorizar retenção;
- otimizar aprovação;
- adaptar dificuldade;
- explicar decisões.`;

  const aiResponse = await ai({
    taskType: "planner",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Gere a Missão do Dia adaptativa estruturada com Aquecimento, Teoria/Tutor, Questões, FSRS, Erros, Flashcards, Simulado e Resumo. Use o contexto real do aluno: ${JSON.stringify(context)}` }
    ],
    complexity: "high"
  });


  const planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "{}");
  const tasks = planJson.tasks || [];

  // Upsert daily plan
  const { data: finalPlan, error: planErr } = await supabaseAdmin
    .from("daily_plans")
    .upsert({
      user_id: user.id,
      plan_date: today,
      plan_json: { 
        ...planJson,
        generated_at: new Date().toISOString(), 
        source: "ENAZIZI Adaptive Coordinator v2" 
      },
      total_blocks: tasks.length,
      completed_count: 0,
      approval_score: context.currentScore.score + (planJson.diagnostics?.suggested_score_adjustment || 0),
      phase: planJson.diagnostics?.suggested_phase || context.currentScore.phase,
      recovery_mode: !!planJson.diagnostics?.recovery_mode,
      objective: planJson.daily_focus,
      diagnosis_summary: planJson.expected_outcome
    }, { onConflict: "user_id,plan_date" })
    .select("id")
    .single();

  if (planErr) throw planErr;

  // Bulk insert tasks into operational table
  if (tasks.length > 0) {
    const taskInserts = tasks.map((t: any, idx: number) => ({
      daily_plan_id: finalPlan.id,
      user_id: user.id,
      title: t.title || t.topic,
      topic: t.topic,
      specialty: t.subject,
      task_type: t.type,
      priority: String(t.priority),
      estimated_minutes: t.estimated_minutes,
      description: t.rationale,
      ordem: idx,
      completed: false
    }));


    // Clean existing tasks for today to avoid duplicates on regen
    await supabaseAdmin.from("daily_plan_tasks").delete().eq("daily_plan_id", finalPlan.id);
    await supabaseAdmin.from("daily_plan_tasks").insert(taskInserts);
  }


  // Record governance log
  try {
    await supabaseAdmin.from("ai_governance_logs").insert({
      user_id: user.id,
      task_type: "daily_plan_generation",
      model_name: "google/gemini-2.5-flash", // Using standard model for daily
      payload: { context_summary: "Daily adaptive generation" },
      response_summary: `Generated ${tasks.length} tasks`
    });
  } catch (logErr) {
    logger.warn("GOVERNANCE_LOG_FAIL", logErr.message);
  }

  return new Response(JSON.stringify({ 
    success: true, 
    planId: finalPlan.id, 
    tasks,
    coachTip: planJson.ai_coach_tip 
  }), {
    headers: { "Content-Type": "application/json" }
  });
}));