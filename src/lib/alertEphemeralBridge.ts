/**
 * alertEphemeralBridge — ponte para toasts/eventos efêmeros
 * ──────────────────────────────────────────────────────────
 * Centraliza a decisão de DISPARAR um toast através do orchestrator.
 *
 * Hoje convivem dois sistemas de toast (`sonner` + `useToast` legacy).
 * Esta sprint NÃO remove nenhum dos dois — apenas oferece um helper
 * que respeita o gating do orchestrator (ex.: não disparar achievement
 * quando há `critical structural` ativo).
 *
 * Uso:
 *   import { emitEphemeral } from "@/lib/alertEphemeralBridge";
 *   emitEphemeral({
 *     source: "achievement",
 *     message: "Conquista desbloqueada!",
 *     decision, // vindo de useAlertOrchestrator().getDecision("achievement")
 *   });
 *
 * Quem chama é responsável por obter a `decision` via hook.
 * O bridge não acopla React.
 */
import { toast as sonnerToast } from "sonner";
import type { AlertDecision, AlertSource } from "@/types/alertOrchestrator";

export interface EphemeralEmitOptions {
  source: AlertSource;
  message: string;
  description?: string;
  /** Decisão prévia obtida via `useAlertOrchestrator().getDecision(source)`. */
  decision?: AlertDecision;
  /** Variante visual; default = "default". */
  variant?: "default" | "success" | "error" | "info";
  /** Duração em ms (sonner). */
  duration?: number;
}

export interface EphemeralEmitResult {
  emitted: boolean;
  suppressedBy?: string;
}

/**
 * Dispara um toast efêmero respeitando o orchestrator.
 * Retorna `emitted: false` se o gating do orchestrator suprimir.
 */
export function emitEphemeral(opts: EphemeralEmitOptions): EphemeralEmitResult {
  const { source, message, description, decision, variant = "default", duration } = opts;

  // Se uma decisão foi passada e diz que está suprimido, não dispara.
  if (decision && decision.visible === false) {
    return { emitted: false, suppressedBy: decision.suppressedBy ?? "orchestrator" };
  }

  const fn =
    variant === "success"
      ? sonnerToast.success
      : variant === "error"
      ? sonnerToast.error
      : variant === "info"
      ? sonnerToast.info
      : sonnerToast;

  fn(message, { description, duration });

  // Marcador para debug futuro / telemetria
  if (typeof window !== "undefined") {
    (window as unknown as { __alertOrchestratorLastEphemeral?: unknown }).__alertOrchestratorLastEphemeral = {
      source,
      message,
      at: Date.now(),
    };
  }

  return { emitted: true };
}
