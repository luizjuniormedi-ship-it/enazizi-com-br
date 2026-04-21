import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import { useFeatureFlags } from "./useFeatureFlags";
import { setFsrsEnabled } from "@/lib/fsrsAutoCreate";
import { generateRecommendations, type StudyRecommendation, type EngineResult, type AdaptiveState } from "@/lib/studyEngine";

export type { StudyRecommendation, AdaptiveState };

export const useStudyEngine = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const { isEnabled } = useFeatureFlags();
  const recoveryEnabled = isEnabled("new_recovery_enabled");
  const fsrsEnabled = isEnabled("new_fsrs_flow_enabled");
  const coveragePriorityBoostEnabled = isEnabled("coverage_priority_boost_enabled");

  // Sync module-level FSRS toggle so fire-and-forget calls respect the flag
  useEffect(() => { setFsrsEnabled(fsrsEnabled); }, [fsrsEnabled]);
  const query = useQuery({
    queryKey: ["study-engine", user?.id, !!coreData, recoveryEnabled, fsrsEnabled, coveragePriorityBoostEnabled],
    queryFn: () => generateRecommendations({
      userId: user!.id,
      coreData: coreData || undefined,
      recoveryEnabled,
      fsrsEnabled,
      coveragePriorityBoostEnabled,
    }),
    enabled: !!user && !!coreData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Unwrap EngineResult so consumers get the same array API
  const engineResult = query.data;
  const recommendations = engineResult?.recommendations;
  const adaptive = engineResult?.adaptive;

  return {
    ...query,
    /** The recommendation list (backward-compatible with old `data`) */
    data: recommendations,
    /** Full adaptive state */
    adaptive,
  };
};
