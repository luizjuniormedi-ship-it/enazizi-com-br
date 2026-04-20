import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { resolveRecommendationAction } from "@/lib/recommendationRouter";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { usePrefetch } from "@/hooks/usePrefetch";
import { useCoreData } from "@/hooks/useCoreData";
import { useStudyLoop } from "@/hooks/useStudyLoop";
import { useStudySession } from "@/hooks/useStudySession";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { useDashboardMnemonic } from "@/hooks/useDashboardMnemonic";
import { supabase } from "@/integrations/supabase/client";

import MissionHeroAnimated from "@/components/dashboard-v2/MissionHeroAnimated";
import RecoveryModeBanner from "@/components/dashboard/RecoveryModeBanner";
import TutorContinueCard from "@/components/dashboard/TutorContinueCard";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import ProgressOverview from "@/components/dashboard/ProgressOverview";
import AdvancedAnalyticsAccordion from "@/components/dashboard/AdvancedAnalyticsAccordion";
import GuidedFlowLayer from "@/components/dashboard/GuidedFlowLayer";

import MissionCompletionBanner from "@/components/mission-control/MissionCompletionBanner";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";
import MissionControlError from "@/components/mission-control/MissionControlError";
import MissionControlEmpty from "@/components/mission-control/MissionControlEmpty";
import StudyLoopContainer from "@/components/study-loop/StudyLoopContainer";
import SessionBar from "@/components/study-session/SessionBar";
import SessionSummary from "@/components/study-session/SessionSummary";
import SafeCard from "@/components/layout/SafeCard";
import { useFocusMode } from "@/components/dashboard/guided/FocusModeEntry";
import { AdaptiveMnemonicCard } from "@/components/mnemonic/AdaptiveMnemonicCard";
import AchievementToast from "@/components/gamification/AchievementToast";

import { fireCelebration } from "@/lib/celebrations";

const OnboardingChecklist = lazy(() => import("@/components/dashboard/OnboardingChecklist"));

interface CompletionHandoff {
  completedTitle: string;
  badges?: string[];
}

/* ═══════════════════════════════════════════════════
   DASHBOARD — Cockpit do Aluno (versão linear, 8 blocos)
   Ordem:
     1. TopBar fixa
     2. Hero único (missão atual)
     3. Guided Flow (alertas + 3 ações)
     4. Progresso unificado
     5. Tutor (continuar)
     6. Análises avançadas (accordion fechado)
   ═══════════════════════════════════════════════════ */
const Dashboard = () => {
  useRevisionNotifier();
  usePrefetch("/dashboard");
  const [focusMode] = useFocusMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: dashboardMnemonic } = useDashboardMnemonic();

  const { data, isLoading: missionLoading, isError, error, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();
  const loop = useStudyLoop();
  const session = useStudySession();

  const [overrideRec, setOverrideRec] = useState<StudyNextRecommendation | null>(null);
  const [handoff, setHandoff] = useState<CompletionHandoff | null>(null);
  const [dismissedMnemonicId, setDismissedMnemonicId] = useState<string | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const autostartConsumedRef = useRef(false);

  const activeRec = overrideRec ?? data?.recommendation;
  const justification = data?.justification ?? "";
  const alternatives = data?.alternativeActions ?? [];
  const adaptiveState = data?.adaptiveState;

  const loopActive = loop.phase !== "idle";

  useEffect(() => {
    setDismissedMnemonicId(null);
  }, [dashboardMnemonic?.link.id]);

  const visibleDashboardMnemonic =
    dashboardMnemonic && dashboardMnemonic.link.id !== dismissedMnemonicId
      ? dashboardMnemonic
      : null;

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

  // Fresh login cleanup
  useEffect(() => {
    localStorage.removeItem("enazizi_last_login_ts");
  }, []);

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
    <div className="space-y-4 max-w-4xl mx-auto pb-20 lg:pb-0">
      {/* Session Bar (durante sessão ativa) */}
      <SessionBar metrics={session.metrics} onEnd={handleEndSession} />

      {/* Achievement toasts (overlay invisível até disparar) */}
      <SafeCard name="AchievementToast"><AchievementToast /></SafeCard>

      {/* ═══ INLINE STUDY LOOP — toma a tela quando ativo ═══ */}
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

      {/* ═══ DASHBOARD LINEAR (fora do loop e fora do focus mode) ═══ */}
      {!loopActive && !focusMode && (
        <>
          {/* 1 — TopBar fixa (saudação + status) */}
          <SafeCard name="DashboardTopBar"><DashboardTopBar /></SafeCard>

          {/* Recovery banner sempre que ativo */}
          <RecoveryModeBanner />

          {/* Onboarding inline para usuários totalmente novos */}
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

          {/* Erro / vazio */}
          {isError && <MissionControlError error={error} onRetry={handleRefresh} />}
          {!isError && !activeRec && <MissionControlEmpty onGenerate={handleRefresh} />}

          {/* Banner de missão concluída */}
          {handoff && (
            <MissionCompletionBanner
              completedTitle={handoff.completedTitle}
              badges={handoff.badges}
              onDismiss={dismissBanner}
            />
          )}

          {/* 2 — HERO ÚNICO (missão atual) */}
          {activeRec && (
            <SafeCard name="MissionHero">
              <MissionHeroAnimated
                recommendation={activeRec}
                adaptiveState={adaptiveState}
                onStart={handleStart}
                onRefresh={handleRefresh}
                onShowAlternatives={() => {
                  document.getElementById("advanced-analytics")?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            </SafeCard>
          )}

          {/* 3 — GUIDED FLOW: alertas + 3 ações */}
          <SafeCard name="GuidedFlowLayer">
            <GuidedFlowLayer />
          </SafeCard>

          {/* Mnemônico adaptativo (condicional) */}
          {visibleDashboardMnemonic && (
            <SafeCard name="DashboardMnemonic">
              <AdaptiveMnemonicCard
                mnemonic={visibleDashboardMnemonic}
                onDismiss={() => setDismissedMnemonicId(visibleDashboardMnemonic.link.id)}
              />
            </SafeCard>
          )}

          {/* 4 — PROGRESSO UNIFICADO */}
          <SafeCard name="ProgressOverview"><ProgressOverview /></SafeCard>

          {/* 5 — TUTOR (continuar) */}
          <SafeCard name="TutorContinueCard"><TutorContinueCard /></SafeCard>

          {/* 6 — ANÁLISES AVANÇADAS (accordion fechado) */}
          <div id="advanced-analytics">
            <SafeCard name="AdvancedAnalytics">
              <AdvancedAnalyticsAccordion
                showMissionDetails={!!activeRec}
                justification={justification}
                adaptiveState={adaptiveState}
                alternatives={alternatives}
                activeRecType={activeRec?.type}
                onSelectAlternative={handleSelectAlternative}
              />
            </SafeCard>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
