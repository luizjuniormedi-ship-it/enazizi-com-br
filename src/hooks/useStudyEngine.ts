import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import { useFeatureFlags } from "./useFeatureFlags";
import { setFsrsEnabled } from "@/lib/fsrsAutoCreate";
import { generateRecommendations, type StudyRecommendation, type EngineResult, type AdaptiveState } from "@/lib/studyEngine";
import { logBoostEvents } from "@/lib/coverageBoostTelemetry";

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

  // Telemetria persistente Fase 1.7: grava eventos de boost de forma assíncrona,
  // sem bloquear o render. Dedup por sessão impede duplicatas em refetches.
  useEffect(() => {
    if (!user?.id || !recommendations || recommendations.length === 0) return;
    if (!coveragePriorityBoostEnabled) return;
    const boosted = recommendations.filter((r) => (r.coverageBoostApplied ?? 0) > 0);
    if (boosted.length === 0) return;
    void logBoostEvents(user.id, boosted);
  }, [user?.id, recommendations, coveragePriorityBoostEnabled]);

  return Object.assign(Object.create(query) as typeof query, {
    /** The recommendation list (backward-compatible with old `data`) */
    data: recommendations,
    /** Full adaptive state */
    adaptive,
  });
};
