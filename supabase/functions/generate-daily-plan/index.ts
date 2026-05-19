// generate-daily-plan - ENAZIZI COORDENADOR ADAPTATIVO (PLANNER INTELIGENTE)
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { calculatePremiumPriority, calculateExamProximityScore, calculateFsrsRiskScore } from "../_shared/study-prioritization.ts";

Deno.serve(enterpriseEdgeHandler("generate-daily-plan", async ({ req, logger, supabaseAdmin, ai }) => {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const user = { id: auth.userId };

    // 1. Payload and Timezone normalization
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    const userTimezone = body.timezone || "America/Sao_Paulo";
    const forceRegenerate = body.forceRegenerate === true || body.force === true;
    
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    logger.info("DAILY_PLAN_START", "Starting Adaptive Coordinator", { userId: user.id, date: today, forceRegenerate });

    // 2. Prevent duplication check
    if (!forceRegenerate) {
      const { data: existingPlan } = await supabaseAdmin
        .from("daily_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("plan_date", today)
        .maybeSingle();
      
      if (existingPlan) {
        logger.info("DAILY_PLAN_EXISTS", "Returning existing plan", { planId: existingPlan.id });
        return new Response(JSON.stringify({ 
          success: true, 
          planId: existingPlan.id,
          message: "Plano já existente carregado."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 3. Fetch current status (reviews, errors, profile, progress, scores, health, memory)
    const [revisoesRes, errorsRes, profileRes, studyPlanRes, approvalRes, fsrsRes, healthRes, memoryRes] = await Promise.all([
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

    if (!profileData) {
      logger.warn("PROFILE_MISSING", "User profile not found", { userId: user.id });
    }

    // 4. Check if user has a macro plan
    if (!studyPlanRes.data && (revisoesRes.data || []).length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Crie um cronograma antes de gerar a Missão do Dia.",
        type: "NO_STUDY_PLAN"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Calculate real days until exam
    const examDate = profileData?.exam_date ? new Date(profileData.exam_date) : null;
    const daysUntilExamVal = examDate 
      ? Math.max(0, Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
      : 90;

    const dailyHours = profileData?.daily_study_hours || 4;
    const proximityScore = calculateExamProximityScore(daysUntilExamVal);

    // 5. Build context for AI with calculated priorities
    const context = {
      pendingReviews: (revisoesRes.data || []).map(r => ({
        ...r,
        master_priority: calculatePremiumPriority({
          errorRate: 0.2, 
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
          fsrsRisk: 0.8, 
          examProximity: proximityScore,
          currentMastery: 0.1
        })
      })),
      dailyHours,
      targetExams: profileData?.target_exams || [],
      studentLevel: profileData?.level || "beginner",
      macroPlan: studyPlanRes.data?.plan_json || null,
      currentScore: approvalRes.data || { score: 0, phase: "base" },
      fsrsStability: fsrsRes.data?.length ? (fsrsRes.data.reduce((acc: number, c: any) => acc + (c.stability || 0), 0) / fsrsRes.data.length) : 0,
      proximityScore,
      pedagogicalHealth: healthData || { health_score: 100 },
      learningMemory: memoryData || {},
      isPreExamMode: daysUntilExamVal < 15,
      daysUntilExam: daysUntilExamVal,
      today
    };

    const systemPrompt = `Você é o Planner Inteligente do ENAZIZI (Coordenador Adaptativo).
Sua missão é adaptar diariamente o estudo do aluno usando desempenho real, FSRS, Banco de Erros, simulados e telemetria cognitiva.

LÓGICA DE PRIORIZAÇÃO E ADAPTAÇÃO:
1. PRIORIDADE = (TaxaErro * 3) + (ProbabilidadeCair * 3) + (RiscoFSRS * 2) + (ProximidadeProva * 2) - (Domínio * 2)
2. Se PedagogicalHealth < 70: REDUZA a carga horária em 30%. Aumente blocos de recuperação.
3. Se fatigue_index > 80: Substitua blocos teóricos longos por Micro-revisões ou Tutor IA focado.
4. Modo Pré-Prova (daysUntilExam < 15): FOCO TOTAL em Simulados e Revisão Rápida de Erros. Reduza teoria inédita.
5. Use learningMemory para sugerir o melhor horário para cada bloco.

MISSÃO DO DIA (ESTRUTURA):
Gere um JSON com "tasks" contendo: Aquecimento, Teoria/Tutor, Questões, FSRS, Erros, Flashcards, Simulado e Resumo.

SAÍDA ESPERADA (JSON):
{
  "tasks": [
    {
      "type": "tutor_lesson|question_practice|fsrs_review|error_recovery|flashcards|mini_simulado|summary",
      "title": "...",
      "topic": "...",
      "subject": "...",
      "priority": 0-100,
      "estimated_minutes": 0,
      "rationale": "...",
      "objectives": ["..."]
    }
  ],
  "daily_focus": "...",
  "ai_coach_tip": "...",
  "expected_outcome": "..."
}`;

    let planJson: any = null;
    try {
      const aiResponse = await ai({
        taskType: "planner" as any,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere a Missão do Dia adaptativa estruturada com Aquecimento, Teoria/Tutor, Questões, FSRS, Erros, Flashcards, Simulado e Resumo. Use o contexto real do aluno: ${JSON.stringify(context)}` }
        ],
        complexity: "high" as any
      });
      planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "{}");
    } catch (aiErr) {
      logger.error("AI_PLANNER_FAILURE", "AI failed to generate plan, using fallback", { error: aiErr.message });
      // Fallback determinístico
      planJson = {
        tasks: [
          { type: "fsrs_review", title: "Revisão Espaçada (FSRS)", topic: "Revisões Vencidas", subject: "Geral", priority: 90, estimated_minutes: 30, rationale: "Recuperação de memória necessária.", objectives: ["Revisar temas vencidos"] },
          { type: "error_recovery", title: "Recuperação de Erros", topic: "Banco de Erros", subject: "Geral", priority: 85, estimated_minutes: 30, rationale: "Foco nos erros recentes.", objectives: ["Dominar subtemas falhos"] }
        ],
        daily_focus: "Recuperação e Estabilidade (Modo Fallback)",
        ai_coach_tip: "A IA está em manutenção leve, mas sua meta de revisão continua ativa!",
        expected_outcome: "Manutenção do ritmo de estudo."
      };
    }

    const tasks = planJson.tasks || [];

    // 6. DB Persistence with verification
    const { data: finalPlan, error: planErr } = await supabaseAdmin
      .from("daily_plans")
      .upsert({
        user_id: user.id,
        plan_date: today,
        plan_json: { 
          ...planJson,
          generated_at: new Date().toISOString(), 
          source: "ENAZIZI Adaptive Coordinator v2.5" 
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

    if (tasks.length > 0) {
      const taskInserts = tasks.map((t: any, idx: number) => ({
        daily_plan_id: finalPlan.id,
        user_id: user.id,
        title: t.title || t.topic || "Tarefa",
        topic: t.topic,
        specialty: t.subject,
        task_type: t.type,
        priority: String(t.priority || 50),
        estimated_minutes: t.estimated_minutes || 30,
        description: t.rationale,
        ordem: idx,
        completed: false
      }));

      await supabaseAdmin.from("daily_plan_tasks").delete().eq("daily_plan_id", finalPlan.id);
      await supabaseAdmin.from("daily_plan_tasks").insert(taskInserts);
    }

    // 7. Success Response
    return new Response(JSON.stringify({ 
      success: true, 
      planId: finalPlan.id, 
      tasks,
      coachTip: planJson.ai_coach_tip 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logger.critical("UNHANDLED_COORDINATOR_ERROR", err.message, { stack: err.stack });
    
    // Fallback JSON Response to avoid White Screen
    return new Response(JSON.stringify({
      success: false,
      error: "O Coordenador Adaptativo encontrou um problema temporário.",
      details: err.message,
      type: "ADAPTIVE_ERROR"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}));
