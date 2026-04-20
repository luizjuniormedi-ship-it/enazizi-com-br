/**
 * trajectory-complete-action-v1 — Fallback manual para fechar uma ação aplicada.
 *
 * Quando o auto-trigger SQL não consegue vincular uma daily_plan_task (ou a
 * ação não tem task vinculada), o usuário pode fechar manualmente pelo card
 * do Radar. Marca trajectory_applied_actions.status='completed', preenche
 * outcome mínimo e loga em assistant_decisions.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, logDecision,
} from "../_shared/assistant-helpers.ts";

interface Body {
  appliedActionId: string;
  durationMinutes?: number;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método não permitido", 405);

  let userId: string;
  try { userId = await getUserIdFromRequest(req); }
  catch { return errorResponse("Autenticação necessária", 401); }

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return errorResponse("Body inválido", 400); }

  if (!body?.appliedActionId) return errorResponse("appliedActionId obrigatório", 400);

  const db = getServiceClient();

  const { data: action, error: fetchErr } = await db
    .from("trajectory_applied_actions")
    .select("id, status, decision_id, applied_at, payload")
    .eq("id", body.appliedActionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr || !action) return errorResponse("Ação não encontrada", 404);

  if (action.status === "completed") {
    return jsonResponse({ success: true, alreadyCompleted: true });
  }

  const completedAt = new Date().toISOString();
  const duration = typeof body.durationMinutes === "number"
    ? body.durationMinutes
    : Math.max(
        1,
        Math.round((new Date(completedAt).getTime() - new Date(action.applied_at).getTime()) / 60000),
      );

  const newOutcome = {
    ...(action.payload as Record<string, unknown> ?? {}),
    completed_at: completedAt,
    duration_minutes: duration,
    notes: body.notes ?? null,
    source: "manual_button",
  };

  const { error: updErr } = await db
    .from("trajectory_applied_actions")
    .update({
      status: "completed",
      completed_at: completedAt,
      outcome: newOutcome,
      updated_at: completedAt,
    })
    .eq("id", action.id);

  if (updErr) return errorResponse(updErr.message, 500);

  await logDecision(db, {
    user_id: userId,
    decision_type: "trajectory_complete",
    source_module: "radar_trajetoria",
    input_snapshot: { appliedActionId: action.id, decisionId: action.decision_id },
    decision_output: { status: "completed", durationMinutes: duration, source: "manual_button" },
    justification: "Usuário marcou ação como concluída manualmente.",
    confidence_score: 0.95,
  });

  return jsonResponse({
    success: true,
    appliedActionId: action.id,
    completedAt,
    durationMinutes: duration,
  });
});
