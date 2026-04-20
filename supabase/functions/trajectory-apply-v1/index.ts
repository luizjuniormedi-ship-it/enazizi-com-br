/**
 * trajectory-apply-v1 — Propõe uma recomendação ao orquestrador adaptativo.
 *
 * Estratégia segura (não duplica tasks, não fura cooldown):
 *  1. Lê a recommendation alvo (RLS owner).
 *  2. Cria registro em trajectory_applied_actions (status='proposed').
 *  3. Loga em assistant_decisions (mesma tabela usada por study-orchestrator),
 *     o que torna a ação rastreável pelo loop adaptativo já existente.
 *  4. Devolve decisionId + navigateTo para o front abrir o módulo correto.
 *  5. Quando o aluno completa a ação, study-complete fecha o loop normalmente
 *     gravando em orchestrator_outcomes (sem código novo necessário).
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

  // Garante que a recomendação pertence ao usuário
  const { data: rec, error: recErr } = await db
    .from("trajectory_recommendations")
    .select("*")
    .eq("id", body.recommendationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (recErr || !rec) return errorResponse("Recomendação não encontrada", 404);

  // Loga decisão (rastreabilidade no mesmo padrão do orquestrador)
  const decision = await logDecision(db, {
    user_id: userId,
    decision_type: "trajectory_apply",
    source_module: "radar_trajetoria",
    input_snapshot: {
      snapshotId: body.snapshotId ?? rec.snapshot_id,
      recommendationId: rec.id,
    },
    decision_output: {
      action: rec.orchestrator_action,
      targetModule: rec.target_module,
      payload: rec.payload,
    },
    justification: rec.rationale ?? rec.title,
    confidence_score: rec.expected_impact ? Math.min(1, rec.expected_impact / 100) : 0.5,
  });

  // Cria applied_action
  const { data: applied, error: appErr } = await db
    .from("trajectory_applied_actions")
    .insert({
      user_id: userId,
      snapshot_id: body.snapshotId ?? rec.snapshot_id,
      recommendation_id: rec.id,
      decision_id: decision.id,
      orchestrator_action: rec.orchestrator_action,
      target_module: rec.target_module,
      payload: rec.payload,
      status: "applied",
    })
    .select("id")
    .single();

  if (appErr || !applied) {
    return errorResponse(appErr?.message ?? "Falha ao registrar aplicação", 500);
  }

  // Constrói URL com ?did= para fechar loop pelo study-complete existente
  const targetModule: string = rec.target_module ?? "/dashboard";
  const sep = targetModule.includes("?") ? "&" : "?";
  const navigateTo = decision.id
    ? `${targetModule}${sep}did=${decision.id}`
    : targetModule;

  return jsonResponse({
    success: true,
    appliedActionId: applied.id,
    decisionId: decision.id,
    navigateTo,
  });
});
