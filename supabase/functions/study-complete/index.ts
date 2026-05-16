// study-complete - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

Deno.serve(enterpriseEdgeHandler("study-complete", async ({ req, logger, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { actionType, actionId, taskId } = body;

  if (taskId) await supabaseAdmin.from("daily_plan_tasks").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", taskId);
  if (actionType === "review" && actionId) await supabaseAdmin.from("revisoes").update({ status: "concluida" }).eq("id", actionId);

  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}));
