/**
 * analytics-snapshot — API Assistente Phase 1
 * Consolidates student state into a single response.
 * Replaces multiple frontend queries.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery,
} from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdFromRequest(req);
    const db = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const [
      approvalData,
      pendingReviews,
      fsrsDue,
      errorBank,
      dailyPlan,
      pendingTasks,
      gamification,
      lastStudy,
    ] = await Promise.all([
      safeQuery<any>(db, (c) =>
        c.from("approval_scores").select("score, prep_index, chance_score, phase")
          .eq("user_id", userId).order("created_at", { ascending: false })
          .limit(1).maybeSingle(), "approval"),
      safeQuery<any[]>(db, (c) =>
        c.from("revisoes").select("id")
          .eq("user_id", userId).eq("status", "pendente")
          .lte("data_revisao", today), "pending_reviews"),
      safeQuery<any[]>(db, (c) =>
        c.from("fsrs_cards").select("id")
          .eq("user_id", userId).lte("due", new Date().toISOString()), "fsrs_due"),
      safeQuery<any[]>(db, (c) =>
        c.from("error_bank").select("tema")
          .eq("user_id", userId).eq("dominado", false), "error_bank"),
      safeQuery<any>(db, (c) =>
        c.from("daily_plans")
          .select("id, recovery_mode, content_lock, completed_count, total_blocks")
          .eq("user_id", userId).eq("plan_date", today)
          .maybeSingle(), "daily_plan"),
      safeQuery<any[]>(db, (c) =>
        c.from("daily_plan_tasks").select("id")
          .eq("user_id", userId).eq("completed", false), "pending_tasks"),
      safeQuery<any>(db, (c) =>
        c.from("user_gamification").select("current_streak")
          .eq("user_id", userId).maybeSingle(), "gamification"),
      safeQuery<any>(db, (c) =>
        c.from("study_action_events").select("created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle(), "last_study"),
    ]);

    const weakTopics = new Set((errorBank ?? []).map((e: any) => e.tema));

    return jsonResponse({
      success: true,
      snapshot: {
        approvalScore: approvalData?.score ?? 0,
        prepIndex: approvalData?.prep_index ?? null,
        chanceScore: approvalData?.chance_score ?? null,
        phase: approvalData?.phase ?? null,
        pendingReviews: (pendingReviews ?? []).length + (fsrsDue ?? []).length,
        weakTopicsCount: weakTopics.size,
        streak: gamification?.current_streak ?? 0,
        pendingDailyTasks: (pendingTasks ?? []).length,
        recoveryActive: dailyPlan?.recovery_mode ?? false,
        contentLocked: dailyPlan?.content_lock ?? false,
        lastStudyAt: lastStudy?.created_at ?? null,
        todayPlanExists: !!dailyPlan,
        todayProgress: dailyPlan
          ? { completed: dailyPlan.completed_count ?? 0, total: dailyPlan.total_blocks ?? 0 }
          : null,
      },
    });
  } catch (e) {
    console.error("[analytics-snapshot]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
