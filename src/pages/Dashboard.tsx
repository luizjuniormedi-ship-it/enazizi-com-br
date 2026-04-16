import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { resolveRecommendationAction } from "@/lib/recommendationRouter";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { usePrefetch } from "@/hooks/usePrefetch";
import { useCoreData } from "@/hooks/useCoreData";
import { useStudyLoop } from "@/hooks/useStudyLoop";
import { useStudySession } from "@/hooks/useStudySession";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { useVisualSkill } from "@/hooks/useVisualSkill";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import MissionHeroAnimated from "@/components/dashboard-v2/MissionHeroAnimated";
import ApprovalScoreCard from "@/components/dashboard-v2/ApprovalScoreCard";
import FocusCard from "@/components/dashboard-v2/FocusCard";
import DailyProgressCard from "@/components/dashboard-v2/DailyProgressCard";
import SmartAlerts, { type SmartAlert } from "@/components/dashboard-v2/SmartAlerts";

import MissionJustification from "@/components/mission-control/MissionJustification";
import MissionAlternatives from "@/components/mission-control/MissionAlternatives";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";
import MissionControlError from "@/components/mission-control/MissionControlError";
import MissionControlEmpty from "@/components/mission-control/MissionControlEmpty";
import MissionCompletionBanner from "@/components/mission-control/MissionCompletionBanner";
import StudyLoopContainer from "@/components/study-loop/StudyLoopContainer";
import SessionBar from "@/components/study-session/SessionBar";
import SessionSummary from "@/components/study-session/SessionSummary";
import SafeCard from "@/components/layout/SafeCard";
import XpWidget from "@/components/gamification/XpWidget";
import AchievementToast from "@/components/gamification/AchievementToast";

import { Badge } from "@/components/ui/badge";
import { fireCelebration } from "@/lib/celebrations";

const OnboardingChecklist = lazy(() => import("@/components/dashboard/OnboardingChecklist"));
const WeeklySummaryCard = lazy(() => import("@/components/dashboard/WeeklySummaryCard"));
const PersonalGoalsCard = lazy(() => import("@/components/dashboard/PersonalGoalsCard"));

const EXAM_LABELS: Record<string, string> = {
  enare: "ENARE", revalida: "Revalida", usp: "USP", unicamp: "UNICAMP",
  unifesp: "UNIFESP", "sus-sp": "SUS-SP", "sus-rj": "SUS-RJ", amrigs: "AMRIGS",
  "ses-df": "SES-DF", "psu-mg": "PSU-MG", hcpa: "HCPA",
  "santa-casa-sp": "Santa Casa SP", einstein: "Einstein",
  "sirio-libanes": "Sírio-Libanês", outra: "Outra",
};

interface CompletionHandoff {
  completedTitle: string;
  badges?: string[];
}

/* ═══════════════════════════════════════════════════
   DASHBOARD v2 — Mission Control Premium
   ═══════════════════════════════════════════════════ */
const Dashboard = () => {
  useRevisionNotifier();
  usePrefetch("/dashboard");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const { data: coreData } = useCoreData();
  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: visualSkill } = useVisualSkill();

  // Mission engine
  const { data, isLoading: missionLoading, isError, error, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();
  const loop = useStudyLoop();
  const session = useStudySession();

  const [overrideRec, setOverrideRec] = useState<StudyNextRecommendation | null>(null);
  const [handoff, setHandoff] = useState<CompletionHandoff | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const autostartConsumedRef = useRef(false);

  const activeRec = overrideRec ?? data?.recommendation;
  const justification = data?.justification ?? "";
  const alternatives = data?.alternativeActions ?? [];
  const adaptiveState = data?.adaptiveState;

  const streak = coreData?.gamification?.current_streak ?? snapshot?.streak ?? 0;
  const loopActive = loop.phase !== "idle";

  // ─── AUTOSTART ───
  useEffect(() => {
    if (autostartConsumedRef.current) return;
    if (missionLoading || !data) return;
    const autostart = searchParams.get("autostart");
    if (autostart !== "true") return;
    if (!activeRec) return;

    autostartConsumedRef.current = true;
    const source = searchParams.get("source") || "manual";
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("autostart");
    newParams.delete("source");
    setSearchParams(newParams, { replace: true });

    if (!session.metrics.active) session.startSession(source);
    const action = resolveRecommendationAction(activeRec);
    if (action.mode === "navigate") navigate(action.path);
    else loop.startMission(activeRec);
  }, [missionLoading, data, activeRec, searchParams, setSearchParams, session, loop, navigate]);

  // Track loop results
  const prevPhaseRef = useRef(loop.phase);
  useEffect(() => {
    if (prevPhaseRef.current === "feedback" && loop.phase !== "feedback" && loop.result && session.metrics.active) {
      session.recordAction(loop.result.correct ?? false, loop.context?.theme);
    }
    prevPhaseRef.current = loop.phase;
  }, [loop.phase, loop.result, loop.context, session]);

  // Celebrations
  useEffect(() => {
    if (!dashData) return;
    if (prevLevelRef.current !== null && dashData.metrics.gamificationLevel > prevLevelRef.current) {
      fireCelebration("levelup");
    }
    prevLevelRef.current = dashData.metrics.gamificationLevel;
  }, [dashData]);

  // Fresh login redirect
  useEffect(() => {
    if (flagsLoading) return;
    if (!isEnabled("mission_entry_enabled")) return;
    const loginTs = localStorage.getItem("enazizi_last_login_ts");
    if (!loginTs) return;
    const elapsed = Date.now() - Number(loginTs);
    if (elapsed < 15_000) {
      localStorage.removeItem("enazizi_last_login_ts");
      navigate("/mission", { replace: true });
    }
  }, [flagsLoading, isEnabled, navigate]);

  // Realtime invalidation
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<string>();
    const debounced = (keys: string[][]) => {
      keys.forEach(k => pending.add(JSON.stringify(k)));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        pending.forEach(k => queryClient.invalidateQueries({ queryKey: JSON.parse(k) }));
        pending.clear();
      }, 1500);
    };
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_attempts', filter: `user_id=eq.${user.id}` }, () => debounced([["core-data"], ["dashboard-data"], ["study-next"]]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revisoes', filter: `user_id=eq.${user.id}` }, () => debounced([["core-data"], ["dashboard-data"]]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_gamification', filter: `user_id=eq.${user.id}` }, () => debounced([["core-data"], ["dashboard-data"]]))
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  /* ─── Handlers ─── */
  const handleStart = useCallback(() => {
    if (!activeRec) return;
    if (!session.metrics.active) session.startSession("manual");
    const action = resolveRecommendationAction(activeRec);
    if (action.mode === "navigate") navigate(action.path);
    else loop.startMission(activeRec);
  }, [activeRec, loop, session, navigate]);

  const handleSelectAlternative = useCallback((alt: StudyNextRecommendation) => {
    setOverrideRec(alt);
  }, []);

  const handleRefresh = useCallback(() => {
    setOverrideRec(null);
    refresh();
  }, [refresh]);

  const handleLoopClose = useCallback(() => {
    const wasComplete = loop.phase === "complete";
    const completedTitle = loop.context?.recommendation.title ?? "";
    const badges = loop.result?.completionBadges;
    loop.resetLoop();
    if (wasComplete) {
      setHandoff({ completedTitle, badges });
      setOverrideRec(null);
      refresh();
    }
  }, [loop, refresh]);

  const handleEndSession = useCallback(() => {
    if (loopActive) loop.resetLoop();
    session.endSession();
  }, [loopActive, loop, session]);

  const handleContinueAfterSummary = useCallback(() => {
    session.dismissSummary();
    session.startSession("continue");
    if (activeRec) loop.startMission(activeRec);
  }, [session, activeRec, loop]);

  const handleDismissSummary = useCallback(() => {
    session.dismissSummary();
  }, [session]);

  const dismissBanner = useCallback(() => setHandoff(null), []);

  /* ─── Derived ─── */
  const isNewUser = dashData ? (dashData.metrics.questionsAnswered === 0 && dashData.stats.flashcards === 0) : false;
  const displayName = dashData?.displayName?.split(" ")[0] || "Doutor(a)";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const targetExams = dashData?.targetExams || [];

  // Approval score trend
  const approvalTrend = useMemo(() => {
    const scores = coreData?.approvalScores || [];
    if (scores.length < 2) return "stable" as const;
    const recent = scores[0]?.score ?? 0;
    const older = scores[1]?.score ?? 0;
    if (recent - older > 3) return "up" as const;
    if (recent - older < -3) return "down" as const;
    return "stable" as const;
  }, [coreData?.approvalScores]);

  // Smart alerts
  const smartAlerts = useMemo(() => {
    const alerts: SmartAlert[] = [];
    if (visualSkill) {
      // Check weakest category trend
      const weakCat = visualSkill.categories.find(c => c.imageType === visualSkill.weakestArea);
      const strongCat = visualSkill.categories.find(c => c.imageType === visualSkill.strongestArea);
      if (weakCat?.trend === "declining" && visualSkill.weakestArea) {
        alerts.push({
          id: "visual-decline",
          type: "warning",
          message: `Seu desempenho em ${visualSkill.weakestArea.toUpperCase()} caiu nos últimos dias`,
        });
      }
      if (strongCat?.trend === "improving" && visualSkill.strongestArea) {
        alerts.push({
          id: "visual-improve",
          type: "success",
          message: `Você evoluiu em ${visualSkill.strongestArea.toUpperCase()} — continue assim!`,
        });
      }
    }
    if (snapshot && snapshot.pendingReviews > 10) {
      alerts.push({
        id: "pending-reviews",
        type: "warning",
        message: `${snapshot.pendingReviews} revisões acumuladas — priorize antes de avançar`,
      });
    }
    return alerts;
  }, [visualSkill, snapshot]);

  // Focus area
  const weakestArea = visualSkill?.weakestArea || adaptiveState?.approvalZone === "critical" ? "Revisão geral" : "";
  const focusArea = visualSkill?.weakestArea || weakestArea;

  // First load
  const initialLoading = (missionLoading && !data) || (snapLoading && !snapshot) || (dashLoading && !dashData);
  if (initialLoading) return <MissionControlSkeleton />;

  // Session Summary
  if (session.summary) {
    return (
      <div className="max-w-2xl mx-auto pt-8 px-3 animate-fade-in">
        <SessionSummary
          summary={session.summary}
          onContinue={handleContinueAfterSummary}
          onDismiss={handleDismissSummary}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      {/* Session Bar */}
      <SessionBar metrics={session.metrics} onEnd={handleEndSession} />

      {/* Achievement toasts */}
      <SafeCard name="AchievementToast"><AchievementToast /></SafeCard>

      {/* Greeting — hidden during loop */}
      {!loopActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-1"
        >
          <div>
            <p className="text-sm text-muted-foreground">
              {greeting}, <span className="text-foreground font-semibold">{displayName}</span>
            </p>
            {targetExams.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {targetExams.map((e: string) => (
                  <Badge key={e} variant="outline" className="text-[10px] px-1.5 py-0">
                    {EXAM_LABELS[e] || e}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <SafeCard name="XpWidget"><XpWidget /></SafeCard>
        </motion.div>
      )}

      {/* Completion banner */}
      {handoff && (
        <MissionCompletionBanner
          completedTitle={handoff.completedTitle}
          badges={handoff.badges}
          onDismiss={dismissBanner}
        />
      )}

      {/* ═══ INLINE STUDY LOOP ═══ */}
      {loopActive && (
        <StudyLoopContainer
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
          onRetry={loop.retry}
          onClose={handleLoopClose}
        />
      )}

      {/* ═══ MISSION HUB ═══ */}
      {!loopActive && (
        <>
          {/* Onboarding */}
          {isNewUser && dashData && (
            <Suspense fallback={null}>
              <SafeCard name="OnboardingNew">
                <OnboardingChecklist
                  stats={dashData.stats}
                  metrics={dashData.metrics}
                  hasCompletedDiagnostic={dashData.hasCompletedDiagnostic}
                />
              </SafeCard>
            </Suspense>
          )}

          {/* Error / Empty states */}
          {isError && <MissionControlError error={error} onRetry={handleRefresh} />}
          {!isError && !activeRec && <MissionControlEmpty onGenerate={handleRefresh} />}

          {/* HERO — Mission of the day */}
          {activeRec && (
            <MissionHeroAnimated
              recommendation={activeRec}
              adaptiveState={adaptiveState}
              onStart={handleStart}
              onRefresh={handleRefresh}
              onShowAlternatives={() => {
                document.getElementById("mc-alternatives")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          )}

          {/* Smart Alerts */}
          <SmartAlerts alerts={smartAlerts} />

          {/* 3-Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ApprovalScoreCard
              score={snapshot?.approvalScore ?? 0}
              trend={approvalTrend}
            />
            <FocusCard
              weakestArea={focusArea}
              weakestSubtopic={visualSkill?.weakestArea ? `Priorizar: ${visualSkill.weakestArea}` : undefined}
            />
            <DailyProgressCard
              questionsToday={dashData?.stats.questionsToday ?? 0}
              accuracyToday={dashData?.metrics.accuracy ?? 0}
              streak={streak}
              studyMinutes={Math.round((dashData?.stats.totalStudyHours ?? 0) * 60)}
            />
          </div>

          {/* Justification — compact */}
          {activeRec && (
            <MissionJustification justification={justification} adaptiveState={adaptiveState} />
          )}

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div id="mc-alternatives">
              <MissionAlternatives
                alternatives={alternatives.slice(0, 3)}
                onSelect={handleSelectAlternative}
                activeType={activeRec?.type || "free_study"}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
