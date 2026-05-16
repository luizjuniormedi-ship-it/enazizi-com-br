// study-complete - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Atomic completion of study actions with side effects tracking.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

export default enterpriseEdgeHandler("study-complete", async ({ req, logger, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH
  const { user } = await requireAuth(req);
  
  // 2. PARSE BODY
  const body = await req.json();
  const { actionType, actionId, taskId, wasCorrect, metadata } = body;

  logger.info("ACTION_COMPLETION", `Completing ${actionType}`, { actionId, taskId, wasCorrect });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const effects: Record<string, boolean> = {};

  // 3. SIDE EFFECTS
  
  // Mark review done
  if (actionType === "review" && actionId) {
    await supabaseAdmin.from("revisoes").update({ status: "concluida" }).eq("id", actionId);
    effects.reviewUpdated = true;
  }

  // Complete daily task
  if (taskId) {
    await supabaseAdmin.from("daily_plan_tasks").update({ completed: true, completed_at: now }).eq("id", taskId);
    effects.taskCompleted = true;
    
    // Update daily plan count
    const { data: plan } = await supabaseAdmin.from("daily_plans").select("id, completed_count").eq("user_id", user.id).eq("plan_date", today).maybeSingle();
    if (plan) {
      await supabaseAdmin.from("daily_plans").update({ completed_count: (plan.completed_count || 0) + 1 }).eq("id", plan.id);
    }
  }

  // Feed error bank
  if (wasCorrect === false && metadata?.topic) {
    await supabaseAdmin.rpc("upsert_error_bank_entry", {
      p_user_id: user.id,
      p_tema: metadata.topic,
      p_categoria_erro: metadata.category || "conceitual"
    });
    effects.errorBankFed = true;
  }

  logger.info("COMPLETION_FINISHED", "All side effects processed", { effects });

  return new Response(JSON.stringify({ success: true, effects }), {
    headers: { "Content-Type": "application/json" }
  });
});
