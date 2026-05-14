import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Feature flags centralizadas do ENAZIZI.
 * Cache de 2 min, fallback seguro se query falhar.
 */

export type FlagKey =
  | "new_planner_enabled"
  | "new_tutor_flow_enabled"
  | "new_dashboard_snapshot_enabled"
  | "new_recovery_enabled"
  | "new_fsrs_flow_enabled"
  | "new_chance_by_exam_enabled"
  | "mission_entry_enabled"
  | "image_questions_enabled"
  | "mission_control_enabled"
  | "study_loop_enabled"
  | "product_metrics_enabled"
  // Tutor V2 — Sprint 1 (todas opt-in, default false)
  | "tutor_v2_enabled"
  | "tutor_blocks_enabled"
  | "tutor_adaptive_context_enabled"
  | "tutor_adaptive_writeback_enabled"
  // Radar de Trajetória IA — Sprint 1 (todas opt-in, default false)
  | "radar_trajetoria_enabled"
  | "trajectory_engine_v1_enabled"
  | "trajectory_apply_v1_enabled"
  | "trajectory_explain_v1_enabled"
  // Alert Orchestrator — Fase 5 (Adaptive Ranking)
  | "alert_adaptive_ranking_enabled"
  // Intervention Engine V2 — Adaptive Ranking
  | "intervention_engine_v2_enabled"
  // Intervention Engine Fase 5 — Memória de Intervenção (Penalty)
  | "intervention_penalty_memory_enabled"
  // Intervention Engine Fase 6 — Personalização por Perfil do Aluno
  | "intervention_profile_personalization_enabled"
  // Coverage → Study Engine Bridge (Fase 1.4)
  | "coverage_priority_boost_enabled"
  // Sprint 4 — Gerador granular de simulados (opt-in, default false)
  | "granular_generator_enabled"
  // Fase 3A — Shadow Adaptive Layer (todas OFF em prod, observacional)
  | "shadow_adaptive_enabled"
  | "unified_events_enabled"
  | "shadow_decisions_enabled"
  | "shadow_scores_enabled"
  // Adaptive Video Library — FASE 1+ (todas OFF por padrão, rollout admins_only)
  | "adaptive_video_enabled"
  | "smart_replay_enabled"
  | "tutor_temporal_enabled"
  | "multimodal_analytics_enabled"
  // Adaptive Video Library — FASE 3 Adaptive Intelligence
  | "adaptive_decisions_enabled"
  | "preventive_tutor_enabled"
  // CME Integration Flags
  | "cme_enabled"
  | "tutor_cme_enabled"
  | "cinematic_factory_enabled";

export interface SystemFlag {
  flag_key: string;
  enabled: boolean;
  description: string | null;
  category: string | null;
  rollout_mode: string;
  updated_at: string;
  updated_by: string | null;
}

// Defaults seguros — priorizam estabilidade (fluxo novo ligado, pois já é estável)
const SAFE_DEFAULTS: Record<FlagKey, boolean> = {
  new_planner_enabled: true,
  new_tutor_flow_enabled: true,
  new_dashboard_snapshot_enabled: true,
  new_recovery_enabled: true,
  new_fsrs_flow_enabled: true,
  new_chance_by_exam_enabled: true,
  mission_entry_enabled: false,
  image_questions_enabled: false,
  mission_control_enabled: false,
  study_loop_enabled: false,
  product_metrics_enabled: true,
  // Tutor V2 — defaults seguros: tudo desligado até cada sprint validar
  tutor_v2_enabled: false,
  tutor_blocks_enabled: false,
  tutor_adaptive_context_enabled: false,
  tutor_adaptive_writeback_enabled: false,
  // Radar de Trajetória IA — ESTÁVEL (produção interna habilitada).
  // Defaults aqui devem espelhar `system_flags` no banco. Atualizado na Sprint de Correção.
  radar_trajetoria_enabled: true,
  trajectory_engine_v1_enabled: true,
  trajectory_apply_v1_enabled: true,
  trajectory_explain_v1_enabled: true,
  // Alert Orchestrator Fase 5 — adaptive ranking opt-in (default false até validação)
  alert_adaptive_ranking_enabled: false,
  // Intervention Engine V2 — adaptive ranking ON por padrão (fallback seguro embutido)
  intervention_engine_v2_enabled: true,
  // Intervention Engine Fase 5 — Penalty Memory ON por padrão (fallback seguro embutido)
  intervention_penalty_memory_enabled: true,
  // Intervention Engine Fase 6 — Personalização por Perfil ON por padrão (fallback seguro embutido)
  intervention_profile_personalization_enabled: true,
  // Coverage → Study Engine Bridge — ON por padrão, fallback total embutido
  coverage_priority_boost_enabled: true,
  // Sprint 4 — Gerador granular: OFF por padrão (segurança máxima)
  granular_generator_enabled: false,
  // Fase 3A — Shadow Adaptive Layer: TODAS OFF por padrão. Não muda jornada.
  shadow_adaptive_enabled: false,
  unified_events_enabled: false,
  shadow_decisions_enabled: false,
  shadow_scores_enabled: false,
  // Adaptive Video Library — OFF por padrão (rollout admins_only no banco)
  adaptive_video_enabled: false,
  smart_replay_enabled: false,
  tutor_temporal_enabled: false,
  multimodal_analytics_enabled: false,
  adaptive_decisions_enabled: false,
  preventive_tutor_enabled: false,
  cme_enabled: true,
  tutor_cme_enabled: true,
  cinematic_factory_enabled: true,
};

export const useFeatureFlags = () => {
  const { user } = useAuth();

  const { data: flags, isLoading } = useQuery({
    queryKey: ["system-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_flags")
        .select("flag_key, enabled, description, category, rollout_mode, updated_at, updated_by");
      if (error) {
        console.warn("[FeatureFlags] Falha ao carregar, usando defaults:", error.message);
        return null;
      }
      return data as SystemFlag[];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 min cache
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });

  const isEnabled = (key: FlagKey): boolean => {
    if (!flags) return SAFE_DEFAULTS[key] ?? true;
    const flag = flags.find((f) => f.flag_key === key);
    if (!flag) return SAFE_DEFAULTS[key] ?? true;
    return flag.enabled;
  };

  return {
    flags: flags ?? [],
    loading: isLoading,
    isEnabled,
  };
};

/** Invalidar cache de flags após mudança no admin */
export const useInvalidateFlags = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["system-flags"] });
};
