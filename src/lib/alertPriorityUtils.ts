/**
 * alertPriorityUtils — utilitários de manipulação de prioridade
 * ──────────────────────────────────────────────────────────────
 * Helpers puros para deslocar prioridade de alertas com clamping seguro.
 * Usado pelo Adaptive Ranking (Fase 5) para promover/rebaixar alertas
 * com base em performance histórica.
 */
import type { AlertPriority } from "@/types/alertOrchestrator";

const ORDER: AlertPriority[] = [
  "informational",
  "contextual",
  "important",
  "critical",
];

/**
 * Desloca a prioridade `current` em `delta` posições.
 * - delta > 0 → promove (até "critical")
 * - delta < 0 → rebaixa (até "informational")
 * - clamp nas bordas, nunca lança
 */
export function shiftPriority(
  current: AlertPriority,
  delta: number
): AlertPriority {
  const idx = ORDER.indexOf(current);
  if (idx === -1) return current;
  const next = Math.max(0, Math.min(ORDER.length - 1, idx + delta));
  return ORDER[next];
}

/** Diferença numérica entre duas prioridades (b - a). */
export function priorityDelta(a: AlertPriority, b: AlertPriority): number {
  return ORDER.indexOf(b) - ORDER.indexOf(a);
}
