/**
 * useClassAnalytics
 * Fetcher único para class_analytics — usado por OperationalKpiBar,
 * TopRiskStudents e ClassCognitiveHeatmap (evita queries duplicadas).
 */
import { useCallback, useEffect, useState } from "react";

interface State {
  data: any | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useClassAnalytics(callAPI: (b: Record<string, unknown>) => Promise<any>): State {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    callAPI({ action: "class_analytics" })
      .then((res) => {
        if (cancelled) return;
        setData(res || null);
        setError(null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || "Erro ao carregar analytics");
        setData(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [callAPI, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload };
}
