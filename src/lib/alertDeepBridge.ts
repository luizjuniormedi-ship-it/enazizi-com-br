/**
 * alertDeepBridge — ponte para popups / modais / onboarding (camada `deep`)
 * ─────────────────────────────────────────────────────────────────────────
 * Garante que popups profundos (onboarding, install, whats-new, feedback,
 * system guide) só abram com permissão do orchestrator.
 *
 * Regras enforced:
 *   - cap deep = 1
 *   - nunca abrir se houver `critical structural` ativo
 *   - dedupe via `dedupeKey`
 *
 * Esta sprint NÃO remove popups legacy — apenas fornece o helper
 * `canOpenDeep(decision)` para componentes adotarem progressivamente.
 *
 * Uso típico em um popup:
 *   const { getDecision } = useAlertOrchestrator();
 *   const decision = getDecision("install-app");
 *   if (!canOpenDeep(decision)) return null;
 */
import type { AlertDecision } from "@/types/alertOrchestrator";

/**
 * Retorna `true` se o popup pode ser aberto agora.
 * Tratamos `decision === undefined` como "não-gated" (compat com componentes
 * ainda não migrados), mas se `decision` for passada explicitamente,
 * respeitamos a supressão.
 */
export function canOpenDeep(decision?: AlertDecision): boolean {
  if (!decision) return true;
  return decision.visible !== false;
}

/** Razão da supressão (para logs/debug). `null` se liberado. */
export function whyDeepSuppressed(decision?: AlertDecision): string | null {
  if (!decision || decision.visible !== false) return null;
  return decision.suppressedBy ?? "orchestrator";
}
