// study-complete - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { updatePerformanceMetrics } from "../_shared/performance-engine.ts";

Deno.serve(enterpriseEdgeHandler("study-complete", async ({ req, logger, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { actionType, actionId, taskId, wasCorrect, topic, specialty } = body;

  logger.info(`Processing study completion for user ${user.id}`, { actionType, actionId, taskId });

  // 1. Mark task as completed if present
  if (taskId) {
    await supabaseAdmin
      .from("daily_plan_tasks")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", taskId);
  }

  // 2. Resolve legacy review status
  if (actionType === "review" && actionId) {
    await supabaseAdmin
      .from("revisoes")
      .update({ status: "concluida", updated_at: new Date().toISOString() })
      .eq("id", actionId);
  }

  // 3. --- INTEGRATION: Update Performance Metrics ---
  if (topic || specialty) {
    try {
      await updatePerformanceMetrics(supabaseAdmin, {
        userId: user.id,
        specialty: specialty || "Geral",
        topic: topic,
        isCorrect: wasCorrect === true,
      });
    } catch (perfErr) {
      logger.error(`Metrics update failed: ${perfErr.message}`);
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}));
