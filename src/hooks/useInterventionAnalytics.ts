/**
 * useInterventionAnalytics — métricas do Intervention Engine
 * ───────────────────────────────────────────────────────────
 * Lê `alert_events` (source = "intervention") e agrega por
 * `metadata.actionType`. Não cria tabelas, não escreve em lugar nenhum.
 *
 * Retorno:
 *   - byType: métricas por tipo de intervenção
 *   - global: KPIs globais (totais + best/worst performer)
 *   - isLoading / isError / refetch
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InterventionMetrics {
  type: string;
  exposed: number;
  clicked: number;
  resolved: number;
  ctr: number; // clicked / exposed
  conversionRate: number; // resolved / exposed
}

export interface InterventionGlobalKpis {
  totalExposed: number;
  totalClicked: number;
  totalResolved: number;
  globalCtr: number;
  globalConversion: number;
  bestByCtr: InterventionMetrics | null;
  worstByCtr: InterventionMetrics | null;
  bestByConversion: InterventionMetrics | null;
}

export interface InterventionAnalyticsResult {
  byType: InterventionMetrics[];
  global: InterventionGlobalKpis;
}

interface RawRow {
  event_type: string;
  metadata: unknown;
}

function safeRate(num: number, den: number): number {
  if (!den || den <= 0) return 0;
  const v = num / den;
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function extractActionType(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "unknown";
  const m = metadata as Record<string, unknown>;
  const at = m.actionType ?? (m as Record<string, unknown>).action_type;
  return typeof at === "string" && at.length > 0 ? at : "unknown";
}

async function fetchInterventionAnalytics(
  windowDays: number
): Promise<InterventionAnalyticsResult> {
  const sinceIso = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("alert_events")
    .select("event_type, metadata")
    .eq("source", "intervention")
    .gte("created_at", sinceIso)
    .limit(5000);

  if (error) throw error;

  const rows = (data ?? []) as RawRow[];

  // Agrega por actionType
  const buckets = new Map<
    string,
    { exposed: number; clicked: number; resolved: number }
  >();

  for (const r of rows) {
    const type = extractActionType(r.metadata);
    const b = buckets.get(type) ?? { exposed: 0, clicked: 0, resolved: 0 };
    if (r.event_type === "exposed") b.exposed++;
    else if (r.event_type === "clicked") b.clicked++;
    else if (r.event_type === "resolved") b.resolved++;
    buckets.set(type, b);
  }

  const byType: InterventionMetrics[] = Array.from(buckets.entries())
    .map(([type, v]) => ({
      type,
      exposed: v.exposed,
      clicked: v.clicked,
      resolved: v.resolved,
      ctr: safeRate(v.clicked, v.exposed),
      conversionRate: safeRate(v.resolved, v.exposed),
    }))
    .sort((a, b) => b.exposed - a.exposed);

  const totalExposed = byType.reduce((s, x) => s + x.exposed, 0);
  const totalClicked = byType.reduce((s, x) => s + x.clicked, 0);
  const totalResolved = byType.reduce((s, x) => s + x.resolved, 0);

  // Considera apenas tipos com amostra mínima para best/worst (>=5 exposições)
  const eligible = byType.filter((m) => m.exposed >= 5);
  const bestByCtr =
    eligible.length > 0
      ? eligible.reduce((a, b) => (b.ctr > a.ctr ? b : a))
      : null;
  const worstByCtr =
    eligible.length > 0
      ? eligible.reduce((a, b) => (b.ctr < a.ctr ? b : a))
      : null;
  const bestByConversion =
    eligible.length > 0
      ? eligible.reduce((a, b) =>
          b.conversionRate > a.conversionRate ? b : a
        )
      : null;

  return {
    byType,
    global: {
      totalExposed,
      totalClicked,
      totalResolved,
      globalCtr: safeRate(totalClicked, totalExposed),
      globalConversion: safeRate(totalResolved, totalExposed),
      bestByCtr,
      worstByCtr,
      bestByConversion,
    },
  };
}

export function useInterventionAnalytics(windowDays = 7) {
  return useQuery({
    queryKey: ["intervention-analytics", windowDays],
    queryFn: () => fetchInterventionAnalytics(windowDays),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
