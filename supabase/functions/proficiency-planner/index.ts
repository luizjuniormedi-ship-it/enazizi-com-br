/**
 * proficiency-planner — Modo `plannerMode = "proficiencia"`
 *
 * Gerador DETERMINÍSTICO (sem IA) que distribui os subtopic_id estruturados
 * de um professor_plan ao longo das semanas até exam_date, conforme intensidade.
 *
 * NÃO duplica o planner principal (planner-orchestrator-v1) — atua em uma
 * tabela separada (professor_plan_daily_tasks) e é acionado APENAS quando o
 * aluno tem plano de Proficiência ativo. A jornada normal continua intocada.
 *
 * Regras:
 *  - Apenas o aluno-alvo do plano pode acionar (RLS valida via target).
 *  - Idempotente: usa (plan_id, user_id, planned_date, subtopic_id) como
 *    chave lógica de dedupe; tarefas existentes desse dia NÃO são apagadas.
 *  - Nunca mexe no passado (planned_date >= today).
 *  - Intensidade controla tarefas/dia:
 *      leve     = 2/dia, 4 dias/semana
 *      moderado = 3/dia, 5 dias/semana
 *      intenso  = 4/dia, 6 dias/semana
 *  - A cada subtema gera 3 tarefas: theory → questions → review (D+3).
 *  - Se exam_date passou ou está a < 1 dia, retorna erro.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Intensity = "leve" | "moderado" | "intenso";

interface IntensityProfile {
  tasksPerDay: number;
  daysPerWeek: number; // dias úteis de estudo (resto é folga/buffer)
}

const INTENSITY: Record<Intensity, IntensityProfile> = {
  leve: { tasksPerDay: 2, daysPerWeek: 4 },
  moderado: { tasksPerDay: 3, daysPerWeek: 5 },
  intenso: { tasksPerDay: 4, daysPerWeek: 6 },
};

interface RequestBody {
  planId: string;
  /** Quando true, força regenerar do hoje em diante (não apaga histórico) */
  rebuild?: boolean;
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

/**
 * Gera lista de datas de estudo entre [startDate, examDate], pulando 7 - daysPerWeek
 * dias por semana (folga). Inclui startDate se for dia útil.
 */
function buildStudyDates(start: Date, exam: Date, daysPerWeek: number): Date[] {
  const dates: Date[] = [];
  const restDays = 7 - daysPerWeek; // ex: 2 dias de folga
  let cursor = new Date(start);
  while (cursor.getTime() <= exam.getTime()) {
    // Folga em sábado/domingo (6, 0) primeiro; se restDays > 2, também sexta.
    const dow = cursor.getUTCDay();
    const restSet = new Set<number>();
    if (restDays >= 1) restSet.add(0); // domingo
    if (restDays >= 2) restSet.add(6); // sábado
    if (restDays >= 3) restSet.add(5); // sexta
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

    // Validar que o usuário é alvo (target direto OU via classe)
    const { data: isTarget } = await admin.rpc("user_is_target_of_plan", {
      _user_id: user.id,
      _plan_id: plan.id,
    });
    const isOwner = plan.created_by === user.id;
    if (!isTarget && !isOwner) {
      return new Response(JSON.stringify({ error: "Usuário não é alvo do plano" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan.exam_date) {
      return new Response(JSON.stringify({ error: "Plano sem exam_date — não dá para gerar cronograma" }), {
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

    // Gerar tarefas: para cada subtema → theory + questions + review (D+3)
    type Task = {
      plan_id: string;
      user_id: string;
      planned_date: string;
      task_type: "theory" | "questions" | "review";
      task_payload: Record<string, unknown>;
      source: "planner";
      status: "pending";
    };
    const tasksQueue: Task[] = [];

    // Primeiro distribui theory + questions sequencialmente nos dias
    let dayCursor = 0;
    let slotInDay = 0;
    const reviewBacklog: { subtopicId: string; nome: string; reviewIndex: number }[] = [];

    const pushTask = (task: Task) => {
      tasksQueue.push(task);
      slotInDay++;
      if (slotInDay >= profile.tasksPerDay) {
        slotInDay = 0;
        dayCursor++;
      }
    };

    for (let i = 0; i < subtopics.length; i++) {
      const s = subtopics[i];
      if (dayCursor >= studyDates.length) break;
      const nome = s.curriculum_subtopics?.nome ?? "Subtema";

      // theory
      pushTask({
        plan_id: plan.id,
        user_id: user.id,
        planned_date: isoDate(studyDates[dayCursor]),
        task_type: "theory",
        task_payload: {
          subtopic_id: s.subtopic_id,
          subtopic_name: nome,
          topic_id: s.curriculum_subtopics?.topic_id ?? null,
          sort_order: s.sort_order ?? i,
        },
        source: "planner",
        status: "pending",
      });
      if (dayCursor >= studyDates.length) break;
      // questions
      pushTask({
        plan_id: plan.id,
        user_id: user.id,
        planned_date: isoDate(studyDates[dayCursor]),
        task_type: "questions",
        task_payload: {
          subtopic_id: s.subtopic_id,
          subtopic_name: nome,
          topic_id: s.curriculum_subtopics?.topic_id ?? null,
          target_count: 10,
        },
        source: "planner",
        status: "pending",
      });
      reviewBacklog.push({ subtopicId: s.subtopic_id, nome, reviewIndex: i });
    }

    // Agora distribui revisões D+3 (encaixe oportunístico nos dias que tiverem espaço)
    // Estratégia simples: cada review aparece 3 dias depois do dia em que o subtema foi estudado.
    const finalTasks: Task[] = [...tasksQueue];
    for (const r of reviewBacklog) {
      // Encontrar o dia em que esse subtema teve theory
      const theoryDay = tasksQueue.find(
        (t) => t.task_type === "theory" && (t.task_payload as any).subtopic_id === r.subtopicId,
      );
      if (!theoryDay) continue;
      const theoryDate = new Date(theoryDay.planned_date);
      const reviewDate = addDays(theoryDate, 3);
      if (reviewDate.getTime() > examDate.getTime()) continue;
      finalTasks.push({
        plan_id: plan.id,
        user_id: user.id,
        planned_date: isoDate(reviewDate),
        task_type: "review",
        task_payload: {
          subtopic_id: r.subtopicId,
          subtopic_name: r.nome,
          fsrs_assist: true,
        },
        source: "planner",
        status: "pending",
      });
    }

    // Carregar tarefas existentes futuras (>= today) para dedupe
    const { data: existing } = await admin
      .from("professor_plan_daily_tasks")
      .select("id, planned_date, task_type, task_payload")
      .eq("plan_id", plan.id)
      .eq("user_id", user.id)
      .gte("planned_date", isoDate(today));
    const existingKeys = new Set(
      (existing || []).map((t: any) =>
        `${t.planned_date}|${t.task_type}|${(t.task_payload?.subtopic_id ?? "")}`,
      ),
    );

    const toInsert = finalTasks.filter(
      (t) => !existingKeys.has(`${t.planned_date}|${t.task_type}|${(t.task_payload as any).subtopic_id ?? ""}`),
    );

    let insertedCount = 0;
    if (toInsert.length > 0) {
      // Batch insert (chunks de 200)
      const CHUNK = 200;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        const { error: insErr } = await admin.from("professor_plan_daily_tasks").insert(slice);
        if (insErr) throw insErr;
        insertedCount += slice.length;
      }
    }

    // Atualizar/criar progress row
    const totalTasks = finalTasks.length;
    const { error: progErr } = await admin
      .from("professor_plan_progress")
      .upsert(
        {
          plan_id: plan.id,
          user_id: user.id,
          progress_percent: 0,
          current_week: 1,
          weekly_goal_status: "partial",
          completed_tasks: 0,
          pending_tasks: totalTasks,
          overdue_tasks: 0,
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: "plan_id,user_id", ignoreDuplicates: false },
      );
    if (progErr) console.warn("progress upsert warn:", progErr.message);

    return new Response(
      JSON.stringify({
        ok: true,
        planId: plan.id,
        examDate: plan.exam_date,
        daysUntil,
        intensity: plan.intensity,
        studyDays: studyDates.length,
        subtopicsCount: subtopics.length,
        generatedTasks: finalTasks.length,
        insertedTasks: insertedCount,
        skippedDuplicates: finalTasks.length - insertedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("proficiency-planner error:", err);
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
