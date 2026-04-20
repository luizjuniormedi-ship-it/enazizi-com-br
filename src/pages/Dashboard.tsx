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
import { useDashboardMnemonic } from "@/hooks/useDashboardMnemonic";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import MissionHeroAnimated from "@/components/dashboard-v2/MissionHeroAnimated";
import ApprovalScoreCard from "@/components/dashboard-v2/ApprovalScoreCard";
import FocusCard from "@/components/dashboard-v2/FocusCard";
import DailyProgressCard from "@/components/dashboard-v2/DailyProgressCard";
import ReadinessCard from "@/components/dashboard-v2/ReadinessCard";
import SmartAlerts, { type SmartAlert } from "@/components/dashboard-v2/SmartAlerts";
import WeeklyFocusPanel from "@/components/dashboard-v2/WeeklyFocusPanel";
import PerformanceEnergyPanel from "@/components/dashboard-v2/PerformanceEnergyPanel";
import QuickActionsPanel from "@/components/dashboard-v2/QuickActionsPanel";
import RadarTrajetoriaCard from "@/components/radar/RadarTrajetoriaCard";
import FsrsReviewCard from "@/components/dashboard/FsrsReviewCard";
import TutorContinueCard from "@/components/dashboard/TutorContinueCard";

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
import CognitiveCockpit from "@/components/cockpit/CognitiveCockpit";
import { AdaptiveMnemonicCard } from "@/components/mnemonic/AdaptiveMnemonicCard";
import XpWidget from "@/components/gamification/XpWidget";
import AchievementToast from "@/components/gamification/AchievementToast";

import { Badge } from "@/components/ui/badge";
import { fireCelebration } from "@/lib/celebrations";

const OnboardingChecklist = lazy(() => import("@/components/dashboard/OnboardingChecklist"));

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
   DASHBOARD — Cockpit do Aluno
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
  const { data: dashboardMnemonic } = useDashboardMnemonic();

  // Mission engine
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

  const streak = coreData?.gamification?.current_streak ?? snapshot?.streak ?? 0;
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

  // Fresh login: clean up timestamp (no longer redirects to /mission)
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
  const weakestArea = visualSkill?.weakestArea || (adaptiveState?.approvalZone === "critical" ? "Revisão geral" : "");
  const focusArea = visualSkill?.weakestArea || weakestArea;

  // Weekly questions estimate
  const questionsThisWeek = useMemo(() => {
    const attempts = coreData?.practiceAttempts || [];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return attempts.filter(a => new Date(a.created_at) >= weekAgo).length;
  }, [coreData?.practiceAttempts]);

  // Days active this week estimate
  const daysActiveThisWeek = useMemo(() => {
    const attempts = coreData?.practiceAttempts || [];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const days = new Set(
      attempts
        .filter(a => new Date(a.created_at) >= weekAgo)
        .map(a => a.created_at.slice(0, 10))
    );
    return days.size;
  }, [coreData?.practiceAttempts]);

  // Last simulado score
  const lastSimuladoScore = useMemo(() => {
    const exams = coreData?.examSessions || [];
    return exams.length > 0 ? Math.round(exams[0].score) : null;
  }, [coreData?.examSessions]);

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
    <div className="space-y-5 max-w-5xl mx-auto pb-20 lg:pb-0">
      {/* Session Bar */}
      <SessionBar metrics={session.metrics} onEnd={handleEndSession} />

      {/* Achievement toasts */}
      <SafeCard name="AchievementToast"><AchievementToast /></SafeCard>

      {/* ═══ COCKPIT COGNITIVO (novo, no topo) ═══ */}
      {!loopActive && (
        <SafeCard name="CognitiveCockpit">
          <CognitiveCockpit />
        </SafeCard>
      )}

      {!loopActive && visibleDashboardMnemonic && (
        <SafeCard name="DashboardMnemonic">
          <AdaptiveMnemonicCard
            mnemonic={visibleDashboardMnemonic}
            onDismiss={() => setDismissedMnemonicId(visibleDashboardMnemonic.link.id)}
          />
        </SafeCard>
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

      {/* ═══ COCKPIT ═══ */}
      {!loopActive && (
        <>
          {/* ── Greeting Bar ── */}
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

          {/* Completion banner */}
          {handoff && (
            <MissionCompletionBanner
              completedTitle={handoff.completedTitle}
              badges={handoff.badges}
              onDismiss={dismissBanner}
            />
          )}

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

          {/* ═══ BLOCO 1 — HERO MISSION ═══ */}
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

          {/* ═══ BLOCO 2 — Smart Alerts ═══ */}
          <SmartAlerts alerts={smartAlerts} />

          {/* ═══ BLOCO 2.1 — Conexões rápidas (Radar + Flashcards) ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {isEnabled("radar_trajetoria_enabled") && <RadarTrajetoriaCard />}
            <FsrsReviewCard />
          </div>

          {/* ═══ BLOCO 2.2 — Continuar Tutor (motor de conversão) ═══ */}
          <TutorContinueCard />

          {/* ═══ BLOCO 3 — STATUS GRID (4 cards) ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <ReadinessCard
              simuladosCompleted={dashData?.metrics.simuladosCompleted ?? 0}
              lastScore={lastSimuladoScore}
              accuracy={dashData?.metrics.accuracy ?? 0}
            />
          </div>

          {/* ═══ BLOCO 4 — FOCO + ENERGIA (2-col) ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeeklyFocusPanel
              weakestArea={focusArea}
              pendingReviews={snapshot?.pendingReviews ?? 0}
              errorsCount={dashData?.metrics.errorsCount ?? 0}
            />
            <PerformanceEnergyPanel
              streak={streak}
              studyMinutes={Math.round((dashData?.stats.totalStudyHours ?? 0) * 60)}
              pendingReviews={snapshot?.pendingReviews ?? 0}
              questionsThisWeek={questionsThisWeek}
              daysActiveThisWeek={daysActiveThisWeek}
            />
          </div>

          {/* ═══ BLOCO 5 — QUICK ACTIONS ═══ */}
          <QuickActionsPanel
            hasErrors={(dashData?.metrics.errorsCount ?? 0) > 0}
            hasPendingReviews={(snapshot?.pendingReviews ?? 0) > 0}
          />

          {/* ═══ BLOCO 5.1 — Radar (já renderizado em 2.1; aqui mantido como fallback se flag desabilitada na seção topo) ═══ */}
          {/* RadarTrajetoriaCard movido para BLOCO 2.1 para visibilidade */}

          {/* ═══ BLOCO 6 — Justification + Alternatives ═══ */}
          {activeRec && (
            <MissionJustification justification={justification} adaptiveState={adaptiveState} />
          )}

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
