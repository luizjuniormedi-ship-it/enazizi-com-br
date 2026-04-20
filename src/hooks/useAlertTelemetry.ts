/**
 * useAlertTelemetry — registra automaticamente exposição e supressão
 * ──────────────────────────────────────────────────────────────────
 * Hook leve que observa `useAlertOrchestrator()` e dispara `trackAlertEvent`
 * para todos os alertas visíveis (exposed) e suprimidos (suppressed).
 *
 * Inclui dedupe por sessão (em `alertTelemetry.ts`), então é seguro chamar
 * em múltiplos lugares.
 *
 * Uso (1 vez no layout principal autenticado):
 *   useAlertTelemetry();
 */
import { useEffect } from "react";
import { useAlertOrchestrator } from "./useAlertOrchestrator";
import {
  trackAlertExposureBatch,
  trackAlertSuppressionBatch,
} from "@/lib/alertTelemetry";

export function useAlertTelemetry(): void {
  const { allAlerts } = useAlertOrchestrator();

  useEffect(() => {
    if (allAlerts.length === 0) return;

    const visible = allAlerts.filter((a) => a.visible);
    const suppressed = allAlerts.filter((a) => !a.visible && a.suppressedBy);

    trackAlertExposureBatch(visible);
    trackAlertSuppressionBatch(suppressed);
  }, [allAlerts]);
}
