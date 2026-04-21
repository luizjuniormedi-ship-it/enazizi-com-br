/**
 * useCoverageBoostTelemetry (Fase 1.7)
 * ─────────────────────────────────────
 * Hook leve que lê estatísticas agregadas da tabela `coverage_boost_events`
 * para o painel admin. Read-only. Tolerante a falhas.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoverageBoostTelemetryStats {
  total: number;
  clicked: number;
  executed: number;
  pctClicked: number;
  pctExecuted: number;
  byMethod: Array<{ method: string; count: number; pct: number }>;
  topByVolume: Array<{ subtopic: string; specialty: string; total: number; executed: number }>;
  topByConversion: Array<{ subtopic: string; specialty: string; total: number; executed: number; conversion: number }>;
  recent7Days: Array<{ day: string; count: number }>;
}

const EMPTY: CoverageBoostTelemetryStats = {
  total: 0, clicked: 0, executed: 0, pctClicked: 0, pctExecuted: 0,
  byMethod: [], topByVolume: [], topByConversion: [], recent7Days: [],
};

export function useCoverageBoostTelemetry() {
  return useQuery<CoverageBoostTelemetryStats>({
    queryKey: ["coverage-boost-telemetry"],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("coverage_boost_events" as any)
          .select("subtopic, specialty, coverage_boost_match_method, clicked, executed, created_at")
          .gte("created_at", since)
          .limit(5000);
        if (error) {
          console.warn("[useCoverageBoostTelemetry]", error.message);
          return EMPTY;
        }
        const rows = (data ?? []) as Array<{
          subtopic: string | null;
          specialty: string | null;
          coverage_boost_match_method: string | null;
          clicked: boolean;
          executed: boolean;
          created_at: string;
        }>;
        const total = rows.length;
        if (total === 0) return EMPTY;

        const clicked = rows.filter((r) => r.clicked).length;
        const executed = rows.filter((r) => r.executed).length;

        const methodMap = new Map<string, number>();
        for (const r of rows) {
          const m = r.coverage_boost_match_method ?? "unknown";
          methodMap.set(m, (methodMap.get(m) ?? 0) + 1);
        }
        const byMethod = Array.from(methodMap.entries())
          .map(([method, count]) => ({ method, count, pct: Math.round((count / total) * 1000) / 10 }))
          .sort((a, b) => b.count - a.count);

        // Agrupamento por subtopic
        const subMap = new Map<string, { specialty: string; total: number; executed: number }>();
        for (const r of rows) {
          const key = (r.subtopic ?? "(sem subtopic)").trim();
          const cur = subMap.get(key) ?? { specialty: r.specialty ?? "—", total: 0, executed: 0 };
          cur.total++;
          if (r.executed) cur.executed++;
          subMap.set(key, cur);
        }
        const grouped = Array.from(subMap.entries()).map(([subtopic, v]) => ({
          subtopic, specialty: v.specialty, total: v.total, executed: v.executed,
          conversion: v.total > 0 ? Math.round((v.executed / v.total) * 1000) / 10 : 0,
        }));
        const topByVolume = [...grouped].sort((a, b) => b.total - a.total).slice(0, 12);
        const topByConversion = grouped
          .filter((g) => g.total >= 3)
          .sort((a, b) => b.conversion - a.conversion)
          .slice(0, 12);

        // Últimos 7 dias
        const dayMap = new Map<string, number>();
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const k = d.toISOString().slice(0, 10);
          dayMap.set(k, 0);
        }
        for (const r of rows) {
          const k = r.created_at.slice(0, 10);
          if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
        }
        const recent7Days = Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }));

        return {
          total,
          clicked,
          executed,
          pctClicked: Math.round((clicked / total) * 1000) / 10,
          pctExecuted: Math.round((executed / total) * 1000) / 10,
          byMethod,
          topByVolume,
          topByConversion,
          recent7Days,
        };
      } catch (e) {
        console.warn("[useCoverageBoostTelemetry] unexpected:", e);
        return EMPTY;
      }
    },
  });
}
