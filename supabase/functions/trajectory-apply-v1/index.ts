/**
 * trajectory-apply-v1 — Propõe uma recomendação ao Planner Orquestrador.
 *
 * Regras (camada de inteligência, NÃO de execução):
 *  1. Não cria tarefas diretamente em daily_plan_tasks.
 *  2. Gera um payload padronizado de recomendação.
 *  3. Salva em trajectory_applied_actions:
 *     - status='applied' se planner-orchestrator-v1 existir e aceitar
 *     - status='pending_orchestrator' se não houver executor disponível
 *  4. Não duplica tarefas, não fura cooldown, não sobrescreve decisões.
 *  5. Mantém rastreabilidade total via assistant_decisions + decision_id.
 *
 * Objetivo: Radar = inteligência. Planner = executor central.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, logDecision,
} from "../_shared/assistant-helpers.ts";

interface ApplyBody {
  snapshotId?: string;
  recommendationId: string;
}

type StandardActionType = "review" | "questions" | "theory" | "simulado";

/** Mapeia orchestrator_action interno → tipo de ação padronizado para o Planner. */
function mapToStandardAction(orchestratorAction: string | null): StandardActionType {
  const a = (orchestratorAction ?? "").toLowerCase();
  if (a.includes("review") || a.includes("fsrs") || a.includes("revis")) return "review";
  if (a.includes("simulado") || a.includes("exam")) return "simulado";
  if (a.includes("theory") || a.includes("teoria") || a.includes("study")) return "theory";
  return "questions";
}

/** Tenta detectar se a edge function planner-orchestrator-v1 existe e está saudável. */
async function tryInvokePlannerOrchestrator(
  payload: Record<string, unknown>,
  authHeader: string | null,
): Promise<{ accepted: boolean; response?: unknown; error?: string }> {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return { accepted: false, error: "missing SUPABASE_URL" };

  try {
    const res = await fetch(`${url}/functions/v1/planner-orchestrator-v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify(payload),
    });

    // 404 → função não existe; deixamos pending_orchestrator
    if (res.status === 404) return { accepted: false, error: "planner-orchestrator-v1 not deployed" };

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { accepted: false, error: `planner returned ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json().catch(() => ({}));
    return { accepted: true, response: json };
  } catch (e) {
    return { accepted: false, error: `planner invoke failed: ${(e as Error).message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método não permitido", 405);

  let userId: string;
  try {
    userId = await getUserIdFromRequest(req);
  } catch {
    return errorResponse("Autenticação necessária", 401);
  }

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return errorResponse("Body inválido", 400);
  }
  if (!body?.recommendationId) {
    return errorResponse("recommendationId obrigatório", 400);
  }

  const db = getServiceClient();

  // 1. Garante que a recomendação pertence ao usuário (RLS-style via service_role)
  const { data: rec, error: recErr } = await db
    .from("trajectory_recommendations")
    .select("*")
    .eq("id", body.recommendationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (recErr || !rec) return errorResponse("Recomendação não encontrada", 404);

  const snapshotId = body.snapshotId ?? rec.snapshot_id;

  // 2. Anti-duplicação: já existe applied_action ativa para esta recomendação?
  const { data: existing } = await db
    .from("trajectory_applied_actions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("recommendation_id", rec.id)
    .in("status", ["pending_orchestrator", "applied"])
    .maybeSingle();

  if (existing) {
    return jsonResponse({
      success: true,
      appliedActionId: existing.id,
      decisionId: null,
      status: existing.status,
      duplicate: true,
      message: "Recomendação já enviada ao orquestrador anteriormente.",
    });
  }

  // 3. Monta payload padronizado para o Planner
  const recPayload = (rec.payload ?? {}) as Record<string, unknown>;
  const standardAction = mapToStandardAction(rec.orchestrator_action);

  const standardizedPayload = {
    actionType: standardAction,
    topic:
      (recPayload.topic as string | undefined) ??
      (recPayload.subject as string | undefined) ??
      (recPayload.specialty as string | undefined) ??
      null,
    estimatedMinutes:
      (recPayload.estimatedMinutes as number | undefined) ??
      (recPayload.duration as number | undefined) ??
      30,
    priority: rec.priority ?? 3,
    origin: "radar_trajetoria" as const,
    snapshotId,
    recommendationId: rec.id,
    rationale: rec.rationale ?? rec.title,
    raw: recPayload,
  };

  // 4. Loga decisão (rastreabilidade)
  const decision = await logDecision(db, {
    user_id: userId,
    decision_type: "trajectory_apply",
    source_module: "radar_trajetoria",
    input_snapshot: { snapshotId, recommendationId: rec.id },
    decision_output: { action: standardAction, payload: standardizedPayload },
    justification: rec.rationale ?? rec.title,
    confidence_score: rec.expected_impact ? Math.min(1, rec.expected_impact / 100) : 0.5,
  });

  // 5. Tenta propor ao planner-orchestrator-v1 (se existir)
  const orchestratorPayload = {
    source: "radar_trajetoria",
    userId,
    decisionId: decision.id,
    snapshotId,
    recommendationId: rec.id,
    action: standardizedPayload,
  };

  const authHeader = req.headers.get("Authorization");
  const plannerResult = await tryInvokePlannerOrchestrator(orchestratorPayload, authHeader);

  const finalStatus: "applied" | "pending_orchestrator" = plannerResult.accepted
    ? "applied"
    : "pending_orchestrator";

  // 6. Persiste trajectory_applied_actions
  const { data: applied, error: appErr } = await db
    .from("trajectory_applied_actions")
    .insert({
      user_id: userId,
      snapshot_id: snapshotId,
      recommendation_id: rec.id,
      decision_id: decision.id,
      orchestrator_action: rec.orchestrator_action,
      target_module: rec.target_module,
      payload: {
        standardized: standardizedPayload,
        plannerResponse: plannerResult.response ?? null,
        plannerError: plannerResult.error ?? null,
      },
      status: finalStatus,
    })
    .select("id")
    .single();

  if (appErr || !applied) {
    return errorResponse(appErr?.message ?? "Falha ao registrar aplicação", 500);
  }

  // 7. Constrói navigateTo (mantém compat com loop adaptativo via ?did=)
  const targetModule: string = rec.target_module ?? "/dashboard";
  const sep = targetModule.includes("?") ? "&" : "?";
  const navigateTo = decision.id
    ? `${targetModule}${sep}did=${decision.id}`
    : targetModule;

  return jsonResponse({
    success: true,
    appliedActionId: applied.id,
    decisionId: decision.id,
    status: finalStatus,
    plannerInvoked: plannerResult.accepted,
    plannerError: plannerResult.error ?? null,
    navigateTo,
    standardizedPayload,
  });
});
