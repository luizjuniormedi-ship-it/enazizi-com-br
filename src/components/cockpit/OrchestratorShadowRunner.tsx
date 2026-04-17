/**
 * OrchestratorShadowRunner — F1 silent activation.
 *
 * Renders nothing. Triggers useOrchestrator in shadow mode so the edge function
 * runs in parallel to study-next and logs decisions/rule traces.
 * No UI impact. Remove or replace in F3 when CockpitHero consumes it directly.
 */
import { useEffect } from "react";
import { useOrchestrator } from "@/hooks/useOrchestrator";

export default function OrchestratorShadowRunner() {
  const { data, isError } = useOrchestrator({ shadow: true });

  useEffect(() => {
    if (data?.recommendation) {
      // Lightweight observability — visible in browser console for QA
      // (logs are also persisted server-side in assistant_decisions)
      // eslint-disable-next-line no-console
      console.debug(
        "[orchestrator/shadow] next=%s prio=%d rules=%d",
        data.recommendation.nextAction,
        data.recommendation.priority,
        data.rulesTrace?.filter((r) => r.fired).length ?? 0,
      );
    }
    if (isError) {
      // eslint-disable-next-line no-console
      console.debug("[orchestrator/shadow] error — fallback in place");
    }
  }, [data, isError]);

  return null;
}
