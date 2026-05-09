import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      try {
        const sb = createClient(supabaseUrl, anonKey);
        const { data: claims, error: cErr } = await sb.auth.getClaims(token);
        const sub = claims?.claims?.sub;
        if (!cErr && typeof sub === "string" && sub.length > 0) {
          userId = sub;
        } else {
          const { data } = await sb.auth.getUser(token);
          userId = data?.user?.id ?? null;
        }
      } catch (e) {
        console.warn("[replan-overdue-tasks] auth failed:", e);
      }
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    // BR timezone (America/Sao_Paulo) for "today"
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    // 1. Find overdue reviews (past date, still pending)
    const { data: overdueReviews } = await adminClient
      .from("revisoes")
      .select(
        "id, tema_id, data_revisao, tipo_revisao, prioridade, risco_esquecimento, temas_estudados(tema, especialidade)"
      )
      .eq("user_id", userId)
      .eq("status", "pendente")
      .lt("data_revisao", today)
      .order("data_revisao", { ascending: true });

    const rescheduled: Array<{
      id: string;
      topic: string;
      old_date: string;
      new_date: string;
      new_priority: number;
    }> = [];

    // 2. Reschedule each overdue review
    for (const rev of (overdueReviews || []) as any[]) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(rev.data_revisao).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Increase priority based on how overdue
      const newPriority = Math.min(
        100,
        (rev.prioridade || 50) + daysOverdue * 3
      );

      // Reschedule to today with bumped priority and high risk
      await adminClient
        .from("revisoes")
        .update({
          data_revisao: today,
          prioridade: newPriority,
          risco_esquecimento: daysOverdue > 7 ? "alto" : "medio",
        })
        .eq("id", rev.id);

      rescheduled.push({
        id: rev.id,
        topic: rev.temas_estudados?.tema || "Tema",
        old_date: rev.data_revisao,
        new_date: today,
        new_priority: newPriority,
      });
    }

    // 3. Find incomplete daily plan tasks from past days
    const { data: pastPlans } = await adminClient
      .from("daily_plans")
      .select("id, plan_date, plan_json, completed_blocks, total_blocks, completed_count")
      .eq("user_id", userId)
      .lt("plan_date", today)
      .order("plan_date", { ascending: false })
      .limit(7);

    const carriedOver: string[] = [];

    for (const plan of (pastPlans || []) as any[]) {
      if (plan.completed_count >= plan.total_blocks) continue;

      const raw = plan.plan_json || {};
      const tasks = (Array.isArray(raw) ? raw : (raw as any).blocks || []) as any[];
      const completedSet = new Set(
        ((plan.completed_blocks || []) as string[])
      );

      for (const task of tasks) {
        const taskKey = `${task.type}-${task.topic}`;
        if (completedSet.has(taskKey)) continue;
        // Only carry over high-priority tasks
        if ((task.priority || 0) >= 60) {
          carriedOver.push(`${task.topic} (${task.type})`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        overdue_reviews_rescheduled: rescheduled.length,
        rescheduled,
        carried_over_tasks: carriedOver.length,
        carried_over: carriedOver,
        summary:
          rescheduled.length === 0 && carriedOver.length === 0
            ? "Nenhuma tarefa atrasada encontrada. Tudo em dia! 🎉"
            : `${rescheduled.length} revisões reagendadas e ${carriedOver.length} tarefas pendentes identificadas.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
