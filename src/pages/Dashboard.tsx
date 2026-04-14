import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { resolveRecommendationAction } from "@/lib/recommendationRouter";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useCoreData } from "@/hooks/useCoreData";
import { useStudyLoop } from "@/hooks/useStudyLoop";
import { useStudySession } from "@/hooks/useStudySession";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { supabase } from "@/integrations/supabase/client";

import MissionHeroCard from "@/components/mission-control/MissionHeroCard";
import MissionJustification from "@/components/mission-control/MissionJustification";
import MissionAlternatives from "@/components/mission-control/MissionAlternatives";
import MissionQuickActions from "@/components/mission-control/MissionQuickActions";
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
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Target, RotateCcw, TrendingUp } from "lucide-react";
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

/* ─── Compact Stats Strip ─── */
function StatsStrip({ approvalScore, pendingReviews, streak, todayCompleted, todayTotal }: {
  approvalScore: number; pendingReviews: number; streak: number; todayCompleted: number; todayTotal: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <MiniStat icon={<Target className="h-4 w-4 text-primary" />} label="Aprovação" value={`${approvalScore}%`} />
      <MiniStat icon={<RotateCcw className="h-4 w-4 text-primary" />} label="Revisões" value={String(pendingReviews)} highlight={pendingReviews > 5} />
      <MiniStat icon={<Flame className="h-4 w-4 text-primary" />} label="Streak" value={`${streak}d`} />
      <MiniStat icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Hoje" value={`${todayCompleted}/${todayTotal}`} />
    </div>
  );
}

function MiniStat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`border-border/50 ${highlight ? "border-destructive/30" : ""}`}>
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD — Unified Mission Hub
   ═══════════════════════════════════════════════════ */
const Dashboard = () => {
  useRevisionNotifier();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const { data: coreData } = useCoreData();
  const { data: dashData, isLoading: dashLoading } = useDashboardData();

  // Mission engine
  const { data, isLoading: missionLoading, isError, error, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();
  const loop = useStudyLoop();
  const session = useStudySession();

  const [overrideRec, setOverrideRec] = useState<StudyNextRecommendation | null>(null);
  const [handoff, setHandoff] = useState<CompletionHandoff | null>(null);
  const [heroHighlight, setHeroHighlight] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
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

    // Clean URL without triggering navigation
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("autostart");
    newParams.delete("source");
    setSearchParams(newParams, { replace: true });

    // Start session + route recommendation
    if (!session.metrics.active) {
      session.startSession(source);
    }

    const action = resolveRecommendationAction(activeRec);
    if (action.mode === "navigate") {
      navigate(action.path);
    } else {
      loop.startMission(activeRec);
    }
  }, [missionLoading, data, activeRec, searchParams, setSearchParams, session, loop, navigate]);

  // ─── Track loop results into session ───
  const prevPhaseRef = useRef(loop.phase);
  useEffect(() => {
    if (prevPhaseRef.current === "feedback" && loop.phase !== "feedback" && loop.result && session.metrics.active) {
      // Feedback phase just ended → record action
      const correct = loop.result.correct ?? false;
      const theme = loop.context?.theme;
      session.recordAction(correct, theme);
    }
    prevPhaseRef.current = loop.phase;
  }, [loop.phase, loop.result, loop.context, session]);

  // Celebrations
  useEffect(() => {
    if (!dashData) return;
    const { metrics } = dashData;
    if (prevLevelRef.current !== null && metrics.gamificationLevel > prevLevelRef.current) {
      fireCelebration("levelup");
    }
    prevLevelRef.current = metrics.gamificationLevel;
  }, [dashData]);

  // Redirect to MissionEntry on fresh login
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
    if (!session.metrics.active) {
      session.startSession("manual");
    }

    const action = resolveRecommendationAction(activeRec);
    if (action.mode === "navigate") {
      navigate(action.path);
    } else {
      loop.startMission(activeRec);
    }
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
      setHeroHighlight(true);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHeroHighlight(false), 2000);
      refresh();
    }
  }, [loop, refresh]);

  const handleEndSession = useCallback(() => {
    // If loop is active, close it first
    if (loopActive) {
      loop.resetLoop();
    }
    session.endSession();
  }, [loopActive, loop, session]);

  const handleContinueAfterSummary = useCallback(() => {
    session.dismissSummary();
    session.startSession("continue");
    if (activeRec) {
      loop.startMission(activeRec);
    }
  }, [session, activeRec, loop]);

  const handleDismissSummary = useCallback(() => {
    session.dismissSummary();
  }, [session]);

  const dismissBanner = useCallback(() => setHandoff(null), []);

  /* ─── Derived ─── */
  const isNewUser = dashData
    ? (dashData.metrics.questionsAnswered === 0 && dashData.stats.flashcards === 0)
    : false;
  const displayName = dashData?.displayName?.split(" ")[0] || "Doutor(a)";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const targetExams = dashData?.targetExams || [];

  // First load
  const initialLoading = (missionLoading && !data) || (snapLoading && !snapshot) || (dashLoading && !dashData);
  if (initialLoading) return <MissionControlSkeleton />;

  // ─── Session Summary ───
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
    <div className="space-y-4 animate-fade-in max-w-5xl mx-auto pb-20 lg:pb-0">
      {/* Session Bar — sticky top when session active */}
      <SessionBar metrics={session.metrics} onEnd={handleEndSession} />

      {/* Achievement toasts */}
      <SafeCard name="AchievementToast"><AchievementToast /></SafeCard>

      {/* Greeting — compact, hidden during loop */}
      {!loopActive && (
        <div className="flex items-center justify-between px-1">
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
        </div>
      )}

      {/* Completion banner */}
      {handoff && (
        <MissionCompletionBanner
          completedTitle={handoff.completedTitle}
          badges={handoff.badges}
          onDismiss={dismissBanner}
        />
      )}

      {/* ═══════════════════════════════════════════
          INLINE STUDY LOOP — full focus when active
         ═══════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════
          MISSION HUB — visible when NOT in loop
         ═══════════════════════════════════════════ */}
      {!loopActive && (
        <>
          {/* Onboarding for new users */}
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

          {/* HERO — "Sua missão agora" */}
          {activeRec && (
            <>
              <div
                className={`transition-all duration-700 ${
                  heroHighlight
                    ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-xl"
                    : "ring-0 ring-transparent"
                }`}
              >
                <MissionHeroCard
                  recommendation={activeRec}
                  adaptiveState={adaptiveState}
                  onStart={handleStart}
                  onRefresh={handleRefresh}
                  onShowAlternatives={() => {
                    document.getElementById("mc-alternatives")?.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </div>

              {/* Justification — compact */}
              <MissionJustification justification={justification} adaptiveState={adaptiveState} />
            </>
          )}

          {/* Stats strip */}
          {snapshot && (
            <StatsStrip
              approvalScore={snapshot.approvalScore}
              pendingReviews={snapshot.pendingReviews}
              streak={streak}
              todayCompleted={snapshot.todayCompleted}
              todayTotal={snapshot.todayTotal}
            />
          )}

          {/* Quick contextual actions */}
          {activeRec && <MissionQuickActions type={activeRec.type} />}

          {/* Alternatives — max 3 */}
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
