// generate-daily-plan - ENAZIZI COORDENADOR ADAPTATIVO (PLANNER INTELIGENTE)
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
      .select("daily_study_hours, target_exams, level, study_streak")
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
      .limit(30)
  ]);


  const dailyHours = profileRes.data?.daily_study_hours || 4;
  
  // 2. Build context for AI
  const context = {
    pendingReviews: revisoesRes.data || [],
    topErrors: errorsRes.data || [],
    dailyHours,
    targetExams: profileRes.data?.target_exams || [],
    studentLevel: profileRes.data?.level || "beginner",
    macroPlan: studyPlanRes.data?.plan_json || null,
    currentScore: approvalRes.data || { score: 0, phase: "base" },
    fsrsStability: fsrsRes.data?.length ? (fsrsRes.data.reduce((acc, c) => acc + (c.stability || 0), 0) / fsrsRes.data.length) : 0,
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
2. MISSÃO DO DIA (ESTRUTURA)
────────────────────────────

Monte a sequência ideal:
1. Aquecimento (Mental/Foco);
2. Aula principal (Teoria);
3. Explicação Tutor IA;
4. Questões guiadas;
5. Correção e Feedback;
6. Revisões FSRS (Espaçada);
7. Recuperação de erros (Banco de Erros);
8. Flashcards (Memorização);
9. Mini simulado (Validação);
10. Resumo final.

────────────────────────────
3. REGRAS ADAPTATIVAS (OBLIGATÓRIAS)
────────────────────────────

- Se aluno erra muito: aumentar tempo de revisão, reduzir carga de conteúdo novo, ativar recuperação imediata.
- Se aluno atrasa tarefas: reorganizar o cronograma, priorizar o que tem mais peso na prova, reduzir o tempo de aulas.
- Prova se aproximando: aumentar incidência de questões e revisões ativas (flashcards).
- Fadiga detectada: sugerir blocos menores com pausas estratégicas.

────────────────────────────
4. LÓGICA DE PRIORIZAÇÃO
────────────────────────────

Prioridade deve considerar:
PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) - (DomínioAtual × 2)

────────────────────────────
5. SAÍDA ESPERADA (JSON)
────────────────────────────

{
  "tasks": [
    {
      "type": "theory|practice|review|error_fix|simulation",
      "topic": "...",
      "subject": "...",
      "priority": 0-100,
      "estimated_minutes": 0,
      "rationale": "Justificativa pedagógica para esta tarefa",
      "objectives": ["...", "..."],
      "meta": {
        "revisao_id": "...",
        "error_id": "..."
      }
    }
  ],
  "daily_focus": "...",
  "ai_coach_tip": "...",
  "expected_outcome": "...",
  "diagnostics": {
    "suggested_score_adjustment": -5 to +5,
    "suggested_phase": "base|intensive|review|recovery",
    "recovery_mode": boolean,
    "cognitive_load_estimate": "low|medium|high"
  }
}


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
      { role: "user", content: `Gere a Missão do Dia adaptativa com base no contexto: ${JSON.stringify(context)}` }
    ],
    complexity: "medium"
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

  // Record governance log
  try {
    await supabaseAdmin.from("ai_governance_logs").insert({
      user_id: user.id,
      task_type: "daily_plan_generation",
      model_name: "google/gemini-2.0-flash", // Using standard model for daily
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