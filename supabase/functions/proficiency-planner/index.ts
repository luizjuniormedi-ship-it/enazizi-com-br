/**
 * proficiency-planner — Modo `plannerMode = "proficiencia"`
 *
 * Gerador DETERMINÍSTICO (sem IA) que distribui os subtopic_id estruturados
 * de um professor_plan ao longo das semanas até exam_date, conforme intensidade.
 *
 * Fase 4: agora aceita `reason` opcional e registra evento em
 * `professor_plan_recalculations` quando recalcula a partir de um gatilho
 * (missed_goal, teacher_update, manual). Também atualiza
 * `professor_plan_progress` com contagens reais (completed/pending/overdue).
 *
 * Regras:
 *  - Idempotente: dedupe por (planned_date, task_type, subtopic_id).
 *  - Nunca mexe no passado (planned_date >= today).
 *  - Tarefas completed/skipped continuam intocadas (somente ADD).
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Intensity = "leve" | "moderado" | "intenso";
type RecalcType = "manual" | "missed_goal" | "teacher_update" | "auto";

interface IntensityProfile {
  tasksPerDay: number;
  daysPerWeek: number;
}

const INTENSITY: Record<Intensity, IntensityProfile> = {
  leve: { tasksPerDay: 2, daysPerWeek: 4 },
  moderado: { tasksPerDay: 3, daysPerWeek: 5 },
  intenso: { tasksPerDay: 4, daysPerWeek: 6 },
};

interface RequestBody {
  planId: string;
  /** Para qual aluno gerar. Se omitido, usa o usuário autenticado (uso pelo aluno). */
  targetUserId?: string;
  /** Motivo do recálculo (registrado em professor_plan_recalculations). */
  reason?: RecalcType;
  /** Texto adicional explicativo do motivo. */
  reasonText?: string;
}

interface SubtopicRow {
  subtopic_id: string;
  sort_order: number | null;
  curriculum_subtopics: { nome: string; topic_id: string } | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function buildStudyDates(start: Date, exam: Date, daysPerWeek: number): Date[] {
  const dates: Date[] = [];
  const restDays = 7 - daysPerWeek;
  let cursor = new Date(start);
  while (cursor.getTime() <= exam.getTime()) {
    const dow = cursor.getUTCDay();
    const restSet = new Set<number>();
    if (restDays >= 1) restSet.add(0);
    if (restDays >= 2) restSet.add(6);
    if (restDays >= 3) restSet.add(5);
    if (!restSet.has(dow)) dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.planId) {
      return new Response(JSON.stringify({ error: "planId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carregar plano
    const { data: plan, error: planErr } = await admin
      .from("professor_plans")
      .select("id, name, exam_date, intensity, status, created_by")
      .eq("id", body.planId)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plan.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Plano não está ativo", status: plan.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isOwner = plan.created_by === user.id;

    // Resolver target user
    const targetUserId = body.targetUserId ?? user.id;

    // Se o caller é dono (professor) e indicou outro target, validar que o target é alvo do plano.
    // Caso contrário, exigir que o caller seja alvo.
    if (targetUserId !== user.id) {
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Apenas o dono pode replanejar para outros" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: tgtIs } = await admin.rpc("user_is_target_of_plan", {
        _user_id: targetUserId,
        _plan_id: plan.id,
      });
      if (!tgtIs) {
        return new Response(JSON.stringify({ error: "targetUserId não é alvo do plano" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: callerIs } = await admin.rpc("user_is_target_of_plan", {
        _user_id: user.id,
        _plan_id: plan.id,
      });
      if (!callerIs && !isOwner) {
        return new Response(JSON.stringify({ error: "Usuário não é alvo do plano" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!plan.exam_date) {
      return new Response(JSON.stringify({ error: "Plano sem exam_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date(isoDate(new Date()));
    const examDate = new Date(plan.exam_date);
    const daysUntil = Math.ceil((examDate.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 1) {
      return new Response(JSON.stringify({ error: "Data da prova já passou" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carregar subtemas estruturais
    const { data: subs, error: subsErr } = await admin
      .from("professor_plan_subtopics")
      .select("subtopic_id, sort_order, curriculum_subtopics(nome, topic_id)")
      .eq("plan_id", plan.id)
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (subsErr) throw subsErr;
    const subtopics = (subs || []) as SubtopicRow[];
    if (subtopics.length === 0) {
      return new Response(JSON.stringify({ error: "Plano sem subtemas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = INTENSITY[plan.intensity as Intensity] ?? INTENSITY.moderado;
    const studyDates = buildStudyDates(today, examDate, profile.daysPerWeek);
    if (studyDates.length === 0) {
      return new Response(JSON.stringify({ error: "Sem dias de estudo disponíveis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ─── LOCK LEVE POR (plan_id, targetUserId) ───
     * Estratégia sem schema novo: usar `professor_plan_progress.updated_at`
     * como heartbeat. Se foi atualizado nos últimos 10s por OUTRA execução
     * concorrente, abortamos para evitar duplo trabalho (multi-tab).
     * A idempotência por (planned_date, task_type, subtopic_id) continua
     * sendo a garantia final contra duplicação.
     */
    const PLANNER_LOCK_WINDOW_MS = 10_000;
    const { data: lockRow } = await admin
      .from("professor_plan_progress")
      .select("updated_at")
      .eq("plan_id", plan.id)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (lockRow?.updated_at) {
      const sinceMs = Date.now() - new Date(lockRow.updated_at).getTime();
      if (sinceMs < PLANNER_LOCK_WINDOW_MS && !body.reason) {
        console.log(
          `[planner] lock skipped plan=${plan.id} user=${targetUserId} sinceMs=${sinceMs}`,
        );
        return new Response(
          JSON.stringify({
            ok: true,
            skipped: true,
            reason: "lock",
            insertedTasks: 0,
            skippedDuplicates: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    const plannerStartedAt = Date.now();
    console.log(
      `[planner] lock acquired plan=${plan.id} user=${targetUserId} reason=${body.reason ?? "manual"}`,
    );

    /**
     * Carregar tarefas existentes (futuras + concluídas no passado) para:
     *  - dedupe estrito de novas inserções (preserva o futuro já planejado)
     *  - identificar quais subtemas JÁ têm cobertura (theory ou questions) e
     *    dessa forma redistribuir só os subtemas ainda sem cobertura futura.
     */
    const { data: existingAll } = await admin
      .from("professor_plan_daily_tasks")
      .select("id, planned_date, task_type, task_payload, status")
      .eq("plan_id", plan.id)
      .eq("user_id", targetUserId);

    const existingFutureKeys = new Set<string>();
    const subtopicsWithFutureTheory = new Set<string>();
    const subtopicsWithCompletedTheory = new Set<string>();
    const todayIso = isoDate(today);
    for (const t of existingAll || []) {
      const sid = (t as any).task_payload?.subtopic_id ?? "";
      if (t.planned_date >= todayIso) {
        existingFutureKeys.add(`${t.planned_date}|${t.task_type}|${sid}`);
        if (t.task_type === "theory") subtopicsWithFutureTheory.add(sid);
      }
      if ((t.status === "completed") && t.task_type === "theory") {
        subtopicsWithCompletedTheory.add(sid);
      }
    }

    // Determinar quais subtemas ainda PRECISAM ser distribuídos no futuro
    // (sem cobertura futura E sem theory completa no passado).
    const pending = subtopics.filter(
      (s) =>
        !subtopicsWithFutureTheory.has(s.subtopic_id) &&
        !subtopicsWithCompletedTheory.has(s.subtopic_id),
    );

    // Hardening Fase 6.1: source diferencia planner inicial vs replan.
    const SOURCE_MAP: Record<RecalcType, string> = {
      manual: "planner",
      auto: "planner_auto",
      missed_goal: "replan_missed_goal",
      teacher_update: "replan_teacher_update",
    };
    const reasonForSource: RecalcType = body.reason ?? "manual";
    const taskSource = SOURCE_MAP[reasonForSource] ?? "planner";

    type Task = {
      plan_id: string;
      user_id: string;
      planned_date: string;
      task_type: "theory" | "questions" | "review";
      task_payload: Record<string, unknown>;
      source: string;
      status: "pending";
    };
    const tasksQueue: Task[] = [];

    let dayCursor = 0;
    let slotInDay = 0;
    const reviewBacklog: { subtopicId: string; nome: string }[] = [];

    const pushTask = (task: Task) => {
      tasksQueue.push(task);
      slotInDay++;
      if (slotInDay >= profile.tasksPerDay) {
        slotInDay = 0;
        dayCursor++;
      }
    };

    for (let i = 0; i < pending.length; i++) {
      const s = pending[i];
      if (dayCursor >= studyDates.length) break;
      const nome = s.curriculum_subtopics?.nome ?? "Subtema";

      pushTask({
        plan_id: plan.id,
        user_id: targetUserId,
        planned_date: isoDate(studyDates[dayCursor]),
        task_type: "theory",
        task_payload: {
          subtopic_id: s.subtopic_id,
          subtopic_name: nome,
          topic_id: s.curriculum_subtopics?.topic_id ?? null,
          sort_order: s.sort_order ?? i,
        },
        source: taskSource,
        status: "pending",
      });
      if (dayCursor >= studyDates.length) break;
      pushTask({
        plan_id: plan.id,
        user_id: targetUserId,
        planned_date: isoDate(studyDates[dayCursor]),
        task_type: "questions",
        task_payload: {
          subtopic_id: s.subtopic_id,
          subtopic_name: nome,
          topic_id: s.curriculum_subtopics?.topic_id ?? null,
          target_count: 10,
        },
        source: taskSource,
        status: "pending",
      });
      reviewBacklog.push({ subtopicId: s.subtopic_id, nome });
    }

    // Revisões D+3 (somente para os subtemas novos distribuídos agora)
    const finalTasks: Task[] = [...tasksQueue];
    for (const r of reviewBacklog) {
      const theoryDay = tasksQueue.find(
        (t) => t.task_type === "theory" && (t.task_payload as any).subtopic_id === r.subtopicId,
      );
      if (!theoryDay) continue;
      const theoryDate = new Date(theoryDay.planned_date);
      const reviewDate = addDays(theoryDate, 3);
      if (reviewDate.getTime() > examDate.getTime()) continue;
      finalTasks.push({
        plan_id: plan.id,
        user_id: targetUserId,
        planned_date: isoDate(reviewDate),
        task_type: "review",
        task_payload: {
          subtopic_id: r.subtopicId,
          subtopic_name: r.nome,
          fsrs_assist: true,
        },
        source: taskSource,
        status: "pending",
      });
    }

    const toInsert = finalTasks.filter(
      (t) =>
        !existingFutureKeys.has(
          `${t.planned_date}|${t.task_type}|${(t.task_payload as any).subtopic_id ?? ""}`,
        ),
    );

    let insertedCount = 0;
    if (toInsert.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        // Loop 2: dedup defensiva via task_hash UNIQUE (ignora duplicatas concorrentes)
        const { error: insErr, data: inserted } = await admin
          .from("professor_plan_daily_tasks")
          .upsert(slice, { onConflict: "task_hash", ignoreDuplicates: true })
          .select("id");
        if (insErr) throw insErr;
        insertedCount += inserted?.length ?? 0;
      }
    }

    // Recalcular progress real
    const { data: allAfter } = await admin
      .from("professor_plan_daily_tasks")
      .select("status, planned_date")
      .eq("plan_id", plan.id)
      .eq("user_id", targetUserId);

    const all = allAfter || [];
    const completedCount = all.filter((t) => t.status === "completed").length;
    const overdueCount = all.filter(
      (t) => t.status === "pending" && t.planned_date < todayIso,
    ).length;
    const pendingCount = all.filter((t) => t.status === "pending").length;
    const totalCount = all.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Atualizar APENAS contagens — current_week e weekly_goal_status são
    // de responsabilidade exclusiva da edge `proficiency-progress-recalc`,
    // que tem o contexto temporal correto. Não sobrescrevemos aqui para
    // evitar regressão visual no painel do aluno após replanejamento.
    const { data: existingProgress } = await admin
      .from("professor_plan_progress")
      .select("current_week, weekly_goal_status")
      .eq("plan_id", plan.id)
      .eq("user_id", targetUserId)
      .maybeSingle();

    await admin.from("professor_plan_progress").upsert(
      {
        plan_id: plan.id,
        user_id: targetUserId,
        progress_percent: progressPercent,
        current_week: existingProgress?.current_week ?? 1,
        weekly_goal_status: existingProgress?.weekly_goal_status ?? "partial",
        completed_tasks: completedCount,
        pending_tasks: pendingCount,
        overdue_tasks: overdueCount,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "plan_id,user_id", ignoreDuplicates: false },
    );

    // Registrar evento de recálculo (apenas quando há motivo explícito ou houve mudança real)
    const reason: RecalcType = body.reason ?? "manual";
    if (insertedCount > 0 || body.reason) {
      await admin.from("professor_plan_recalculations").insert({
        plan_id: plan.id,
        user_id: targetUserId,
        recalculation_type: reason,
        reason: body.reasonText ?? defaultReasonText(reason),
        metadata: {
          inserted_tasks: insertedCount,
          pending_subtopics: pending.length,
          total_subtopics: subtopics.length,
          days_until_exam: daysUntil,
        },
        created_by: user.id,
      });
    }

    const durationMs = Date.now() - plannerStartedAt;
    console.log(
      `[planner] lock released plan=${plan.id} user=${targetUserId} inserted=${insertedCount} dedupeHits=${finalTasks.length - insertedCount} durationMs=${durationMs}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        planId: plan.id,
        targetUserId,
        examDate: plan.exam_date,
        daysUntil,
        intensity: plan.intensity,
        studyDays: studyDates.length,
        subtopicsCount: subtopics.length,
        pendingSubtopics: pending.length,
        generatedTasks: finalTasks.length,
        insertedTasks: insertedCount,
        skippedDuplicates: finalTasks.length - insertedCount,
        recalculationLogged: insertedCount > 0 || !!body.reason,
        durationMs,
        reason,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const e = err as Error;
    console.error("proficiency-planner error:", e);
    return new Response(JSON.stringify({ error: e.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function defaultReasonText(reason: RecalcType): string {
  switch (reason) {
    case "missed_goal":
      return "Plano recalculado por meta semanal não cumprida";
    case "teacher_update":
      return "Plano atualizado pelo professor";
    case "auto":
      return "Recálculo automático do sistema";
    default:
      return "Recálculo manual";
  }
}
