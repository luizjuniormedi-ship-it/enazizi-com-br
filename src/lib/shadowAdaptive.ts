/**
 * Shadow Adaptive Layer — Fase 3A (observacional)
 * ─────────────────────────────────────────────────
 * Camada única e silenciosa para coletar sinais cognitivos da jornada
 * do aluno SEM alterar o ranking pedagógico, planner, FSRS ou study-next.
 *
 * Garantias:
 *  - Tudo gated por feature flags (shadow_adaptive_enabled + sub-flags).
 *    Em produção todas nascem OFF. Quando OFF, retorno imediato (no-op).
 *  - Reuso total de tabelas existentes:
 *      • telemetry_events  → eventos unificados
 *      • assistant_decisions → decisões/outcomes shadow
 *  - Idempotência por chave de evento + dedup por sessão (5 min).
 *  - Fire-and-forget: erros são apenas warn, NUNCA propagam para a UI.
 *  - Sem alteração em hooks pedagógicos (useStudyEngine, study-next, etc).
 *
 * Quem consome:
 *  - Módulos da plataforma chamam `emitShadowEvent(...)` em eventos
 *    naturais (assistir, abrir, completar). Nada muda na UX.
 */
import { supabase } from "@/integrations/supabase/client";
import { safeTelemetry } from "@/lib/safeTelemetry";
import { generateEventHash } from "./idempotency";

const SHADOW_SOURCE = "shadow-adaptive-v1";
const DECISION_SOURCE_DECISION = "shadow-decision";
const DECISION_SOURCE_OUTCOME = "shadow-outcome";

// ─────────────────────────────── Tipos públicos ───────────────────────────────

export type ShadowModule =
  | "enaflix"
  | "tutor"
  | "simulado"
  | "flashcard"
  | "mnemonic"
  | "planner";

/** Eventos unificados — superset enxuto, expansível sem migration. */
export type ShadowEventName =
  // ENAFLIX
  | "watch_started"
  | "watch_completed"
  | "watch_abandoned"
  | "replay_started"
  | "playback_speed_changed"
  | "video_resumed"
  // Simulados
  | "simulation_started"
  | "simulation_finished"
  | "weak_topics_detected"
  // Tutor
  | "tutor_session_started"
  | "tutor_topic_requested"
  | "tutor_confusion_signal"
  | "tutor_dropoff"
  // Mnemônico v2
  | "mnemonic_created"
  | "mnemonic_opened"
  | "mnemonic_reviewed"
  // Flashcards / FSRS (somente observação — NÃO altera fila)
  | "flashcard_review_started"
  | "flashcard_review_completed"
  // Planner / Daily Mission (somente observação — NÃO recalcula)
  | "task_started"
  | "task_completed"
  | "task_abandoned"
  | "task_skipped";

export interface ShadowEventPayload {
  module: ShadowModule;
  event: ShadowEventName;
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  durationMs?: number | null;
  /** Dados livres específicos do módulo. */
  extra?: Record<string, unknown>;
}

export interface ShadowDecisionPayload {
  /** Decisão simulada (não aplicada). Ex.: "recomendaria_cardiologia". */
  kind: "recommendation" | "abandonment_risk" | "fatigue" | "low_retention" | "needs_review";
  module?: ShadowModule;
  topic?: string | null;
  reason?: string;
  /** Score livre 0..1 ou 0..100, à escolha do produtor. */
  score?: number | null;
  /** Snapshot de sinais usados (apenas log). */
  signals?: Record<string, unknown>;
}

export interface ShadowOutcomePayload {
  module: ShadowModule;
  /** O que o usuário realmente fez. */
  action: "completed" | "abandoned" | "skipped" | "returned";
  topic?: string | null;
  durationMs?: number | null;
  extra?: Record<string, unknown>;
}

// ─────────────────────────── Cache de flags (60s) ─────────────────────────────

interface FlagSnapshot {
  shadowAdaptive: boolean;
  unifiedEvents: boolean;
  shadowDecisions: boolean;
  shadowScores: boolean;
  fetchedAt: number;
}

const FLAG_TTL_MS = 60_000;
let flagCache: FlagSnapshot | null = null;
let flagPromise: Promise<FlagSnapshot> | null = null;

const DISABLED: FlagSnapshot = {
  shadowAdaptive: false,
  unifiedEvents: false,
  shadowDecisions: false,
  shadowScores: false,
  fetchedAt: 0,
};

async function getFlags(): Promise<FlagSnapshot> {
  const now = Date.now();
  if (flagCache && now - flagCache.fetchedAt < FLAG_TTL_MS) return flagCache;
  if (flagPromise) return flagPromise;

  flagPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("system_flags")
        .select("flag_key, enabled")
        .in("flag_key", [
          "shadow_adaptive_enabled",
          "unified_events_enabled",
          "shadow_decisions_enabled",
          "shadow_scores_enabled",
        ]);
      if (error || !data) return { ...DISABLED, fetchedAt: now };
      const map = new Map(data.map((r: any) => [r.flag_key, !!r.enabled]));
      const snap: FlagSnapshot = {
        shadowAdaptive: map.get("shadow_adaptive_enabled") ?? false,
        unifiedEvents: map.get("unified_events_enabled") ?? false,
        shadowDecisions: map.get("shadow_decisions_enabled") ?? false,
        shadowScores: map.get("shadow_scores_enabled") ?? false,
        fetchedAt: now,
      };
      flagCache = snap;
      return snap;
    } catch {
      return { ...DISABLED, fetchedAt: now };
    } finally {
      flagPromise = null;
    }
  })();

  return flagPromise;
}

// ─────────────────────── Dedup por sessão (5 min, in-memory) ─────────────────

const DEDUP_WINDOW_MS = 5 * 60_000;
const recentKeys = new Map<string, number>();

function shouldEmit(key: string): boolean {
  const now = Date.now();
  // Cleanup oportunista
  if (recentKeys.size > 200) {
    for (const [k, t] of recentKeys) if (now - t > DEDUP_WINDOW_MS) recentKeys.delete(k);
  }
  const last = recentKeys.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return false;
  recentKeys.set(key, now);
  return true;
}

// ───────────────────────────── Sessão helper ─────────────────────────────────

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────── API pública ─────────────────────────────────

/**
 * Emite evento unificado em telemetry_events. NO-OP se as flags estiverem OFF.
 * Idempotente por (user, module, event, topic) na janela de 5 min.
 */
export async function emitShadowEvent(payload: ShadowEventPayload): Promise<void> {
  try {
    const flags = await getFlags();
    if (!flags.shadowAdaptive || !flags.unifiedEvents) return;

    const userId = await getUserId();
    if (!userId) return;

    const dedupKey = `evt:${userId}:${payload.module}:${payload.event}:${payload.topic ?? ""}`;
    if (!shouldEmit(dedupKey)) return;

    const sessionId =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    await supabase.from("telemetry_events").insert([{
      user_id: userId,
      session_id: sessionId,
      event_name: `shadow_${payload.event}`,
      properties: {
        shadow: true,
        source: SHADOW_SOURCE,
        module: payload.module,
        topic: payload.topic ?? null,
        subtopic: payload.subtopic ?? null,
        specialty: payload.specialty ?? null,
        duration_ms: payload.durationMs ?? null,
        ...(payload.extra ?? {}),
      } as any,
      route: typeof window !== "undefined" ? window.location.pathname : null,
    }]);
  } catch (e) {
    console.warn("[shadowAdaptive] emitShadowEvent skipped:", e);
  }
}

/**
 * Registra decisão adaptativa SIMULADA em assistant_decisions.
 * NÃO aplica nada na UX. Visível apenas em analytics.
 */
export async function logShadowDecision(payload: ShadowDecisionPayload): Promise<void> {
  try {
    const flags = await getFlags();
    if (!flags.shadowAdaptive || !flags.shadowDecisions) return;

    const userId = await getUserId();
    if (!userId) return;

    const dedupKey = `dec:${userId}:${payload.kind}:${payload.module ?? ""}:${payload.topic ?? ""}`;
    if (!shouldEmit(dedupKey)) return;

    await safeTelemetry(async () => {
      const inputSnapshot = {
        kind: payload.kind,
        module: payload.module ?? null,
        topic: payload.topic ?? null,
        signals: payload.signals ?? {},
      };
      const eventHash = generateEventHash(userId, SHADOW_SOURCE, DECISION_SOURCE_DECISION, inputSnapshot);
      const { error } = await supabase.from("assistant_decisions").upsert([{
        user_id: userId,
        source_module: SHADOW_SOURCE,
        decision_type: DECISION_SOURCE_DECISION,
        event_hash: eventHash,
        idempotency_key: eventHash,
        justification: payload.reason ?? `shadow:${payload.kind}`,
        confidence_score: typeof payload.score === "number" ? payload.score : null,
        input_snapshot: inputSnapshot as any,
        decision_output: {
          applied: false,
          shadow: true,
          kind: payload.kind,
        } as any,
      }], { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error && error.code !== "23505") console.error("[TELEMETRY_SAFE_FAIL] shadow_decision", error);
    }, "logShadowDecision");
  } catch (e) {
    console.warn("[shadowAdaptive] logShadowDecision skipped:", e);
  }
}

/**
 * Registra outcome observacional (o que o usuário realmente fez).
 * Permite comparar decisões shadow vs comportamento real.
 */
export async function logShadowOutcome(payload: ShadowOutcomePayload): Promise<void> {
  try {
    const flags = await getFlags();
    if (!flags.shadowAdaptive || !flags.shadowDecisions) return;

    const userId = await getUserId();
    if (!userId) return;

    const dedupKey = `out:${userId}:${payload.module}:${payload.action}:${payload.topic ?? ""}`;
    if (!shouldEmit(dedupKey)) return;

    await safeTelemetry(async () => {
      const inputSnapshot = {
        module: payload.module,
        topic: payload.topic ?? null,
        duration_ms: payload.durationMs ?? null,
        extra: payload.extra ?? {},
      };
      const eventHash = generateEventHash(userId, SHADOW_SOURCE, DECISION_SOURCE_OUTCOME, inputSnapshot);
      const { error } = await supabase.from("assistant_decisions").upsert([{
        user_id: userId,
        source_module: SHADOW_SOURCE,
        decision_type: DECISION_SOURCE_OUTCOME,
        event_hash: eventHash,
        idempotency_key: eventHash,
        justification: `outcome:${payload.action}`,
        confidence_score: null,
        input_snapshot: inputSnapshot as any,
        decision_output: {
          applied: false,
          shadow: true,
          action: payload.action,
        } as any,
      }], { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error && error.code !== "23505") console.error("[TELEMETRY_SAFE_FAIL] shadow_outcome", error);
    }, "logShadowOutcome");
  } catch (e) {
    console.warn("[shadowAdaptive] logShadowOutcome skipped:", e);
  }
}

/**
 * Cálculo passivo de scores cognitivos. Apenas grava como decision_type=
 * "shadow-score". NÃO interfere no ranking real.
 */
export async function logShadowScores(scores: {
  module?: ShadowModule;
  topic?: string | null;
  fatigue?: number;
  retention?: number;
  abandonmentRisk?: number;
  engagement?: number;
  confidence?: number;
}): Promise<void> {
  try {
    const flags = await getFlags();
    if (!flags.shadowAdaptive || !flags.shadowScores) return;

    const userId = await getUserId();
    if (!userId) return;

    const dedupKey = `sco:${userId}:${scores.module ?? ""}:${scores.topic ?? ""}`;
    if (!shouldEmit(dedupKey)) return;

    await safeTelemetry(async () => {
      const inputSnapshot = {
        module: scores.module ?? null,
        topic: scores.topic ?? null,
      };
      const eventHash = generateEventHash(userId, SHADOW_SOURCE, "shadow-score", inputSnapshot);
      const { error } = await supabase.from("assistant_decisions").upsert([{
        user_id: userId,
        source_module: SHADOW_SOURCE,
        decision_type: "shadow-score",
        event_hash: eventHash,
        idempotency_key: eventHash,
        justification: "passive cognitive scores",
        confidence_score: null,
        input_snapshot: inputSnapshot as any,
        decision_output: {
          applied: false,
          shadow: true,
          scores: {
            fatigue: scores.fatigue ?? null,
            retention: scores.retention ?? null,
            abandonment_risk: scores.abandonmentRisk ?? null,
            engagement: scores.engagement ?? null,
            confidence: scores.confidence ?? null,
          },
        } as any,
      }], { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error && error.code !== "23505") console.error("[TELEMETRY_SAFE_FAIL] shadow_score", error);
    }, "logShadowScores");
  } catch (e) {
    console.warn("[shadowAdaptive] logShadowScores skipped:", e);
  }
}

/** Para testes/admin: invalida o cache de flags. */
export function __resetShadowFlagsCache() {
  flagCache = null;
  flagPromise = null;
  recentKeys.clear();
}
