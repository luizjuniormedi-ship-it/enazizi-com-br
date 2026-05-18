/**
 * Protocolo central de conclusão de ações de estudo — ENAZIZI
 *
 * Toda conclusão de estudo (manual ou automática) deve passar por aqui.
 * Responsabilidades:
 *  1. Persistir conclusão na tabela correta
 *  2. Atualizar user_missions
 *  3. Sincronizar daily_plan_tasks
 *  4. Registrar telemetria
 *  5. Disparar refreshAll (via callback)
 */
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";
import { updateMnemonicEfficacy } from "@/lib/mnemonicAdaptiveService";
import { decideIntervention, calculateCLS, calculateRiskScore } from "@/lib/mnemonicIntelligence";
import { triggerInvisibleMnemonic } from "@/lib/mnemonicInvisibleService";

/* ── Mapa central de tipos ── */
export type StudyActionType =
  | "review"
  | "error_review"
  | "flashcard"
  | "content"
  | "daily_plan"
  | "professor_plan"
  | "tutor"
  | "question"
  | "simulado"
  | "clinical"
  | "anamnesis"
  | "practical"
  | "new"
  | "practice";

export interface StudyActionPayload {
  userId: string;
  missionId?: string | null;
  taskId?: string;
  taskType: StudyActionType;
  topic: string;
  subtopic?: string;
  specialty?: string;
  source: "auto" | "manual";
  originModule: string;
  metadata?: Record<string, any>;
  /** Canonical source table (e.g. "revisoes", "error_bank") */
  sourceTable?: string;
  /** Canonical record ID for direct DB update */
  sourceRecordId?: string;
  /** FSRS card ID for direct update */
  fsrsCardId?: string;
  /** Error bank ID for direct update */
  errorBankId?: string;
  /** Daily plan task ID for direct update */
  dailyPlanTaskId?: string;
  /** Professor plan task ID for direct update */
  professorPlanTaskId?: string;
}

export interface StudyActionResult {
  success: boolean;
  tablesUpdated: string[];
  errors: string[];
}

export interface StudyActionFullResult extends StudyActionResult {
  missionUpdated: boolean;
  dashboardRefreshRequired: boolean;
  weeklyPlanRecalculated: boolean;
  auditEventId: string | null;
}

/* ── Helpers internos ── */

async function markReviewDone(userId: string, topic: string, now: string, sourceRecordId?: string): Promise<string | null> {
  // Direct update by canonical ID (preferred path)
  if (sourceRecordId) {
    const { error } = await supabase
      .from("revisoes")
      .update({ status: "concluida" as any, concluida_em: now } as any)
      .eq("id", sourceRecordId)
      .eq("user_id", userId)
      .eq("status", "pendente");
    if (!error) return "revisoes";
    // If direct ID failed (already completed?), don't fallback
    console.warn("[completeStudyAction] markReviewDone by ID failed:", sourceRecordId, error.message);
    return null;
  }

  // Legacy fallback: text-based matching (for tasks without sourceRecordId)
  const { data: temaRows } = await supabase
    .from("temas_estudados")
    .select("id")
    .eq("user_id", userId)
    .ilike("tema", `%${topic}%`);

  if (!temaRows || temaRows.length === 0) return null;
  const temaIds = temaRows.map(r => r.id);

  const { data: pendingReview } = await supabase
    .from("revisoes")
    .select("id")
    .eq("user_id", userId)
    .in("tema_id", temaIds)
    .eq("status", "pendente")
    .order("data_revisao", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pendingReview) return null;

  const { error } = await supabase
    .from("revisoes")
    .update({ status: "concluida" as any, concluida_em: now } as any)
    .eq("id", pendingReview.id);

  return error ? null : "revisoes";
}

async function markErrorDominated(userId: string, topic: string, now: string, errorBankId?: string): Promise<string | null> {
  // Direct update by canonical ID (preferred)
  if (errorBankId) {
    const { error } = await supabase
      .from("error_bank")
      .update({ dominado: true, dominado_em: now })
      .eq("id", errorBankId)
      .eq("user_id", userId)
      .eq("dominado", false);
    if (!error) return "error_bank";
    console.warn("[completeStudyAction] markErrorDominated by ID failed:", errorBankId, error.message);
    return null;
  }

  // Legacy fallback
  const { error } = await supabase
    .from("error_bank")
    .update({ dominado: true, dominado_em: now })
    .eq("user_id", userId)
    .ilike("tema", `%${topic}%`)
    .eq("dominado", false);
  return error ? null : "error_bank";
}

async function updateFsrsCard(userId: string, topic: string, now: string, fsrsCardId?: string): Promise<string | null> {
  // Direct update by canonical ID (preferred)
  if (fsrsCardId) {
    const { data: card } = await supabase
      .from("fsrs_cards")
      .select("id, stability, scheduled_days")
      .eq("id", fsrsCardId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (card) {
      const nextDays = Math.max(1, Math.round((card.stability || 1) * 2.5));
      const nextDue = new Date(Date.now() + nextDays * 86400_000).toISOString();
      await supabase.from("fsrs_cards").update({
        last_review: now,
        due: nextDue,
        scheduled_days: nextDays,
        elapsed_days: 0,
      }).eq("id", card.id);
      return "fsrs_cards";
    }
  }

  // Legacy fallback: text-based matching
  const { data: card } = await supabase
    .from("fsrs_cards")
    .select("id, stability, scheduled_days")
    .eq("user_id", userId)
    .eq("card_type", "tema")
    .ilike("card_ref_id", `%${topic}%`)
    .limit(1)
    .maybeSingle();

  if (card) {
    const nextDays = Math.max(1, Math.round((card.stability || 1) * 2.5));
    const nextDue = new Date(Date.now() + nextDays * 86400_000).toISOString();
    await supabase.from("fsrs_cards").update({
      last_review: now,
      due: nextDue,
      scheduled_days: nextDays,
      elapsed_days: 0,
    }).eq("id", card.id);
    return "fsrs_cards";
  }
  return null;
}

async function registerTemaEstudado(userId: string, topic: string, specialty: string, source: string, today: string): Promise<string | null> {
  // Dedup: check if already registered today
  const { data: existing } = await supabase
    .from("temas_estudados")
    .select("id")
    .eq("user_id", userId)
    .eq("tema", topic)
    .eq("data_estudo", today)
    .limit(1)
    .maybeSingle();

  if (existing) return "temas_estudados";

  const { error } = await supabase.from("temas_estudados").insert({
    user_id: userId,
    tema: topic,
    especialidade: specialty,
    fonte: `mission_${source}`,
    data_estudo: today,
    status: "concluido",
  });
  return error ? null : "temas_estudados";
}

async function syncDailyPlan(userId: string, topic: string, now: string, today: string, dailyPlanTaskId?: string): Promise<string | null> {
  // Fast path: direct update by canonical ID (no text matching)
  if (dailyPlanTaskId) {
    const { error } = await supabase
      .from("daily_plan_tasks")
      .update({ completed: true, completed_at: now } as any)
      .eq("id", dailyPlanTaskId)
      .eq("user_id", userId)
      .eq("completed", false);

    if (!error) {
      // Update completed_count on the parent daily_plan
      const { data: task } = await supabase
        .from("daily_plan_tasks")
        .select("daily_plan_id")
        .eq("id", dailyPlanTaskId)
        .maybeSingle();

      if (task) {
        const { count } = await supabase
          .from("daily_plan_tasks")
          .select("id", { count: "exact", head: true })
          .eq("daily_plan_id", task.daily_plan_id)
          .eq("completed", true);

        if (count !== null) {
          await supabase
            .from("daily_plans")
            .update({ completed_count: count, updated_at: now } as any)
            .eq("id", task.daily_plan_id);
        }
      }
      return "daily_plan_tasks";
    }
    // If ID-based update failed, fall through to text matching
    console.warn("[completeStudyAction] syncDailyPlan by ID failed:", dailyPlanTaskId);
  }

  // Fallback: text-based matching
  const { data: todayPlan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .limit(1)
    .maybeSingle();

  if (!todayPlan) return null;

  await supabase
    .from("daily_plan_tasks")
    .update({ completed: true, completed_at: now } as any)
    .eq("daily_plan_id", todayPlan.id)
    .eq("user_id", userId)
    .eq("completed", false)
    .ilike("title", `%${topic}%`);

  const { count } = await supabase
    .from("daily_plan_tasks")
    .select("id", { count: "exact", head: true })
    .eq("daily_plan_id", todayPlan.id)
    .eq("completed", true);

  if (count !== null) {
    await supabase
      .from("daily_plans")
      .update({ completed_count: count, updated_at: now } as any)
      .eq("id", todayPlan.id);
  }
  return "daily_plan_tasks";
}

async function syncProfessorPlan(userId: string, topic: string, now: string, professorPlanTaskId?: string): Promise<string | null> {
  if (professorPlanTaskId) {
    const { error } = await supabase
      .from("professor_plan_daily_tasks")
      .update({ status: "completed" as any, completed_at: now })
      .eq("id", professorPlanTaskId)
      .eq("user_id", userId);
    return error ? null : "professor_plan_daily_tasks";
  }
  return null;
}

async function logTelemetry(payload: StudyActionPayload, tablesUpdated: string[], errors: string[]) {
  try {
    const { logActivity } = await import("@/lib/activityLogger");
    await logActivity(payload.userId, "study_action_completed", {
      taskId: payload.taskId,
      taskType: payload.taskType,
      topic: payload.topic,
      source: payload.source,
      originModule: payload.originModule,
      tablesUpdated,
      errors: errors.length > 0 ? errors : undefined,
    });

    // Telemetry Phase 2: specific daily mission events
    if (payload.originModule === "daily-plan" || payload.originModule === "mission") {
      supabase.functions.invoke("unified-telemetry", {
        body: { 
          userId: payload.userId, 
          eventType: "daily_mission_task_completed", 
          module: payload.originModule,
          data: { task_id: payload.taskId, topic: payload.topic, type: payload.taskType }
        }
      }).then();
    }

  } catch {
    // telemetry never blocks
  }
}

/* ── Auditoria ── */

async function writeAuditEvent(
  payload: StudyActionPayload,
  tablesUpdated: string[],
  status: "success" | "error",
  errorMessages: string[] = [],
): Promise<string | null> {
  try {
    const { data } = await supabase.from("study_action_events" as any).insert({
      user_id: payload.userId,
      mission_id: payload.missionId || null,
      task_id: payload.taskId || null,
      task_type: payload.taskType,
      source: payload.source,
      origin_module: payload.originModule,
      topic: payload.topic || null,
      subtopic: payload.subtopic || null,
      affected_table: tablesUpdated.join(",") || null,
      status,
      error_message: status === "error" ? (errorMessages?.join("; ") || null) : null,
      payload_json: {
        specialty: payload.specialty,
        metadata: payload.metadata,
        tablesUpdated,
      },
    } as any).select("id").single();
    return (data as any)?.id || null;
  } catch {
    return null;
  }
}

/* ── user_missions é gerido exclusivamente por useMissionMode ── */

/* ── Serviço principal ── */

export async function completeStudyAction(payload: StudyActionPayload): Promise<StudyActionFullResult> {
  const { userId, taskType, topic, source, specialty } = payload;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const tablesUpdated: string[] = [];
  const errors: string[] = [];

  const safe = async (fn: () => Promise<string | null>, label: string) => {
    try {
      const result = await fn();
      if (result) tablesUpdated.push(result);
    } catch (e: any) {
      errors.push(`${label}: ${e?.message || "unknown"}`);
    }
  };

  // 1. Persistir na tabela correta por tipo (usando IDs canônicos quando disponíveis)
  switch (taskType) {
    case "review":
      await safe(() => markReviewDone(userId, topic, now, payload.sourceRecordId), "revisoes");
      await safe(() => updateFsrsCard(userId, topic, now, payload.fsrsCardId), "fsrs");
      break;
    case "error_review":
      await safe(() => markErrorDominated(userId, topic, now, payload.errorBankId || payload.sourceRecordId), "error_bank");
      await safe(() => updateFsrsCard(userId, topic, now, payload.fsrsCardId), "fsrs");
      break;
    case "flashcard":
      await safe(() => updateFsrsCard(userId, topic, now, payload.fsrsCardId || payload.sourceRecordId), "fsrs");
      break;
    case "content":
    case "new":
    case "tutor":
      // Content/new/tutor — register study
      break;
    case "question":
    case "simulado":
    case "practice":
      // Performance already persisted by modules themselves
      break;
    case "clinical":
    case "anamnesis":
    case "practical":
      // Sessions already persisted by modules
      break;
    case "daily_plan":
      // Only sync daily plan below
      break;
    case "professor_plan":
      await safe(() => syncProfessorPlan(userId, topic, now, payload.professorPlanTaskId), "professor_plan");
      break;
  }

  // 2. Sempre registrar tema estudado
  await safe(
    () => registerTemaEstudado(userId, topic, specialty || "Geral", source, today),
    "temas_estudados"
  );

  // 3. Sempre sincronizar daily plan (prefer canonical ID)
  await safe(() => syncDailyPlan(userId, topic, now, today, payload.dailyPlanTaskId), "daily_plan");

  // 4. Validação de falso positivo — Bug 4
  if (taskType === "review" && !tablesUpdated.includes("revisoes")) {
    errors.push("revisoes: nenhuma revisão pendente encontrada");
  }
  if (taskType === "error_review" && !tablesUpdated.includes("error_bank")) {
    errors.push("error_bank: nenhum erro pendente encontrado");
  }

  // 5. Telemetria (fire-and-forget)
  logTelemetry(payload, tablesUpdated, errors);

  // 5b. Mnemonic efficacy tracking (fire-and-forget)
  // FIX #6: wasCorrect uses real result from metadata, not heuristic
  if (topic) {
    const wasCorrect = payload.metadata?.wasCorrect === true
      || payload.metadata?.acertou === true
      || payload.metadata?.correct === true;
    updateMnemonicEfficacy(userId, topic, wasCorrect).catch(() => {});
  }

  // 5c. Orchestrator: CLS + RFS → decide intervention → invisible mnemonic (fire-and-forget)
  if (topic && userId) {
    Promise.all([
      decideIntervention(userId, topic),
      calculateCLS(userId, topic),
      calculateRiskScore(userId, topic),
    ]).then(([decision, cls, rfs]) => {
      if (decision.action === "mnemonic") {
        devLog(`[Orchestrator] ${decision.reason}`);
        triggerInvisibleMnemonic({
          userId,
          topic,
          decision,
          cls,
          rfs,
          sourceContext: {
            triggerReason: decision.reason,
          },
        });
      }
    }).catch(() => {});
  }

  // 6. Auditoria persistente
  const auditEventId = await writeAuditEvent(
    payload,
    tablesUpdated,
    errors.length === 0 ? "success" : "error",
    errors,
  );

  return {
    success: errors.length === 0,
    tablesUpdated,
    errors,
    missionUpdated: false,
    dashboardRefreshRequired: true,
    weeklyPlanRecalculated: tablesUpdated.includes("daily_plan_tasks"),
    auditEventId,
  };
}