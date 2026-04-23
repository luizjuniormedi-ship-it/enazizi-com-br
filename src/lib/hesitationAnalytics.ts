/**
 * Sprint 5 — Hesitation Analytics (admin reader)
 *
 * Helpers de leitura para as 5 views analíticas criadas na Sprint 5.
 * Apenas admins conseguem ler (RLS na tabela base + policy "Admins can read all telemetry").
 *
 * Filosofia: read-only, sem UI. Pensado para console admin / scripts /
 * futura página de auditoria interna. Zero acoplamento com componentes do aluno.
 */
import { supabase } from "@/integrations/supabase/client";

export interface HesitationByRoute {
  route: string;
  viewport: "mobile" | "desktop";
  sessions: number;
  avg_seconds_to_action: number;
  median_seconds_to_action: number;
  avg_clicks_before: number;
  avg_route_changes_before: number;
  since: string;
}

export interface HesitationByEntryPoint {
  entry_point: string;
  viewport: "mobile" | "desktop";
  sessions: number;
  avg_seconds_to_action: number;
  median_seconds_to_action: number;
  avg_clicks_before: number;
  avg_route_changes_before: number;
}

export interface AbandonedSession {
  user_id: string;
  entry_route: string | null;
  viewport: "mobile" | "desktop" | null;
  started_at: string;
  day: string;
}

export interface NavigationLoop {
  user_id: string;
  final_route: string | null;
  entry_point: string | null;
  viewport: "mobile" | "desktop" | null;
  pre_action_route_changes: number;
  pre_action_clicks: number;
  seconds_to_action: number;
  day: string;
  created_at: string;
}

export interface RouteEfficiency {
  route: string;
  entry_point: string;
  sessions: number;
  median_seconds: number;
  avg_clicks: number;
  avg_route_changes: number;
  /** Quanto MENOR, mais eficiente. = sec + clicks*2 + routes*5 */
  friction_score: number;
}

async function readView<T>(view: string, limit = 100): Promise<T[]> {
  const { data, error } = await supabase
    .from(view as any)
    .select("*")
    .limit(limit);
  if (error) {
    console.warn(`[HesitationAnalytics] ${view} failed:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

export const hesitationAnalytics = {
  byRoute: () => readView<HesitationByRoute>("v_hesitation_by_route"),
  byEntryPoint: () => readView<HesitationByEntryPoint>("v_hesitation_by_entry_point"),
  abandoned: (limit = 200) => readView<AbandonedSession>("v_abandoned_sessions", limit),
  loops: (limit = 100) => readView<NavigationLoop>("v_navigation_loops", limit),
  efficiency: () => readView<RouteEfficiency>("v_route_efficiency_ranking"),
};
