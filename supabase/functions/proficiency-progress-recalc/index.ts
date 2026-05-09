/**
 * proficiency-progress-recalc
 *
 * Atualiza `professor_plan_progress` para o aluno autenticado em um plano,
 * detecta meta semanal não cumprida (`missed_goal`) e dispara replanejamento
 * incremental via `proficiency-planner` quando necessário.
 *
 * Regras:
 *  - Nunca apaga histórico.
 *  - Define current_week com base nos dias desde a primeira tarefa do plano.
 *  - weekly_goal_status:
 *      * done    → 100% das tarefas planejadas para a semana atual concluídas
 *      * partial → 50%-99%
 *      * missed  → < 50% E pelo menos 1 dia da semana já passou (>= terça)
 *  - Quando missed: chama proficiency-planner com reason="missed_goal".
 *  - Idempotente: se já existe um recálculo missed_goal nas últimas 24h, não dispara de novo.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  planId: string;
  /** Quando true, desabilita o trigger automático de replanning. */
  skipReplan?: boolean;
  /** Quando true, ignora o cooldown server-side (uso administrativo). */
  force?: boolean;
}

/**
 * Cooldown server-side: 5 min por (plan_id,user_id).
 * Fonte: `professor_plan_progress.updated_at` (já atualizado a cada execução).
 * Multi-tab safe: sem novas tabelas, idempotente, server-authoritative.
 */
const RECALC_COOLDOWN_MS = 5 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // segunda-feira como início
  const out = new Date(d);
  out.setUTCDate(d.getUTCDate() + diff);
  out.setUTCHours(0, 0, 0, 0);
  return out;
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

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!body?.planId) {
      return new Response(JSON.stringify({ error: "planId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar acesso
    const { data: isTarget } = await admin.rpc("user_is_target_of_plan", {
      _user_id: user.id,
      _plan_id: body.planId,
    });
    if (!isTarget) {
      return new Response(JSON.stringify({ error: "Usuário não é alvo do plano" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── COOLDOWN CHECK (server-side, multi-tab safe) ───
    if (!body.force) {
      const { data: existing } = await admin
        .from("professor_plan_progress")
        .select("updated_at")
        .eq("plan_id", body.planId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.updated_at) {
        const elapsed = Date.now() - new Date(existing.updated_at).getTime();
        if (elapsed < RECALC_COOLDOWN_MS) {
          const remainingS = Math.ceil((RECALC_COOLDOWN_MS - elapsed) / 1000);
          console.log(
            `[recalc] skipped by cooldown plan=${body.planId} user=${user.id} remaining=${remainingS}s`,
          );
          return new Response(
            JSON.stringify({
              ok: true,
              skipped: true,
              reason: "cooldown",
              cooldownRemainingSeconds: remainingS,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }
    console.log(`[recalc] executed plan=${body.planId} user=${user.id}`);

    const today = new Date(isoDate(new Date()));
    const todayIso = isoDate(today);
    const weekStart = startOfWeekUTC(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const { data: tasks } = await admin
      .from("professor_plan_daily_tasks")
      .select("status, planned_date")
      .eq("plan_id", body.planId)
      .eq("user_id", user.id);

    const all = tasks || [];
    const completed = all.filter((t) => t.status === "completed").length;
    const pending = all.filter((t) => t.status === "pending").length;
    const overdue = all.filter(
      (t) => t.status === "pending" && t.planned_date < todayIso,
    ).length;
    const total = all.length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Tarefas DA SEMANA ATUAL
    const weekIsoStart = isoDate(weekStart);
    const weekIsoEnd = isoDate(weekEnd);
    const weekTasks = all.filter(
      (t) => t.planned_date >= weekIsoStart && t.planned_date < weekIsoEnd,
    );
    const weekTotal = weekTasks.length;
    const weekDone = weekTasks.filter((t) => t.status === "completed").length;
    const weekRatio = weekTotal > 0 ? weekDone / weekTotal : 1;

    const dow = today.getUTCDay(); // 0=dom, 1=seg, 2=ter
    // Só considera "missed" a partir de terça/qua para dar tempo de cumprir.
    const enoughDaysElapsed = dow === 0 || dow >= 3;

    let weeklyStatus: "done" | "partial" | "missed";
    if (weekRatio >= 1) weeklyStatus = "done";
    else if (weekRatio >= 0.5) weeklyStatus = "partial";
    else weeklyStatus = enoughDaysElapsed ? "missed" : "partial";

    // current_week — quantas semanas desde a primeira tarefa do plano
    const { data: firstTask } = await admin
      .from("professor_plan_daily_tasks")
      .select("planned_date")
      .eq("plan_id", body.planId)
      .eq("user_id", user.id)
      .order("planned_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    let currentWeek = 1;
    if (firstTask?.planned_date) {
      const first = new Date(firstTask.planned_date);
      const diffDays = Math.floor((today.getTime() - first.getTime()) / 86400000);
      currentWeek = Math.max(1, Math.floor(diffDays / 7) + 1);
    }

    await admin.from("professor_plan_progress").upsert(
      {
        plan_id: body.planId,
        user_id: user.id,
        progress_percent: progressPercent,
        current_week: currentWeek,
        weekly_goal_status: weeklyStatus,
        completed_tasks: completed,
        pending_tasks: pending,
        overdue_tasks: overdue,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "plan_id,user_id", ignoreDuplicates: false },
    );

    let replanTriggered = false;

    // Trigger automático de replanning quando missed e nada nas últimas 24h
    if (weeklyStatus === "missed" && !body.skipReplan) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("professor_plan_recalculations")
        .select("id")
        .eq("plan_id", body.planId)
        .eq("user_id", user.id)
        .eq("recalculation_type", "missed_goal")
        .gte("created_at", since)
        .limit(1);

      if (!recent || recent.length === 0) {
        // Invocar planner em modo missed_goal
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/proficiency-planner`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId: body.planId,
            reason: "missed_goal",
            reasonText: `Meta semanal não cumprida (${weekDone}/${weekTotal})`,
          }),
        });
        await resp.text();
        replanTriggered = resp.ok;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        planId: body.planId,
        progress: {
          completed,
          pending,
          overdue,
          total,
          progressPercent,
          currentWeek,
          weeklyStatus,
          weekDone,
          weekTotal,
        },
        replanTriggered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const e = err as Error;
    console.error("proficiency-progress-recalc error:", e);
    return new Response(JSON.stringify({ error: e.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
