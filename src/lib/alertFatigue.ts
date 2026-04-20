/**
 * alertFatigue — heurística de fadiga por alerta
 * ───────────────────────────────────────────────
 * Helper puro (não-React) que mede, para uma janela de eventos:
 *   - impressions, clicks, dismissals, suppressed, resolved
 *   - ctr, dismissRate, resolutionRate, suppressionRate
 *   - fatigueScore (0–100) — sinal de cansaço/ineficácia
 *   - shouldDownrank — flag conservadora (apenas leitura nesta fase)
 *
 * Esta fase NÃO altera prioridade automaticamente. O orchestrator continua
 * decidindo por regra fixa. O dashboard admin usa esses dados para sinalizar.
 */
import type { AlertEventRow } from "@/hooks/useAlertAnalytics";
import type { AlertPriority, AlertLayer } from "@/types/alertOrchestrator";

export interface FatigueMeasure {
  source: string;
  dedupeKey: string | null;
  impressions: number;
  clicks: number;
  dismissals: number;
  suppressed: number;
  resolved: number;
  ctr: number;
  dismissRate: number;
  resolutionRate: number;
  suppressionRate: number;
  fatigueScore: number;
  shouldDownrank: boolean;
  dominantPriority: AlertPriority | null;
  dominantLayer: AlertLayer | null;
}

/**
 * Calcula fatigueScore (0–100). Heurística conservadora:
 *   - >=20 impressions com CTR < 5%   → +50
 *   - >=10 impressions com CTR < 10%  → +30
 *   - >=5  impressions com CTR < 15%  → +15
 *   - dismissRate >= 60%              → +30
 *   - dismissRate >= 40%              → +15
 *   - suppressionRate >= 50%          → +20
 *   - suppressionRate >= 30%          → +10
 *   - resolutionRate >= 30% reduz 20 (alerta cumpre função)
 */
export function computeFatigue(input: {
  impressions: number;
  clicks: number;
  dismissals: number;
  suppressed: number;
  resolved: number;
}): number {
  const { impressions, clicks, dismissals, suppressed, resolved } = input;
  if (impressions < 5 && suppressed < 5) return 0;

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const dismissRate = impressions > 0 ? dismissals / impressions : 0;
  const resolutionRate = impressions > 0 ? resolved / impressions : 0;
  const suppressionRate =
    impressions + suppressed > 0
      ? suppressed / (impressions + suppressed)
      : 0;

  let score = 0;
  if (impressions >= 20 && ctr < 0.05) score += 50;
  else if (impressions >= 10 && ctr < 0.1) score += 30;
  else if (impressions >= 5 && ctr < 0.15) score += 15;

  if (dismissRate >= 0.6) score += 30;
  else if (dismissRate >= 0.4) score += 15;

  if (suppressionRate >= 0.5) score += 20;
  else if (suppressionRate >= 0.3) score += 10;

  // Alertas que se resolvem com frequência são úteis — reduz fadiga
  if (resolutionRate >= 0.3) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * Regra inicial de downrank (apenas indicativa, não aplicada pelo orchestrator):
 *   shown >= 3, clicks === 0, (dismissals >= 1 OR resolved === 0)
 */
export function shouldDownrankAlert(input: {
  impressions: number;
  clicks: number;
  dismissals: number;
  resolved: number;
}): boolean {
  const { impressions, clicks, dismissals, resolved } = input;
  if (impressions < 3) return false;
  if (clicks > 0) return false;
  return dismissals >= 1 || resolved === 0;
}

/**
 * Agrega eventos por (source, dedupeKey) e calcula medidas de fadiga.
 * Não envolve React — pode ser usado em testes e em hooks.
 */
export function buildFatigueMeasures(
  rows: ReadonlyArray<AlertEventRow>
): FatigueMeasure[] {
  const buckets = new Map<string, AlertEventRow[]>();
  for (const r of rows) {
    const key = `${r.source}::${r.dedupe_key ?? ""}`;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }

  const out: FatigueMeasure[] = [];
  for (const [key, list] of buckets) {
    const [source, dedupeKeyRaw] = key.split("::");
    const dedupeKey = dedupeKeyRaw === "" ? null : dedupeKeyRaw;

    const impressions = list.filter((r) => r.event_type === "exposed").length;
    const clicks = list.filter((r) => r.event_type === "clicked").length;
    const dismissals = list.filter((r) => r.event_type === "dismissed").length;
    const suppressed = list.filter((r) => r.event_type === "suppressed").length;
    const resolved = list.filter((r) => r.event_type === "resolved").length;

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const dismissRate = impressions > 0 ? dismissals / impressions : 0;
    const resolutionRate = impressions > 0 ? resolved / impressions : 0;
    const suppressionRate =
      impressions + suppressed > 0
        ? suppressed / (impressions + suppressed)
        : 0;

    // Prioridade/camada mais frequentes
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

    const fatigueScore = computeFatigue({
      impressions,
      clicks,
      dismissals,
      suppressed,
      resolved,
    });
    const shouldDownrank = shouldDownrankAlert({
      impressions,
      clicks,
      dismissals,
      resolved,
    });

    out.push({
      source,
      dedupeKey,
      impressions,
      clicks,
      dismissals,
      suppressed,
      resolved,
      ctr,
      dismissRate,
      resolutionRate,
      suppressionRate,
      fatigueScore,
      shouldDownrank,
      dominantPriority,
      dominantLayer,
    });
  }

  out.sort((a, b) => b.impressions - a.impressions);
  return out;
}
