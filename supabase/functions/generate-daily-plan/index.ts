// generate-daily-plan - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

Deno.serve(enterpriseEdgeHandler("generate-daily-plan", async ({ req, logger, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  logger.info("AUTH", "User authenticated", { userId: user.id });

  const body = await req.json().catch(() => ({}));
  const today = new Date().toISOString().split('T')[0];

  const [revisoesRes, errorsRes] = await Promise.all([
    supabaseAdmin.from("revisoes").select("id, tema_id, data_revisao").eq("user_id", user.id).eq("status", "pendente").lte("data_revisao", today).limit(5),
    supabaseAdmin.from("error_bank").select("tema, vezes_errado").eq("user_id", user.id).eq("dominado", false).order("vezes_errado", { ascending: false }).limit(5)
  ]);

  const tasks = [];
  for (const rev of (revisoesRes.data || [])) {
    tasks.push({ type: "review", topic: "Revisão", priority: 90, estimated_minutes: 15, meta: { revisao_id: rev.id } });
  }
  for (const err of (errorsRes.data || [])) {
    tasks.push({ type: "error_fix", topic: err.tema, priority: 80, estimated_minutes: 10 });
  }

  const { data: finalPlan, error: planErr } = await supabaseAdmin
    .from("daily_plans")
    .upsert({
      user_id: user.id,
      plan_date: today,
      plan_json: { tasks, generated_at: new Date().toISOString() },
      total_blocks: tasks.length,
      completed_count: 0
    }, { onConflict: "user_id,plan_date" })
    .select("id")
    .single();

  if (planErr) throw planErr;

  return new Response(JSON.stringify({ success: true, planId: finalPlan.id }), {
    headers: { "Content-Type": "application/json" }
  });
}));
