/**
 * clinicalTelemetry — eventos estruturados do módulo plantão (Wave 1).
 *
 * Wrapper fino sobre o `telemetry` global existente (`@/lib/pedagogicalTelemetry`).
 * Garante:
 *  - nomes de evento canônicos (allow-list)
 *  - fire-and-forget (sempre void, nunca throw)
 *  - correlation_id por sessão de plantão
 *  - shape mínimo previsível por evento
 *
 * NÃO toca em FSRS / Planner / Tutor / TRI / scoring.
 * NÃO cria nova tabela de logs — reusa pipeline existente.
 */
import { telemetry } from "@/lib/pedagogicalTelemetry";

export type ClinicalEvent =
  | "plantao_started"
  | "plantao_restored"
  | "plantao_abandoned"
  | "plantao_completed"
  | "plantao_hint_used"
  | "plantao_specialist_consulted"
  | "plantao_prescription_submitted"
  | "plantao_deterioration_triggered"
  | "plantao_patient_improved"
  | "plantao_patient_worsened"
  | "plantao_time_expired"
  | "plantao_message_sent"
  | "plantao_exam_requested"
  | "plantao_error";

export interface ClinicalEventContext {
  correlation_id: string;
  specialty?: string;
  difficulty?: string;
  phase?: string;
  patient_status?: string;
  score?: number;
  time_elapsed?: number;
  teacher_case_id?: string | null;
  [k: string]: unknown;
}

/** Gera correlation_id estável para uma sessão. */
export function newCorrelationId(): string {
  try {
    return `plantao_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `plantao_${Date.now()}`;
  }
}

function safeTrack(event: ClinicalEvent, payload: Record<string, unknown>): void {
  try {
    // telemetry.track é fire-and-forget no projeto; envolvemos por garantia.
    Promise.resolve()
      .then(() => (telemetry as any)?.track?.(event, payload))
      .catch(() => {});
  } catch {
    /* never throw */
  }
}

/**
 * Emite evento clínico. Sempre void, sempre seguro.
 * @example
 *   clinicalTelemetry.track("plantao_started", ctx, { realistic_mode: true });
 */
function track(
  event: ClinicalEvent,
  ctx: ClinicalEventContext,
  extra: Record<string, unknown> = {},
): void {
  safeTrack(event, {
    ...ctx,
    ...extra,
    _ts: Date.now(),
    _module: "clinical-simulation",
  });
}

export const clinicalTelemetry = { track, newCorrelationId };
