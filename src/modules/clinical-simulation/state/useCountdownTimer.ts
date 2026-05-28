/**
 * useCountdownTimer — Wave 1.2
 *
 * Centraliza o countdown do plantão num único setInterval — elimina o risco
 * de timers duplicados / órfãos espalhados em ClinicalSimulation.tsx.
 *
 * Garantias:
 *   - apenas UM interval ativo por hook (start() sempre stop() antes)
 *   - timer só roda quando `enabled === true` (caller liga em phase==="active")
 *   - cleanup determinístico em unmount, em stop() e em mudança de `enabled`
 *   - logs estruturados [PLANTAO_TIMER_STARTED/STOPPED], [PLANTAO_TIME_EXPIRED],
 *     [PLANTAO_INACTIVITY_WARNING]
 *
 * NÃO toca em:
 *   - score, edge function, UX, layout, persistência
 *   - deterioração (será migrada em sub-wave futura)
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type TimerStopReason =
  | "FINISH"
  | "RESET"
  | "RESTORE"
  | "ERROR"
  | "EXPIRED"
  | "UNMOUNT"
  | "DISABLED"
  | "MANUAL";

export interface UseCountdownTimerOptions {
  enabled: boolean;
  initialSeconds: number;
  correlationId?: string | null;
  onTick?: (remaining: number) => void;
  onMilestone?: (remaining: number) => void;
  onExpired?: () => void;
}

const MILESTONES = new Set<number>([301, 121]); // 5min, 2min restantes

export function useCountdownTimer(opts: UseCountdownTimerOptions) {
  const { enabled, initialSeconds, correlationId = null, onTick, onMilestone, onExpired } = opts;

  const [remaining, setRemaining] = useState<number>(initialSeconds);
  const [expired, setExpired] = useState<boolean>(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const targetRef = useRef<number>(initialSeconds);
  const cbRef = useRef({ onTick, onMilestone, onExpired });
  cbRef.current = { onTick, onMilestone, onExpired };

  const stop = useCallback((reason: TimerStopReason) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      // eslint-disable-next-line no-console
      console.info("[PLANTAO_TIMER_STOPPED]", {
        reason,
        correlation_id: correlationId,
        target_seconds: targetRef.current,
        started_at: startedAtRef.current,
      });
      startedAtRef.current = null;
    }
  }, [correlationId]);

  const start = useCallback((seconds: number) => {
    // garantia: sempre parar antes (evita timer duplicado)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    targetRef.current = seconds;
    startedAtRef.current = Date.now();
    setRemaining(seconds);
    setExpired(false);

    // eslint-disable-next-line no-console
    console.info("[PLANTAO_TIMER_STARTED]", {
      target_seconds: seconds,
      correlation_id: correlationId,
    });

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          setExpired(true);
          // eslint-disable-next-line no-console
          console.warn("[PLANTAO_TIME_EXPIRED]", {
            correlation_id: correlationId,
            target_seconds: targetRef.current,
          });
          // eslint-disable-next-line no-console
          console.info("[PLANTAO_TIMER_STOPPED]", {
            reason: "EXPIRED" as TimerStopReason,
            correlation_id: correlationId,
            target_seconds: targetRef.current,
            started_at: startedAtRef.current,
          });
          startedAtRef.current = null;
          try { cbRef.current.onExpired?.(); } catch {}
          return 0;
        }
        const next = prev - 1;
        try { cbRef.current.onTick?.(next); } catch {}
        if (MILESTONES.has(prev)) {
          try { cbRef.current.onMilestone?.(prev); } catch {}
        }
        return next;
      });
    }, 1000);
  }, [correlationId]);

  // Cleanup duro: se sair do `enabled`, derruba interval imediatamente.
  useEffect(() => {
    if (!enabled && intervalRef.current) {
      stop("DISABLED");
    }
  }, [enabled, stop]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        // eslint-disable-next-line no-console
        console.info("[PLANTAO_TIMER_STOPPED]", {
          reason: "UNMOUNT" as TimerStopReason,
          correlation_id: correlationId,
        });
      }
    };
  }, [correlationId]);

  const reset = useCallback((seconds: number = 0) => {
    stop("RESET");
    targetRef.current = seconds;
    setRemaining(seconds);
    setExpired(false);
  }, [stop]);

  const logInactivityWarning = useCallback((elapsedSec: number) => {
    // eslint-disable-next-line no-console
    console.info("[PLANTAO_INACTIVITY_WARNING]", {
      correlation_id: correlationId,
      elapsed_seconds: Math.round(elapsedSec),
    });
  }, [correlationId]);

  return {
    remaining,
    expired,
    start,
    stop,
    reset,
    setRemaining,
    logInactivityWarning,
    isRunning: intervalRef.current !== null,
  } as const;
}
