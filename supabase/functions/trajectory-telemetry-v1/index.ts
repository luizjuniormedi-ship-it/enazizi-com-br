/**
 * trajectory-telemetry-v1 — Métricas mínimas do loop Radar→Planner.
 *
 * Retorna contagens dos últimos 30 dias para o usuário autenticado:
 *  - planner_apply / planner_reject / trajectory_apply / trajectory_complete
 *  - motivos de rejeição agrupados
 *  - taxa de aceitação por actionType
 *  - última ação aplicada (com snapshot/recommendation/decisão)
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest,
} from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("Método não permitido", 405);
  }

  let userId: string;
  try { userId = await getUserIdFromRequest(req); }
  catch { return errorResponse("Autenticação necessária", 401); }

  const db = getServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  // 1) Decisões do Radar/Planner nos últimos 30 dias
  const { data: decisions } = await db
    .from("assistant_decisions")
    .select("decision_type, decision_output, created_at")
    .eq("user_id", userId)
    .in("decision_type", ["trajectory_apply", "planner_apply", "planner_reject", "trajectory_complete"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const counts = {
    trajectory_apply: 0,
    planner_apply: 0,
    planner_reject: 0,
    trajectory_complete: 0,
  };
  const rejectReasons: Record<string, number> = {};
  const byActionType: Record<string, { apply: number; reject: number }> = {};

  for (const d of decisions ?? []) {
    const type = d.decision_type as keyof typeof counts;
    if (type in counts) counts[type]++;

    const out = (d.decision_output ?? {}) as Record<string, unknown>;

    if (type === "planner_reject") {
      const reason = (out.reason as string) ?? "unknown";
      rejectReasons[reason] = (rejectReasons[reason] ?? 0) + 1;
    }

    if (type === "planner_apply" || type === "planner_reject") {
      const actionType =
        (out.action_type as string) ??
        (out.actionType as string) ??
        "unknown";
      if (!byActionType[actionType]) byActionType[actionType] = { apply: 0, reject: 0 };
      if (type === "planner_apply") byActionType[actionType].apply++;
      else byActionType[actionType].reject++;
    }
  }

  const acceptanceByType = Object.fromEntries(
    Object.entries(byActionType).map(([k, v]) => {
      const total = v.apply + v.reject;
      return [k, {
        apply: v.apply,
        reject: v.reject,
        total,
        rate: total > 0 ? Math.round((v.apply / total) * 100) : 0,
      }];
    }),
  );

  const totalPlannerCalls = counts.planner_apply + counts.planner_reject;
  const overallAcceptance = totalPlannerCalls > 0
    ? Math.round((counts.planner_apply / totalPlannerCalls) * 100)
    : 0;

  // 2) Última ação aplicada (qualquer status)
  const { data: lastAction } = await db
    .from("trajectory_applied_actions")
    .select("id, status, applied_at, completed_at, recommendation_id, decision_id, payload, outcome")
    .eq("user_id", userId)
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lastRecommendation: Record<string, unknown> | null = null;
  if (lastAction?.recommendation_id) {
    const { data: rec } = await db
      .from("trajectory_recommendations")
      .select("title, rationale, orchestrator_action, target_module, priority")
      .eq("id", lastAction.recommendation_id)
      .maybeSingle();
    lastRecommendation = rec as Record<string, unknown> | null;
  }

  return jsonResponse({
    windowDays: 30,
    counts,
    rejectReasons,
    acceptanceByType,
    overallAcceptance,
    totalPlannerCalls,
    lastAction: lastAction
      ? {
          id: lastAction.id,
          status: lastAction.status,
          appliedAt: lastAction.applied_at,
          completedAt: lastAction.completed_at,
          decisionId: lastAction.decision_id,
          recommendation: lastRecommendation,
          payload: lastAction.payload,
          outcome: lastAction.outcome,
        }
      : null,
  });
});
