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
  | "product_metrics_enabled";

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
    staleTime: 2 * 60 * 1000, // 2 min cache
    gcTime: 5 * 60 * 1000,
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
