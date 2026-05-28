/**
 * Sprint 2.3 — Hardening Operacional
 *
 * Lista defensiva de user_ids excluídos de TODA métrica/dashboard oficial:
 * abandono, engajamento, completion, taxa de acerto, tempo médio, retention,
 * qualquer telemetria psicométrica.
 *
 * Dados originais NUNCA são deletados — apenas filtrados na leitura.
 * Fonte de verdade: tabela `public.analytics_excluded_users`.
 * Esta constante é um espelho cliente para filtros rápidos sem round-trip.
 */
export const ANALYTICS_EXCLUDED_USER_IDS: ReadonlySet<string> = new Set([
  // Bot de teste — 3.280 sessões, 0 finalizações (Sprint 2.3 diagnóstico)
  "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023",
]);

export function isAnalyticsExcluded(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return ANALYTICS_EXCLUDED_USER_IDS.has(userId);
}

/** Filtro genérico para arrays de telemetria com campo user_id. */
export function filterExcludedFromAnalytics<T extends { user_id?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !isAnalyticsExcluded(r.user_id ?? null));
}

/** Predicado para uso em queries `.not('user_id','in',...)` style. */
export const EXCLUDED_USER_IDS_ARRAY: readonly string[] = Array.from(ANALYTICS_EXCLUDED_USER_IDS);
