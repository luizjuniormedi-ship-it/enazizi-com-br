/**
 * useClinicalSimulation — orquestrador central do plantão (Wave 1, Fase 1).
 *
 * ⚠️  ESQUELETO INTENCIONAL — Wave 1.0 entrega apenas a fundação.
 *
 * As responsabilidades plenas (phase, timers, countdown, deterioration,
 * scoring, message flow, restore, persistence orchestration, telemetry
 * dispatch) serão migradas em sub-waves 1.1–1.6 SEM rewrite num único passo.
 *
 * Este hook hoje expõe APENAS o que já foi extraído (audioRuntime e
 * clinicalTelemetry) para que call sites possam migrar gradualmente. Quando
 * todas as responsabilidades estiverem aqui, `ClinicalSimulation.tsx` cai
 * para <300 linhas (critério de sucesso Wave 1).
 */
import { useMemo, useRef } from "react";
import { audioRuntime } from "../utils/audioRuntime";
import { clinicalTelemetry, type ClinicalEventContext } from "../telemetry/clinicalTelemetry";

export interface UseClinicalSimulationOptions {
  specialty?: string;
  difficulty?: string;
  teacherCaseId?: string | null;
}

export function useClinicalSimulation(opts: UseClinicalSimulationOptions = {}) {
  // correlation_id estável durante a vida do componente
  const correlationIdRef = useRef<string>(clinicalTelemetry.newCorrelationId());

  const baseCtx: ClinicalEventContext = useMemo(() => ({
    correlation_id: correlationIdRef.current,
    specialty: opts.specialty,
    difficulty: opts.difficulty,
    teacher_case_id: opts.teacherCaseId ?? null,
  }), [opts.specialty, opts.difficulty, opts.teacherCaseId]);

  const api = useMemo(() => ({
    correlationId: correlationIdRef.current,

    // ─── áudio ──────────────────────────────────────────────────
    sound: audioRuntime.play,

    // ─── telemetria ─────────────────────────────────────────────
    track: (event: Parameters<typeof clinicalTelemetry.track>[0], extra: Record<string, unknown> = {}) =>
      clinicalTelemetry.track(event, baseCtx, extra),

    // ─── futuras responsabilidades (placeholders documentados) ──
    // phase:        adicionado em Wave 1.6 (via simulationReducer)
    // start:        adicionado em Wave 1.6
    // sendMessage:  adicionado em Wave 1.4 (após contrato tipado)
    // finish:       adicionado em Wave 1.6
    // restore:      adicionado em Wave 1.6
  }), [baseCtx]);

  return api;
}

export type ClinicalSimulationApi = ReturnType<typeof useClinicalSimulation>;
