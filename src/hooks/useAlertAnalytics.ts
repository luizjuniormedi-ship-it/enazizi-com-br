/**
 * useAlertAnalytics — agregações da tabela `alert_events`
 * ────────────────────────────────────────────────────────
 * Calcula métricas por `source` ao longo de uma janela (default 7d):
 *   - exposições
 *   - cliques
 *   - dismisses
 *   - supressões
 *   - CTR (clicked / exposed)
 *   - dismiss rate (dismissed / exposed)
 *   - suppression rate (suppressed / total)
 *   - sinal de fadiga (alert fatigue) — heurística
 *
 * Trata empty state e nulls. Limita janela para queries eficientes.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AlertPriority,
  AlertLayer,
} from "@/types/alertOrchestrator";

export interface AlertEventRow {
  id: string;
  user_id: string | null;
  alert_id: string;
  source: string;
  priority: AlertPriority;
  layer: AlertLayer;
  event_type: string;
  dedupe_key: string | null;
  suppressed_by: string | null;
  legacy_origin: string | null;
  via_bridge: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AlertSourceMetrics {
  source: string;
  exposed: number;
  clicked: number;
  dismissed: number;
  suppressed: number;
  ctr: number;            // clicked / exposed
  dismissRate: number;    // dismissed / exposed
  suppressionRate: number; // suppressed / (exposed + suppressed)
  fatigueScore: number;   // 0–100 (>=70 = sinal de fadiga)
  dominantPriority: AlertPriority | null;
  dominantLayer: AlertLayer | null;
  lastSeen: string | null;
}

export interface AlertAnalyticsSummary {
  windowDays: number;
  totalEvents: number;
  totalExposed: number;
  totalClicked: number;
  totalDismissed: number;
  totalSuppressed: number;
  globalCtr: number;
  fatigueAlerts: AlertSourceMetrics[]; // sources com fatigueScore >= 70
  bySource: AlertSourceMetrics[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Calcula um score 0–100 que estima fadiga do usuário com aquele alerta.
 * Heurística:
 *   - Alta exposição (>=20) com CTR baixo (<5%) → fadiga alta
 *   - Dismiss rate >= 60% → contribui
 *   - Suppression rate >= 50% → contribui (rebaixado pelo orchestrator)
 */
function computeFatigueScore(
  exposed: number,
  clicked: number,
  dismissed: number,
  suppressed: number
): number {
  if (exposed < 5 && suppressed < 5) return 0;

  const ctr = exposed > 0 ? clicked / exposed : 0;
  const dismissRate = exposed > 0 ? dismissed / exposed : 0;
  const suppressionRate =
    exposed + suppressed > 0 ? suppressed / (exposed + suppressed) : 0;

  let score = 0;
  // Alta exposição + CTR baixo
  if (exposed >= 20 && ctr < 0.05) score += 50;
  else if (exposed >= 10 && ctr < 0.1) score += 30;
  else if (exposed >= 5 && ctr < 0.15) score += 15;

  // Dismiss alto
  if (dismissRate >= 0.6) score += 30;
  else if (dismissRate >= 0.4) score += 15;

  // Supressão alta
  if (suppressionRate >= 0.5) score += 20;
  else if (suppressionRate >= 0.3) score += 10;

  return Math.min(100, score);
}

function aggregateBySource(rows: AlertEventRow[]): AlertSourceMetrics[] {
  const buckets = new Map<string, AlertEventRow[]>();
  for (const r of rows) {
    const arr = buckets.get(r.source) ?? [];
    arr.push(r);
    buckets.set(r.source, arr);
  }

  const out: AlertSourceMetrics[] = [];
  for (const [source, list] of buckets) {
    const exposed = list.filter((r) => r.event_type === "exposed").length;
    const clicked = list.filter((r) => r.event_type === "clicked").length;
    const dismissed = list.filter((r) => r.event_type === "dismissed").length;
    const suppressed = list.filter((r) => r.event_type === "suppressed").length;

    const ctr = exposed > 0 ? clicked / exposed : 0;
    const dismissRate = exposed > 0 ? dismissed / exposed : 0;
    const suppressionRate =
      exposed + suppressed > 0 ? suppressed / (exposed + suppressed) : 0;

    // Prioridade/camada dominantes (mais frequentes)
    const priorityCount = new Map<AlertPriority, number>();
    const layerCount = new Map<AlertLayer, number>();
    for (const r of list) {
      priorityCount.set(r.priority, (priorityCount.get(r.priority) ?? 0) + 1);
      layerCount.set(r.layer, (layerCount.get(r.layer) ?? 0) + 1);
    }
    const dominantPriority =
      [...priorityCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const dominantLayer =
      [...layerCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const lastSeen =
      list
        .map((r) => r.created_at)
        .sort()
        .reverse()[0] ?? null;

    out.push({
      source,
      exposed,
      clicked,
      dismissed,
      suppressed,
      ctr,
      dismissRate,
      suppressionRate,
      fatigueScore: computeFatigueScore(exposed, clicked, dismissed, suppressed),
      dominantPriority,
      dominantLayer,
      lastSeen,
    });
  }

  // Ordena por exposição desc
  out.sort((a, b) => b.exposed - a.exposed);
  return out;
}

export interface UseAlertAnalyticsOptions {
  /** Janela em dias (default 7). Cap em 90 para queries eficientes. */
  windowDays?: number;
  /** Se true, busca apenas eventos do usuário atual (default false = admin). */
  scopeToCurrentUser?: boolean;
}

export function useAlertAnalytics(
  opts: UseAlertAnalyticsOptions = {}
): AlertAnalyticsSummary {
  const windowDays = Math.min(Math.max(opts.windowDays ?? 7, 1), 90);
  const scopeToCurrentUser = opts.scopeToCurrentUser ?? false;

  const [rows, setRows] = useState<AlertEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - windowDays);

        let query = supabase
          .from("alert_events")
          .select(
            "id,user_id,alert_id,source,priority,layer,event_type,dedupe_key,suppressed_by,legacy_origin,via_bridge,metadata,created_at"
          )
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(5000);

        if (scopeToCurrentUser) {
          const { data: userData } = await supabase.auth.getUser();
          const uid = userData?.user?.id;
          if (uid) query = query.eq("user_id", uid);
        }

        const { data, error: qErr } = await query;
        if (cancelled) return;
        if (qErr) {
          setError(qErr.message);
          setRows([]);
        } else {
          setRows((data ?? []) as AlertEventRow[]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro desconhecido");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [windowDays, scopeToCurrentUser, refreshTick]);

  const bySource = aggregateBySource(rows);
  const totalExposed = bySource.reduce((s, m) => s + m.exposed, 0);
  const totalClicked = bySource.reduce((s, m) => s + m.clicked, 0);
  const totalDismissed = bySource.reduce((s, m) => s + m.dismissed, 0);
  const totalSuppressed = bySource.reduce((s, m) => s + m.suppressed, 0);
  const globalCtr = totalExposed > 0 ? totalClicked / totalExposed : 0;
  const fatigueAlerts = bySource.filter((m) => m.fatigueScore >= 70);

  return {
    windowDays,
    totalEvents: rows.length,
    totalExposed,
    totalClicked,
    totalDismissed,
    totalSuppressed,
    globalCtr,
    fatigueAlerts,
    bySource,
    loading,
    error,
    refresh,
  };
}
