/**
 * simulationRuntime — orquestração de timers centralizados (Wave 1, Fase 5).
 *
 * DEFINIDO mas NÃO WIRED ainda. Será adotado em sub-wave futura para
 * eliminar race conditions entre `countdownRef` e `deteriorationIntervalRef`
 * espalhados em `ClinicalSimulation.tsx`.
 *
 * Garante:
 *   - apenas UM intervalo por tipo (countdown / inactivity / deterioration)
 *   - cleanup determinístico em stop()
 *   - sem side-effects em import (factory pura)
 */

export interface RuntimeCallbacks {
  onTick: (countdownSec: number, elapsedSec: number) => void;
  onTimeExpired: () => void;
  onInactivity: () => void;
  onDeterioration: (level: number) => void;
}

export interface RuntimeConfig {
  initialCountdown: number;          // seconds
  inactivityThreshold?: number;      // ms — default 60s
  deteriorationInterval?: number;    // ms — default 90s
}

export function createSimulationRuntime(cfg: RuntimeConfig, cb: RuntimeCallbacks) {
  let countdown = cfg.initialCountdown;
  let elapsed = 0;
  let lastActionAt = Date.now();
  let deteriorationLevel = 0;

  let tickId: ReturnType<typeof setInterval> | null = null;
  let deterId: ReturnType<typeof setInterval> | null = null;

  const inactivityMs = cfg.inactivityThreshold ?? 60_000;
  const deterMs = cfg.deteriorationInterval ?? 90_000;

  function start() {
    stop();
    tickId = setInterval(() => {
      elapsed += 1;
      countdown = Math.max(0, countdown - 1);
      cb.onTick(countdown, elapsed);
      if (countdown === 0) {
        cb.onTimeExpired();
        stopTick();
      }
      if (Date.now() - lastActionAt > inactivityMs) {
        cb.onInactivity();
      }
    }, 1000);

    deterId = setInterval(() => {
      deteriorationLevel = Math.min(3, deteriorationLevel + 1);
      cb.onDeterioration(deteriorationLevel);
    }, deterMs);
  }

  function stopTick() {
    if (tickId) { clearInterval(tickId); tickId = null; }
  }

  function stop() {
    stopTick();
    if (deterId) { clearInterval(deterId); deterId = null; }
  }

  function markActivity() {
    lastActionAt = Date.now();
  }

  function resetDeterioration() {
    deteriorationLevel = 0;
  }

  return { start, stop, markActivity, resetDeterioration };
}

export type SimulationRuntime = ReturnType<typeof createSimulationRuntime>;
