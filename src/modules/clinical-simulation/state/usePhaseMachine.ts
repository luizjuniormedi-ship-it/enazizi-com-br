/**
 * usePhaseMachine — Wave 1.1
 *
 * Hook fino que substitui `useState<Phase>` pelo state machine real (`SimulationPhase`)
 * SEM migrar score/timers/contracts ainda. Mantém uma API `setPhase` compatível
 * para evitar reescrita massiva de call sites, mas internamente:
 *   - usa useReducer com matriz de transições (defense in depth, warn-only)
 *   - emite log estruturado `[PLANTAO_STATE_TRANSITION]` em toda transição válida
 *   - emite `[PLANTAO_STATE_TRANSITION_BLOCKED]` em transição inválida
 *
 * IMPORTANTE: warn-only — não bloqueia para não regredir UX.
 * Toda lógica clínica (score, vitals, deterioration, countdown) continua local
 * em `ClinicalSimulation.tsx`. Migração completa fica para Waves 1.2–1.6.
 */
import { useCallback, useReducer, useRef } from "react";
import type { SimulationPhase } from "./simulationReducer";

export type PhaseTransitionEvent =
  | "START"
  | "RESTORE"
  | "FINISH"
  | "FINISH_OK"
  | "FINISH_FAILED"
  | "RESET"
  | "ERROR"
  | "MANUAL";

interface PhaseState {
  phase: SimulationPhase;
}

interface PhaseAction {
  type: "TRANSITION";
  to: SimulationPhase;
  event: PhaseTransitionEvent;
  correlationId: string | null;
}

const ALLOWED: Record<SimulationPhase, SimulationPhase[]> = {
  idle:      ["lobby", "restoring"],
  lobby:     ["starting", "active", "restoring"],
  starting:  ["active", "error", "lobby"],
  active:    ["finishing", "error", "lobby"],
  finishing: ["result", "active", "error"],
  result:    ["lobby", "idle"],
  restoring: ["active", "lobby", "error"],
  error:     ["lobby", "idle"],
};

function reducer(state: PhaseState, action: PhaseAction): PhaseState {
  if (action.type !== "TRANSITION") return state;
  const from = state.phase;
  const to = action.to;
  if (from === to) return state;

  const allowed = ALLOWED[from]?.includes(to) ?? false;
  if (!allowed) {
    // warn-only — não bloqueia (compatibilidade Wave 1.1)
    // eslint-disable-next-line no-console
    console.warn("[PLANTAO_STATE_TRANSITION_BLOCKED]", {
      from, to, event: action.event, correlation_id: action.correlationId,
      note: "transição não declarada — permitida em modo warn-only",
    });
  }

  // eslint-disable-next-line no-console
  console.info("[PLANTAO_STATE_TRANSITION]", {
    from, to, event: action.event, correlation_id: action.correlationId,
    valid: allowed,
  });

  return { phase: to };
}

export interface UsePhaseMachineOptions {
  initial?: SimulationPhase;
  correlationId?: string | null;
}

export function usePhaseMachine(opts: UsePhaseMachineOptions = {}) {
  const [state, dispatch] = useReducer(reducer, { phase: opts.initial ?? "lobby" });
  const corrRef = useRef<string | null>(opts.correlationId ?? null);
  corrRef.current = opts.correlationId ?? corrRef.current;

  const transition = useCallback((to: SimulationPhase, event: PhaseTransitionEvent) => {
    dispatch({ type: "TRANSITION", to, event, correlationId: corrRef.current });
  }, []);

  // Shim compatível com a API anterior `setPhase(next)`.
  // Sem event explícito, classifica como MANUAL.
  const setPhase = useCallback((to: SimulationPhase, event: PhaseTransitionEvent = "MANUAL") => {
    dispatch({ type: "TRANSITION", to, event, correlationId: corrRef.current });
  }, []);

  return {
    phase: state.phase,
    setPhase,
    transition,
  } as const;
}
