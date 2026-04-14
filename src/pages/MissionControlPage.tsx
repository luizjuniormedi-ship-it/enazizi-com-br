import { useState, useCallback } from "react";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useCoreData } from "@/hooks/useCoreData";
import { useStudyLoop } from "@/hooks/useStudyLoop";
import MissionHeroCard from "@/components/mission-control/MissionHeroCard";
import MissionJustification from "@/components/mission-control/MissionJustification";
import MissionStudentState from "@/components/mission-control/MissionStudentState";
import MissionAlternatives from "@/components/mission-control/MissionAlternatives";
import MissionQuickActions from "@/components/mission-control/MissionQuickActions";
import MissionDayProgress from "@/components/mission-control/MissionDayProgress";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";
import MissionControlError from "@/components/mission-control/MissionControlError";
import MissionControlEmpty from "@/components/mission-control/MissionControlEmpty";
import StudyLoopPanel from "@/components/study-loop/StudyLoopPanel";

export default function MissionControlPage() {
  const { data, isLoading, isError, error, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();
  const { data: coreData } = useCoreData();

  const loop = useStudyLoop();

  const [overrideRec, setOverrideRec] = useState<StudyNextRecommendation | null>(null);

  const activeRec = overrideRec ?? data?.recommendation;
  const justification = data?.justification ?? "";
  const alternatives = data?.alternativeActions ?? [];
  const adaptiveState = data?.adaptiveState;

  const streak = coreData?.gamification?.current_streak ?? snapshot?.streak ?? 0;

  // Open loop instead of navigating away
  const handleStart = useCallback(() => {
    if (!activeRec) return;
    loop.startMission(activeRec);
  }, [activeRec, loop]);

  const handleSelectAlternative = useCallback((alt: StudyNextRecommendation) => {
    setOverrideRec(alt);
  }, []);

  const handleRefresh = useCallback(() => {
    setOverrideRec(null);
    refresh();
  }, [refresh]);

  const handleLoopClose = useCallback(() => {
    loop.resetLoop();
    // If loop completed, refresh mission data
    if (loop.phase === "complete") {
      handleRefresh();
    }
  }, [loop, handleRefresh]);

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

      {/* Study Loop Panel (bottom sheet) */}
      <StudyLoopPanel
        phase={loop.phase}
        context={loop.context}
        result={loop.result}
        loading={loop.loading}
        error={loop.error}
        onBeginExecution={loop.beginExecution}
        onSubmitAnswer={loop.submitAnswer}
        onCompleteReview={loop.completeReview}
        onContinue={loop.continueLoop}
        onQuickAction={loop.runQuickAction}
        onClose={handleLoopClose}
      />
    </div>
  );
}
