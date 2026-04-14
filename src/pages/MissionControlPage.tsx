import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useCoreData } from "@/hooks/useCoreData";
import MissionHeroCard from "@/components/mission-control/MissionHeroCard";
import MissionJustification from "@/components/mission-control/MissionJustification";
import MissionStudentState from "@/components/mission-control/MissionStudentState";
import MissionAlternatives from "@/components/mission-control/MissionAlternatives";
import MissionQuickActions from "@/components/mission-control/MissionQuickActions";
import MissionDayProgress from "@/components/mission-control/MissionDayProgress";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";
import MissionControlError from "@/components/mission-control/MissionControlError";
import MissionControlEmpty from "@/components/mission-control/MissionControlEmpty";

export default function MissionControlPage() {
  const { data, isLoading, isError, error, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();
  const { data: coreData } = useCoreData();
  const navigate = useNavigate();

  const [overrideRec, setOverrideRec] = useState<StudyNextRecommendation | null>(null);

  const activeRec = overrideRec ?? data?.recommendation;
  const justification = data?.justification ?? "";
  const alternatives = data?.alternativeActions ?? [];
  const adaptiveState = data?.adaptiveState;

  const streak = coreData?.gamification?.current_streak ?? snapshot?.streak ?? 0;

  const handleStart = useCallback(() => {
    if (!activeRec) return;
    const typeRoutes: Record<string, string> = {
      review: "/study/tutor",
      error_review: "/dashboard/banco-erros",
      daily_task: "/mission",
      free_study: "/dashboard/questoes",
    };
    const base = typeRoutes[activeRec.type] || "/dashboard";
    const params = new URLSearchParams({ sc_origin: "mission_control" });
    if (activeRec.targetId) params.set("sc_target_id", activeRec.targetId);
    navigate(`${base}?${params.toString()}`);
  }, [activeRec, navigate]);

  const handleSelectAlternative = useCallback((alt: StudyNextRecommendation) => {
    setOverrideRec(alt);
  }, []);

  const handleRefresh = useCallback(() => {
    setOverrideRec(null);
    refresh();
  }, [refresh]);

  if (isLoading || snapLoading) return <MissionControlSkeleton />;
  if (isError) return <MissionControlError error={error} onRetry={handleRefresh} />;
  if (!activeRec) return <MissionControlEmpty onGenerate={handleRefresh} />;

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Hero — main mission */}
      <MissionHeroCard
        recommendation={activeRec}
        adaptiveState={adaptiveState}
        onStart={handleStart}
        onRefresh={handleRefresh}
        onShowAlternatives={() => {
          document.getElementById("mc-alternatives")?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {/* Why this now? */}
      <MissionJustification justification={justification} adaptiveState={adaptiveState} />

      {/* Student state + Day progress side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MissionStudentState snapshot={snapshot} adaptiveState={adaptiveState} streak={streak} />
        <MissionDayProgress
          completed={snapshot?.todayCompleted ?? 0}
          total={snapshot?.todayTotal ?? 0}
          streak={streak}
        />
      </div>

      {/* Quick contextual actions */}
      <MissionQuickActions type={activeRec.type} />

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div id="mc-alternatives">
          <MissionAlternatives
            alternatives={alternatives}
            onSelect={handleSelectAlternative}
            activeType={activeRec.type}
          />
        </div>
      )}
    </div>
  );
}
