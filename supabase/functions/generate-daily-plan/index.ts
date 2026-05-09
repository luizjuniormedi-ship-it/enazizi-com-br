import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/** Returns YYYY-MM-DD in São Paulo time (BRT/BRST aware via Intl). */
function todayBR(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA -> YYYY-MM-DD
}

// Auth: requireAuth helper (getClaims + fallback getUser, canonical 401 JSON).

// ── Approval-score weight logic (mirrored from client) ─────────
interface PlanWeights {
  reviewWeight: number;
  theoryWeight: number;
  questionsWeight: number;
  practicalWeight: number;
  maxNewTopics: number;
  phase: string;
}

function adjustPlanByApprovalScore(score: number): PlanWeights {
  if (score < 50) {
    return { reviewWeight: 0.40, theoryWeight: 0.15, questionsWeight: 0.35, practicalWeight: 0.10, maxNewTopics: 1, phase: "critico" };
  }
  if (score < 70) {
    return { reviewWeight: 0.30, theoryWeight: 0.15, questionsWeight: 0.30, practicalWeight: 0.25, maxNewTopics: 2, phase: "atencao" };
  }
  if (score < 85) {
    return { reviewWeight: 0.20, theoryWeight: 0.10, questionsWeight: 0.25, practicalWeight: 0.45, maxNewTopics: 3, phase: "competitivo" };
  }
  return { reviewWeight: 0.15, theoryWeight: 0.05, questionsWeight: 0.20, practicalWeight: 0.60, maxNewTopics: 2, phase: "pronto" };
}

/** SHA-256 hex (sub-resource Web Crypto). */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    

    // ── Loop 2: idempotência por request_hash ───────────────────
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* body opcional */ }
    const clientRequestId = typeof body.client_request_id === "string" ? body.client_request_id : null;
    const targetExam = typeof body.target_exam === "string" ? body.target_exam : "";
    const studyMinutes = Number.isFinite(body.study_minutes as number) ? Number(body.study_minutes) : 0;
    const force = body.force === true;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const today = todayBR();

    const requestHash = await sha256Hex(
      `${userId}|${today}|${targetExam}|${studyMinutes}|${clientRequestId ?? ""}`
    );

    if (!force) {
      const { data: existing } = await adminClient
        .from("daily_plans")
        .select("id, plan_json, total_blocks, request_hash")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .eq("request_hash", requestHash)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            date: today,
            request_hash: requestHash,
            total_tasks: existing.total_blocks ?? 0,
            plan_json: existing.plan_json,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Reset fence: a "jornada atual" só considera dados criados/atualizados
    // após o último reset manual do plano. Histórico pedagógico permanece intacto
    // nas tabelas, mas é ignorado por este motor ao montar o plano de hoje.
    const { data: resetProfile } = await adminClient
      .from("profiles")
      .select("last_study_plan_reset_at")
      .eq("user_id", userId)
      .maybeSingle();
    const resetAt: string = (resetProfile as any)?.last_study_plan_reset_at
      || "1900-01-01T00:00:00Z";

    // Fetch inputs in parallel
    const [revisoesRes, errorsRes, desempenhoRes, temasRes, profilesRes, domainRes, practiceRes, examRes, anamnesisRes, clinicalRes] =
      await Promise.all([
        adminClient
          .from("revisoes")
          .select("id, tema_id, data_revisao, prioridade, risco_esquecimento, status, temas_estudados(tema, especialidade)")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .gt("created_at", resetAt)
          .lte("data_revisao", today)
          .order("prioridade", { ascending: false })
          .limit(10),
        adminClient
          .from("error_bank")
          .select("id, tema, subtema, vezes_errado, categoria_erro")
          .eq("user_id", userId)
          .eq("dominado", false)
          .gt("updated_at", resetAt)
          .order("vezes_errado", { ascending: false })
          .limit(10),
        adminClient
          .from("desempenho_questoes")
          .select("tema_id, taxa_acerto, questoes_feitas, temas_estudados(tema, especialidade)")
          .eq("user_id", userId)
          .gt("data_registro", resetAt)
          .order("taxa_acerto", { ascending: true })
          .limit(15),
        adminClient
          .from("temas_estudados")
          .select("id, tema, especialidade, dificuldade, status")
          .eq("user_id", userId)
          .eq("status", "ativo")
          .gt("created_at", resetAt)
          .order("data_estudo", { ascending: false })
          .limit(20),
        adminClient
          .from("user_topic_profiles")
          .select("topic, accuracy, mastery_level, next_review_at")
          .eq("user_id", userId),
        adminClient
          .from("medical_domain_map")
          .select("specialty, domain_score, questions_answered")
          .eq("user_id", userId),
        adminClient
          .from("practice_attempts")
          .select("correct")
          .eq("user_id", userId)
          .limit(500),
        adminClient
          .from("exam_sessions")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "finished")
          .limit(10),
        adminClient
          .from("anamnesis_results")
          .select("id")
          .eq("user_id", userId)
          .limit(10),
        adminClient
          .from("simulation_history")
          .select("id")
          .eq("user_id", userId)
          .limit(10),
      ]);

    // ── Compute approval score ──────────────────────────────────
    const domains = (domainRes.data || []) as any[];
    const avgDomain = domains.length > 0
      ? domains.reduce((s: number, d: any) => s + (d.domain_score || 0), 0) / domains.length
      : 0;

    const practiceData = (practiceRes.data || []) as any[];
    const totalPractice = practiceData.length;
    const totalCorrect = practiceData.filter((a: any) => a.correct).length;
    const accuracy = totalPractice > 0 ? (totalCorrect / totalPractice) * 100 : 0;
    const volumeScore = Math.min((totalPractice / 500) * 100, 100);

    const activities = [
      totalPractice > 0,
      (examRes.data || []).length > 0,
      (clinicalRes.data || []).length > 0,
      (anamnesisRes.data || []).length > 0,
    ].filter(Boolean).length;
    const diversityScore = (activities / 6) * 100;

    const approvalScore = Math.round(
      accuracy * 0.35 + avgDomain * 0.25 + volumeScore * 0.20 + diversityScore * 0.20
    );

    const weights = adjustPlanByApprovalScore(approvalScore);

    // ── Build task list ─────────────────────────────────────────
    interface DailyTask {
      type: "review" | "error_fix" | "practice" | "new_topic" | "clinical" | "simulado";
      topic: string;
      specialty: string;
      priority: number;
      reason: string;
      suggested_module: string;
      estimated_minutes: number;
      meta?: Record<string, unknown>;
    }

    const tasks: DailyTask[] = [];

    // 1. Overdue reviews
    const reviewBonus = weights.phase === "critico" ? 5 : 0;
    for (const rev of (revisoesRes.data || []) as any[]) {
      const tema = rev.temas_estudados?.tema || "Revisão";
      const spec = rev.temas_estudados?.especialidade || "Geral";
      const isHighRisk = rev.risco_esquecimento === "alto";
      tasks.push({
        type: "review",
        topic: tema,
        specialty: spec,
        priority: 90 + (isHighRisk ? 5 : 0) + reviewBonus,
        reason: `Revisão atrasada${isHighRisk ? " (alto risco)" : ""}`,
        suggested_module: "cronograma",
        estimated_minutes: 15,
        meta: { revisao_id: rev.id, tema_id: rev.tema_id },
      });
    }

    // 2. Error bank
    for (const err of (errorsRes.data || []) as any[]) {
      tasks.push({
        type: "error_fix",
        topic: err.tema,
        specialty: err.subtema || "Geral",
        priority: 70 + Math.min(err.vezes_errado * 3, 15),
        reason: `Errou ${err.vezes_errado}x — precisa revisar`,
        suggested_module: "banco-erros",
        estimated_minutes: 10,
        meta: { error_id: err.id },
      });
    }

    // 3. Weak topics
    const weakTopics = ((desempenhoRes.data || []) as any[]).filter(
      (d: any) => d.taxa_acerto < 60 && d.questoes_feitas >= 3
    );
    const coveredByReview = new Set(tasks.map((t) => t.topic));
    for (const w of weakTopics) {
      const tema = w.temas_estudados?.tema || "Tema";
      if (coveredByReview.has(tema)) continue;
      const spec = w.temas_estudados?.especialidade || "Geral";
      tasks.push({
        type: "practice",
        topic: tema,
        specialty: spec,
        priority: 55 + Math.round((60 - w.taxa_acerto) / 2),
        reason: `Acerto de ${Math.round(w.taxa_acerto)}% — pratique mais`,
        suggested_module: "questoes",
        estimated_minutes: 20,
        meta: { tema_id: w.tema_id },
      });
    }

    // 4. Clinical practice (boosted in competitive/ready phases)
    const clinicalPriority = weights.phase === "pronto" ? 80 : weights.phase === "competitivo" ? 65 : 40;
    if (weights.practicalWeight >= 0.20) {
      tasks.push({
        type: "clinical",
        topic: "Plantão Simulado",
        specialty: "Prática Clínica",
        priority: clinicalPriority,
        reason: weights.phase === "pronto" ? "Fase final: pratique casos clínicos" : "Treino prático recomendado",
        suggested_module: "plantao",
        estimated_minutes: 30,
      });
      tasks.push({
        type: "clinical",
        topic: "Anamnese",
        specialty: "Semiologia",
        priority: clinicalPriority - 5,
        reason: "Treino de anamnese com paciente virtual",
        suggested_module: "anamnese",
        estimated_minutes: 25,
      });
    }

    // 5. Simulado (boosted in ready phase)
    if (weights.phase === "pronto" || weights.phase === "competitivo") {
      tasks.push({
        type: "simulado",
        topic: "Simulado Completo",
        specialty: "Geral",
        priority: weights.phase === "pronto" ? 85 : 55,
        reason: "Teste em condições reais de prova",
        suggested_module: "simulados",
        estimated_minutes: 60,
      });
    }

    // 6. New topics (limited by weights)
    const covered = new Set(tasks.map((t) => t.topic));
    let newCount = 0;
    for (const tema of (temasRes.data || []) as any[]) {
      if (covered.has(tema.tema)) continue;
      const profile = ((profilesRes.data || []) as any[]).find((p: any) => p.topic === tema.tema);
      if (profile && profile.mastery_level >= 4) continue;
      tasks.push({
        type: "new_topic",
        topic: tema.tema,
        specialty: tema.especialidade,
        priority: 30,
        reason: "Tema ativo no cronograma",
        suggested_module: "tutor",
        estimated_minutes: 25,
        meta: { tema_id: tema.id },
      });
      newCount++;
      if (newCount >= weights.maxNewTopics) break;
    }

    // ── Apply weight-based slot limits ──────────────────────────
    tasks.sort((a, b) => b.priority - a.priority);
    const maxTotal = 8;
    const slots: Record<string, number> = {};
    const limits: Record<string, number> = {
      review: Math.max(1, Math.round(maxTotal * weights.reviewWeight)),
      error_fix: Math.max(1, Math.round(maxTotal * weights.questionsWeight)),
      practice: Math.max(1, Math.round(maxTotal * weights.questionsWeight)),
      clinical: Math.round(maxTotal * weights.practicalWeight),
      simulado: Math.round(maxTotal * weights.practicalWeight),
      new_topic: weights.maxNewTopics,
    };

    const dailyTasks: DailyTask[] = [];
    for (const task of tasks) {
      if (dailyTasks.length >= maxTotal) break;
      const type = task.type;
      if ((slots[type] || 0) < (limits[type] || 2)) {
        dailyTasks.push(task);
        slots[type] = (slots[type] || 0) + 1;
      }
    }

    // Loop 2: shape canônico v2
    const canonicalPlan = {
      tasks: dailyTasks,
      metadata: {
        version: "v2",
        generated_at: new Date().toISOString(),
        source: "generate-daily-plan",
        approval_score: approvalScore,
        phase: weights.phase,
        weights,
        client_request_id: clientRequestId,
        target_exam: targetExam || null,
        study_minutes: studyMinutes || null,
      },
    };

    const planData = {
      user_id: userId,
      plan_date: today,
      plan_json: canonicalPlan,
      request_hash: requestHash,
      total_blocks: dailyTasks.length,
      completed_count: 0,
      completed_blocks: [],
    };

    const { error: upsertErr } = await adminClient
      .from("daily_plans")
      .upsert(planData, { onConflict: "user_id,plan_date" });

    if (upsertErr) {
      const { data: existing } = await adminClient
        .from("daily_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("daily_plans")
          .update({
            plan_json: canonicalPlan,
            request_hash: requestHash,
            total_blocks: dailyTasks.length,
          })
          .eq("id", existing.id);
      } else {
        await adminClient.from("daily_plans").insert(planData);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        request_hash: requestHash,
        approval_score: approvalScore,
        phase: weights.phase,
        weights,
        total_tasks: dailyTasks.length,
        tasks: dailyTasks,
        plan_json: canonicalPlan,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-daily-plan] fatal:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: corsHeaders }
    );
  }
});
