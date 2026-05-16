// generate-daily-plan - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Intelligent daily task prioritization based on performance and FSRS.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

export default enterpriseEdgeHandler("generate-daily-plan", async ({ req, logger, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH
  const { user } = await requireAuth(req);
  logger.info("AUTH", "User authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const today = new Date().toISOString().split('T')[0];

  logger.info("START_DAILY_PLAN", "Building daily tasks", { date: today });

  // 3. FETCH INPUTS
  const [revisoesRes, errorsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("revisoes").select("id, tema_id, data_revisao").eq("user_id", user.id).eq("status", "pendente").lte("data_revisao", today).limit(5),
    supabaseAdmin.from("error_bank").select("tema, vezes_errado").eq("user_id", user.id).eq("dominado", false).order("vezes_errado", { ascending: false }).limit(5),
    supabaseAdmin.from("profiles").select("target_exam").eq("user_id", user.id).maybeSingle()
  ]);

  // 4. TASK LOGIC (Simplified for framework demo)
  const tasks = [];
  
  for (const rev of (revisoesRes.data || [])) {
    tasks.push({
      type: "review",
      topic: "Revisão Pendente",
      priority: 90,
      estimated_minutes: 15,
      meta: { revisao_id: rev.id }
    });
  }

  for (const err of (errorsRes.data || [])) {
    tasks.push({
      type: "error_fix",
      topic: err.tema,
      priority: 80,
      estimated_minutes: 10
    });
  }

  // 5. UPSERT DAILY PLAN
  const planData = {
    user_id: user.id,
    plan_date: today,
    plan_json: { tasks, generated_at: new Date().toISOString() },
    total_blocks: tasks.length,
    completed_count: 0
  };

  const { data: finalPlan, error: planErr } = await supabaseAdmin
    .from("daily_plans")
    .upsert(planData, { onConflict: "user_id,plan_date" })
    .select("id")
    .single();

  if (planErr) throw planErr;

  logger.info("DAILY_PLAN_READY", "Daily plan upserted", { planId: finalPlan.id, tasks: tasks.length });

  return new Response(JSON.stringify({
    success: true,
    date: today,
    planId: finalPlan.id,
    total_tasks: tasks.length
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
