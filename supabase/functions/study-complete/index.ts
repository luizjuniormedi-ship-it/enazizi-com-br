/**
 * study-complete — API Assistente Phase 1
 * Atomic study action completion with side effects.
 * Server-side equivalent of completeStudyAction.ts.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery, logDecision,
} from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json();
    const {
      actionType, actionId, taskId, themeId, topicId, subtopicId,
      questionId, wasCorrect, durationSeconds, metadata,
    } = body;

    if (!actionType) return errorResponse("actionType is required");

    const db = getServiceClient();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const effects: Record<string, boolean> = {};
    const errors: string[] = [];

    // ── 1. Mark review as done ──
    if ((actionType === "review" || actionType === "error_review") && actionId) {
      const { error } = await db.from("revisoes")
        .update({ status: "concluida", updated_at: now })
        .eq("id", actionId).eq("user_id", userId);
      if (error) errors.push(`review: ${error.message}`);
      else effects.reviewUpdated = true;
    }

    // ── 2. Mark error bank item as mastered ──
    if (actionType === "error_review" && actionId) {
      const { error } = await db.from("error_bank")
        .update({ dominado: true, dominado_em: now, updated_at: now })
        .eq("id", actionId).eq("user_id", userId);
      if (!error) effects.errorLogged = true;
    }

    // ── 3. Complete daily plan task ──
    if (taskId) {
      const { error } = await db.from("daily_plan_tasks")
        .update({ completed: true, completed_at: now, updated_at: now })
        .eq("id", taskId).eq("user_id", userId);
      if (!error) effects.taskCompleted = true;
      else errors.push(`task: ${error.message}`);
    }

    // ── 4. Track theme studied ──
    if (topicId || themeId) {
      const topicName = topicId || themeId || "unknown";
      const { error } = await db.from("temas_estudados").upsert({
        user_id: userId,
        tema: topicName,
        especialidade: metadata?.specialty ?? "",
        data_estudo: today,
        status: "revisado",
      }, { onConflict: "user_id,tema" });
      if (!error) effects.themeTracked = true;
    }

    // ── 5. Record study action event ──
    await db.from("study_action_events").insert({
      user_id: userId,
      action_type: actionType,
      topic: topicId || themeId || metadata?.topic || "",
      subtopic: subtopicId || metadata?.subtopic || "",
      specialty: metadata?.specialty || "",
      source: metadata?.source || "api",
      origin_module: metadata?.originModule || "study-complete",
      metadata: metadata ?? {},
    }).then(({ error }) => {
      if (error) errors.push(`event: ${error.message}`);
    });

    // ── 6. Update daily plan completed count ──
    if (effects.taskCompleted) {
      const { data: plan } = await db.from("daily_plans")
        .select("id, completed_count")
        .eq("user_id", userId).eq("plan_date", today)
        .maybeSingle();
      if (plan) {
        await db.from("daily_plans")
          .update({ completed_count: (plan.completed_count ?? 0) + 1, updated_at: now })
          .eq("id", plan.id);
      }
    }

    // ── Fetch updated state ──
    const [approvalData, pendingReviews, completedToday, planData] = await Promise.all([
      safeQuery<any>(db, (c) =>
        c.from("approval_scores").select("score")
          .eq("user_id", userId).order("created_at", { ascending: false })
          .limit(1).maybeSingle(), "approval"),
      safeQuery<any[]>(db, (c) =>
        c.from("revisoes").select("id")
          .eq("user_id", userId).eq("status", "pendente")
          .lte("data_revisao", today), "pending"),
      safeQuery<any[]>(db, (c) =>
        c.from("daily_plan_tasks").select("id")
          .eq("user_id", userId).eq("completed", true), "completed_today"),
      safeQuery<any>(db, (c) =>
        c.from("daily_plans").select("recovery_mode")
          .eq("user_id", userId).eq("plan_date", today)
          .maybeSingle(), "plan"),
    ]);

    const updatedState = {
      approvalScore: approvalData?.score ?? 0,
      pendingReviews: (pendingReviews ?? []).length,
      completedTasksToday: (completedToday ?? []).length,
      recoveryActive: planData?.recovery_mode ?? false,
    };

    // ── Log decision ──
    await logDecision(db, {
      user_id: userId,
      decision_type: "study_complete",
      source_module: metadata?.originModule ?? "api",
      input_snapshot: { actionType, actionId, taskId, wasCorrect, durationSeconds },
      decision_output: { effects, updatedState, errors },
      justification: `Completed ${actionType}${actionId ? ` (${actionId})` : ""}. ${Object.entries(effects).filter(([,v]) => v).map(([k]) => k).join(", ")}.`,
    });

    return jsonResponse({
      success: errors.length === 0,
      updatedState,
      effects,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("[study-complete]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
