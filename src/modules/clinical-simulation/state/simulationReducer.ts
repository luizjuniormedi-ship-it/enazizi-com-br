/**
 * simulationReducer — state machine explícita do plantão (Wave 1, Fase 2).
 *
 * DEFINIDO mas NÃO WIRED ainda. Será plugado em `useClinicalSimulation()` em
 * sub-wave futura. Manter type-pure e sem side-effects.
 *
 * Princípios:
 *   - phase é o único campo de fase autoritativo (zero flags redundantes).
 *   - eventos discriminados — impossível disparar transição inválida sem TS gritar.
 *   - reducer puro (testável, sem timers / sem fetch).
 *   - timers e deteção ficam em `simulationRuntime.ts` (Fase 5).
 */
import type { EdgeResponseContract, PatientStatus } from "../contracts/clinicalContracts";

// ── Fase única autoritativa ─────────────────────────────────────
export type SimulationPhase =
  | "idle"
  | "lobby"
  | "starting"
  | "active"
  | "finishing"
  | "result"
  | "restoring"
  | "error";

// ── Estado ──────────────────────────────────────────────────────
export interface SimulationState {
  phase: SimulationPhase;
  correlationId: string | null;

  // setup
  specialty: string;
  difficulty: string;
  realisticMode: boolean;
  learnerMode: boolean;

  // runtime clínico
  score: number;
  patientStatus: PatientStatus;
  deteriorationLevel: number;
  countdown: number;
  timeElapsed: number;
  timerExpired: boolean;

  // erros
  error: string | null;
}

export const initialSimulationState: SimulationState = {
  phase: "lobby",
  correlationId: null,
  specialty: "Clínica Médica",
  difficulty: "intermediário",
  realisticMode: false,
  learnerMode: false,
  score: 50,
  patientStatus: "stable",
  deteriorationLevel: 0,
  countdown: 0,
  timeElapsed: 0,
  timerExpired: false,
  error: null,
};

// ── Eventos (discriminated union) ───────────────────────────────
export type SimulationEvent =
  | { type: "START"; specialty: string; difficulty: string; realisticMode: boolean; learnerMode: boolean; countdown: number; correlationId: string }
  | { type: "RESTORE"; snapshot: Partial<SimulationState> }
  | { type: "MESSAGE_SENT" }
  | { type: "RESPONSE_RECEIVED"; contract: EdgeResponseContract }
  | { type: "DETERIORATION"; level: number }
  | { type: "PATIENT_IMPROVED"; status: PatientStatus }
  | { type: "PATIENT_WORSENED"; status: PatientStatus }
  | { type: "TICK"; countdown: number; timeElapsed: number }
  | { type: "FINISH" }
  | { type: "TIME_EXPIRED" }
  | { type: "RESET" }
  | { type: "ERROR"; message: string };

// ── Matriz de transições válidas (defense in depth) ─────────────
const ALLOWED_TRANSITIONS: Record<SimulationPhase, SimulationPhase[]> = {
  idle:      ["lobby", "restoring"],
  lobby:     ["starting", "restoring"],
  starting:  ["active", "error", "lobby"],
  active:    ["finishing", "error"],
  finishing: ["result", "error"],
  result:    ["lobby", "idle"],
  restoring: ["active", "lobby", "error"],
  error:     ["lobby", "idle"],
};

function canTransition(from: SimulationPhase, to: SimulationPhase): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Reducer puro ────────────────────────────────────────────────
export function simulationReducer(state: SimulationState, ev: SimulationEvent): SimulationState {
  switch (ev.type) {
    case "START": {
      if (!canTransition(state.phase, "starting")) return state;
      return {
        ...state,
        phase: "active",
        correlationId: ev.correlationId,
        specialty: ev.specialty,
        difficulty: ev.difficulty,
        realisticMode: ev.realisticMode,
        learnerMode: ev.learnerMode,
        countdown: ev.countdown,
        score: 50,
        patientStatus: "stable",
        deteriorationLevel: 0,
        timeElapsed: 0,
        timerExpired: false,
        error: null,
      };
    }
    case "RESTORE": {
      if (!canTransition(state.phase, "restoring")) return state;
      return { ...state, ...ev.snapshot, phase: "active", error: null };
    }
    case "RESPONSE_RECEIVED": {
      if (state.phase !== "active") return state;
      const c = ev.contract;
      const nextScore = typeof c.score_delta === "number"
        ? Math.max(0, Math.min(100, state.score + c.score_delta))
        : state.score;
      return {
        ...state,
        score: nextScore,
        patientStatus: c.patient_status ?? state.patientStatus,
        deteriorationLevel: typeof c.deterioration_level === "number" ? c.deterioration_level : state.deteriorationLevel,
      };
    }
    case "DETERIORATION":
      if (state.phase !== "active") return state;
      return { ...state, deteriorationLevel: ev.level };
    case "PATIENT_IMPROVED":
      if (state.phase !== "active") return state;
      return { ...state, patientStatus: ev.status, deteriorationLevel: Math.max(0, state.deteriorationLevel - 1) };
    case "PATIENT_WORSENED":
      if (state.phase !== "active") return state;
      return { ...state, patientStatus: ev.status, deteriorationLevel: state.deteriorationLevel + 1 };
    case "TICK":
      if (state.phase !== "active") return state;
      return { ...state, countdown: ev.countdown, timeElapsed: ev.timeElapsed };
    case "TIME_EXPIRED":
      if (state.phase !== "active") return state;
      return { ...state, countdown: 0, timerExpired: true };
    case "FINISH":
      if (!canTransition(state.phase, "finishing")) return state;
      return { ...state, phase: "result" };
    case "RESET":
      return { ...initialSimulationState, specialty: state.specialty, difficulty: state.difficulty };
    case "ERROR":
      return { ...state, phase: "error", error: ev.message };
    case "MESSAGE_SENT":
      return state; // observabilidade only — telemetry trata
    default:
      return state;
  }
}
