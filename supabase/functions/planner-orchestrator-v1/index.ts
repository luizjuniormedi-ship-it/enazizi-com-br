/**
 * planner-orchestrator-v1 — Executor central do plano diário.
 *
 * Recebe propostas padronizadas (hoje vindas do Radar de Trajetória IA via
 * trajectory-apply-v1) e decide se materializa a ação como uma tarefa em
 * daily_plan_tasks do dia corrente. É o ÚNICO ponto autorizado a escrever
 * em daily_plan_tasks a partir de propostas externas.
 *
 * Regras de admissão (todas precisam passar):
 *   1. Dedupe por (user_id, plan_date, action_type, topic ou recommendation_id).
 *   2. Cooldown: não cria nova tarefa do mesmo recommendation_id em < 6h. (Opcional)
 *   3. Carga diária: respeita teto de 12 tarefas por daily_plan.
 *   4. Não sobrescreve: nunca remove/edita tarefas existentes; só adiciona.
 *   5. content_lock = true → recusa (planner congelado).
 *   6. Apenas hoje: opera sempre sobre daily_plans do CURRENT_DATE.
 *
 * Resposta:
 *   - { accepted: true,  taskId, planId, ... } se materializou
 *   - { accepted: false, reason }              se rejeitou (com motivo claro)
 *
 * Side-effects:
 *   - Insere em daily_plan_tasks (se aceito)
 *   - Insere em assistant_decisions (sempre, com source_module=planner_orchestrator)
 *   - NÃO toca em trajectory_applied_actions diretamente — quem chama
 *     (trajectory-apply-v1) já registra; este aqui apenas devolve resultado
 *     que será gravado dentro de payload.plannerResponse.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, logDecision,
} from "../_shared/assistant-helpers.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
type StandardActionType = "review" | "questions" | "theory" | "simulado";

interface StandardizedAction {
  actionType: StandardActionType;
  topic: string | null;
  specialty: string | null;
  estimatedMinutes: number;
  priority: number;
  origin: "radar_trajetoria" | string;
  snapshotId: string | null;
  recommendationId: string;
  rationale: string | null;
  raw: Record<string, unknown>;
}

interface OrchestratorBody {
  source: string;
  userId: string;
  decisionId?: string | null;
  snapshotId?: string | null;
  recommendationId?: string;
  action: StandardizedAction;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de regra
// ─────────────────────────────────────────────────────────────────────────────
const MAX_TASKS_PER_DAY = 12;
const COOLDOWN_HOURS = 6;
const MIN_MINUTES = 5;
const MAX_MINUTES = 120;

// Mapeia actionType → task_type / action_type usados em daily_plan_tasks
function mapTaskFields(actionType: StandardActionType): {
  task_type: string;
  action_type: string;
  titlePrefix: string;
} {
  switch (actionType) {
    case "review":
      return { task_type: "review", action_type: "review", titlePrefix: "Revisar" };
    case "simulado":
      return { task_type: "simulado", action_type: "simulado", titlePrefix: "Simulado" };
    case "theory":
      return { task_type: "study", action_type: "theory", titlePrefix: "Estudar" };
    case "questions":
    default:
      return { task_type: "study", action_type: "questions", titlePrefix: "Treinar questões" };
  }
}

function priorityLabel(p: number): string {
  if (p <= 1) return "alta";
  if (p <= 3) return "normal";
  return "baixa";
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método não permitido", 405);

  let body: OrchestratorBody;
  try {
    body = (await req.json()) as OrchestratorBody;
  } catch {
    return errorResponse("Body inválido", 400);
  }

  // Validação mínima
  if (!body?.userId || !body?.action?.actionType) {
    return errorResponse("Payload incompleto", 400);
  }

  const userId = body.userId;
  const action = body.action;
  const minutes = Math.max(
    MIN_MINUTES,
    Math.min(MAX_MINUTES, Math.round(action.estimatedMinutes ?? 30)),
  );

  const db = getServiceClient();

  // 1. Localiza ou cria daily_plan do dia (sem sobrescrever)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: existingPlan, error: planErr } = await db
    .from("daily_plans")
    .select("id, content_lock, total_blocks, completed_count")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .maybeSingle();
  if (planErr) {
    console.warn("[planner-orchestrator-v1] daily_plans select error:", planErr.message);
  }

  let planId: string;
  let contentLock = false;
  let currentTotal = 0;

  if (existingPlan) {
    planId = existingPlan.id as string;
    contentLock = !!existingPlan.content_lock;
    currentTotal = (existingPlan.total_blocks as number) ?? 0;
  } else {
    // Cria placeholder mínimo (não sobrescreve nada — não havia plano)
    const { data: created, error: createErr } = await db
      .from("daily_plans")
      .insert({
        user_id: userId,
        plan_date: today,
        plan_json: { source: "planner-orchestrator-v1", origin: action.origin },
        total_blocks: 0,
        completed_count: 0,
      })
      .select("id, content_lock, total_blocks")
      .single();
    if (createErr || !created) {
      return await rejectAndLog(db, userId, body, "plan_create_failed", createErr?.message);
    }
    planId = created.id as string;
    contentLock = !!(created as { content_lock?: boolean }).content_lock;
  }

  // 2. content_lock → recusa
  if (contentLock) {
    return await rejectAndLog(db, userId, body, "content_lock_active");
  }

  // 3. Carga diária
  if (currentTotal >= MAX_TASKS_PER_DAY) {
    return await rejectAndLog(db, userId, body, "daily_load_exceeded", `total=${currentTotal}`);
  }

  // 4. Cooldown — opcional
  if (action.recommendationId) {
    const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();
    const { data: recentSame } = await db
      .from("trajectory_applied_actions")
      .select("id, applied_at")
      .eq("user_id", userId)
      .eq("recommendation_id", action.recommendationId)
      .gte("applied_at", cooldownSince)
      .order("applied_at", { ascending: false })
      .limit(1);

    if ((recentSame?.length ?? 0) > 1) {
      return await rejectAndLog(db, userId, body, "cooldown_active", `since=${cooldownSince}`);
    }
  }

  // 5. Dedupe — mesma combinação tópico+action_type já existe no plano de hoje?
  const { task_type, action_type, titlePrefix } = mapTaskFields(action.actionType);
  const dedupeQuery = db
    .from("daily_plan_tasks")
    .select("id, title")
    .eq("user_id", userId)
    .eq("daily_plan_id", planId)
    .eq("action_type", action_type)
    .limit(1);

  const dedupe = action.topic
    ? await dedupeQuery.eq("topic", action.topic).maybeSingle()
    : await dedupeQuery.eq("title", `${titlePrefix} (Radar)`).maybeSingle();

  if (dedupe.data) {
    return await rejectAndLog(
      db,
      userId,
      body,
      "duplicate_task_today",
      `existing_task=${dedupe.data.id}`,
    );
  }

  // 6. Materializa a tarefa
  const title = action.topic
    ? `${titlePrefix}: ${action.topic}`
    : `${titlePrefix} (Radar)`;

  const description = action.rationale ?? "Recomendação do Radar de Trajetória IA";

  const { data: task, error: taskErr } = await db
    .from("daily_plan_tasks")
    .insert({
      daily_plan_id: planId,
      user_id: userId,
      task_type,
      action_type,
      topic: action.topic,
      specialty: action.specialty || (action.raw?.specialty as string | undefined) || "Geral",
      subtopic: (action.raw?.subtopic as string | undefined) ?? null,
      title,
      description,
      quantity: (action.raw?.quantity as number | undefined) ?? 1,
      estimated_minutes: minutes,
      priority: priorityLabel(action.priority),
      ordem: currentTotal + 1,
    })
    .select("id")
    .single();

  if (taskErr || !task) {
    return await rejectAndLog(db, userId, body, "task_insert_failed", taskErr?.message);
  }

  // 7. Atualiza contadores no daily_plan (não sobrescreve plan_json)
  await db
    .from("daily_plans")
    .update({ total_blocks: currentTotal + 1 })
    .eq("id", planId);

  // 8. Loga decisão do planner
  await logDecision(db, {
    user_id: userId,
    decision_type: "planner_apply",
    source_module: "planner_orchestrator",
    input_snapshot: {
      source: body.source,
      decisionId: body.decisionId ?? null,
      snapshotId: body.snapshotId ?? null,
      recommendationId: action.recommendationId || null,
      action,
    },
    decision_output: {
      accepted: true,
      planId,
      taskId: task.id,
      action_type,
      task_type,
    },
    justification: `Planner aceitou recomendação "${action.actionType}" do ${body.source}.`,
    confidence_score: 0.9,
  });

  return jsonResponse({
    accepted: true,
    taskId: task.id,
    planId,
    planDate: today,
    actionType: action.actionType,
    estimatedMinutes: minutes,
    priorityLabel: priorityLabel(action.priority),
    // Campo de vínculo usado pelo trigger SQL `tg_close_trajectory_action_on_task_complete`
    // para localizar a applied_action via payload.plannerResponse.taskId
    linkedTaskId: task.id,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rejeição com log determinístico
// ─────────────────────────────────────────────────────────────────────────────
async function rejectAndLog(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  body: OrchestratorBody,
  reason: string,
  detail?: string,
): Promise<Response> {
  await logDecision(db, {
    user_id: userId,
    decision_type: "planner_reject",
    source_module: "planner_orchestrator",
    input_snapshot: {
      source: body.source,
      decisionId: body.decisionId ?? null,
      snapshotId: body.snapshotId ?? null,
      recommendationId: body.action?.recommendationId ?? null,
      action: body.action,
    },
    decision_output: { accepted: false, reason, detail: detail ?? null },
    justification: `Planner recusou: ${reason}`,
    confidence_score: 0.7,
  });

  // 200 com accepted=false é proposital — o caller (trajectory-apply-v1)
  // já trata accepted como sinal e cai para pending_orchestrator se vier false.
  return jsonResponse({
    accepted: false,
    reason,
    detail: detail ?? null,
  });
}
