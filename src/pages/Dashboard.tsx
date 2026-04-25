import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { usePrefetch } from "@/hooks/usePrefetch";
import { useCoreData } from "@/hooks/useCoreData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { useDashboardMnemonic } from "@/hooks/useDashboardMnemonic";
import { supabase } from "@/integrations/supabase/client";
import { useTelemetry } from "@/hooks/useTelemetry";

import CinematicMissionHero from "@/components/dashboard-v2/CinematicMissionHero";
import RecoveryModeBanner from "@/components/dashboard/RecoveryModeBanner";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";

import MissionCompletionBanner from "@/components/mission-control/MissionCompletionBanner";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";
import MissionControlError from "@/components/mission-control/MissionControlError";
import MissionControlEmpty from "@/components/mission-control/MissionControlEmpty";
import SafeCard from "@/components/layout/SafeCard";
import { useFocusMode } from "@/components/dashboard/guided/FocusModeEntry";
import AchievementToast from "@/components/gamification/AchievementToast";

import { fireCelebration } from "@/lib/celebrations";

// Lazy-load heavy / below-the-fold blocks to shrink the critical bundle.
const ProgressOverview = lazy(() => import("@/components/dashboard/ProgressOverview"));
const TutorContinueCard = lazy(() => import("@/components/dashboard/TutorContinueCard"));
const AdvancedAnalyticsAccordion = lazy(() => import("@/components/dashboard/AdvancedAnalyticsAccordion"));
const AdaptiveMnemonicCard = lazy(() =>
  import("@/components/mnemonic/AdaptiveMnemonicCard").then((m) => ({ default: m.AdaptiveMnemonicCard }))
);
const OnboardingChecklist = lazy(() => import("@/components/dashboard/OnboardingChecklist"));

interface CompletionHandoff {
  completedTitle: string;
  badges?: string[];
}

/* ═══════════════════════════════════════════════════
   HOJE — Panorama silencioso (entender, não executar)
   Função: orientar o aluno sobre o estado do dia.
   Execução vive em /dashboard/sessao-estudo (cockpit Estudar).
   Blocos:
     1. TopBar (saudação + status)
     2. Hero contextual (recomendação atual — CTA leva ao Estudar)
     3. Mnemônico adaptativo (condicional)
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
  const { trackAction } = useTelemetry();
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: dashboardMnemonic } = useDashboardMnemonic();

  const { data, isLoading: missionLoading, isError, error, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();

  const [overrideRec, setOverrideRec] = useState<StudyNextRecommendation | null>(null);
  const [handoff, setHandoff] = useState<CompletionHandoff | null>(null);
  const [dismissedMnemonicId, setDismissedMnemonicId] = useState<string | null>(null);
  const [advancedAccordion, setAdvancedAccordion] = useState<string>("");
  const prevLevelRef = useRef<number | null>(null);
  const autostartConsumedRef = useRef(false);

  const activeRec = overrideRec ?? data?.recommendation;
  const justification = data?.justification ?? "";
  const alternatives = data?.alternativeActions ?? [];
  const adaptiveState = data?.adaptiveState;

  useEffect(() => {
    setDismissedMnemonicId(null);
  }, [dashboardMnemonic?.link.id]);

  const visibleDashboardMnemonic =
    dashboardMnemonic && dashboardMnemonic.link.id !== dismissedMnemonicId
      ? dashboardMnemonic
      : null;

  // ─── AUTOSTART → redireciona para o cockpit Estudar (execução pertence lá) ───
  useEffect(() => {
    if (autostartConsumedRef.current) return;
    if (missionLoading || !data) return;
    const autostart = searchParams.get("autostart");
    if (autostart !== "true") return;

    trackAction('continuar_clicked', { source: 'autostart' });

    autostartConsumedRef.current = true;
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("autostart");
    newParams.delete("source");
    setSearchParams(newParams, { replace: true });

    // Redireciona para sessao-estudo (Fluxo: Hoje -> Continuar -> Sessão Ativa)
    navigate(`/dashboard/sessao-estudo?source=dashboard_autostart`);
  }, [missionLoading, data, searchParams, setSearchParams, navigate]);

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
  const handleSelectAlternative = useCallback((alt: StudyNextRecommendation) => {
    setOverrideRec(alt);
  }, []);

  const handleRefresh = useCallback(() => {
    setOverrideRec(null);
    refresh();
  }, [refresh]);

  const dismissBanner = useCallback(() => setHandoff(null), []);

  /* ─── Derived ─── */
  const isNewUser = dashData ? (dashData.metrics.questionsAnswered === 0 && dashData.stats.flashcards === 0) : false;

  // First load
  const initialLoading = (missionLoading && !data) || (snapLoading && !snapshot) || (dashLoading && !dashData);
  if (initialLoading) return <MissionControlSkeleton />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 lg:pb-6 px-4">
      {/* Achievement toasts (overlay invisível até disparar) */}
      <SafeCard name="AchievementToast"><AchievementToast /></SafeCard>

      {/* ═══ HOJE — panorama silencioso (entender, não executar) ═══ */}
      {!focusMode && (
        <>
          {/* 1 — Header Contextual (Status e Boas-vindas) */}
          <div className="space-y-4">
            <SafeCard name="DashboardTopBar"><DashboardTopBar /></SafeCard>
            
            {/* Recovery banner sempre que ativo */}
            <RecoveryModeBanner />
          </div>

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

          {/* 2 — HERO CONTEXTUAL (Ação Principal Recomendada) */}
          {activeRec && (
            <SafeCard name="MissionHero">
              <CinematicMissionHero
                recommendation={activeRec}
                adaptiveState={adaptiveState}
                onStart={() => {
                  trackAction('hero_cta_clicked', { rec_type: activeRec.type });
                  navigate(`/dashboard/sessao-estudo?source=dashboard_hero`);
                }}
                onRefresh={handleRefresh}
                onShowAlternatives={() => {
                  setAdvancedAccordion("advanced");
                  requestAnimationFrame(() => {
                    const el = document.getElementById("advanced-analytics");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              />
            </SafeCard>
          )}

          {/* 3 — CONTINUIDADE (Mnemônicos e Tutor) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mnemônico adaptativo (condicional) */}
            {visibleDashboardMnemonic && (
              <SafeCard name="DashboardMnemonic">
                <Suspense fallback={null}>
                  <AdaptiveMnemonicCard
                    mnemonic={visibleDashboardMnemonic}
                    onDismiss={() => setDismissedMnemonicId(visibleDashboardMnemonic.link.id)}
                  />
                </Suspense>
              </SafeCard>
            )}

            {/* TUTOR (continuar conversa anterior) */}
            <SafeCard name="TutorContinueCard">
              <Suspense fallback={null}>
                <TutorContinueCard />
              </Suspense>
            </SafeCard>
          </div>

          {/* 4 — PANORAMA DE MÉTRICAS (Estatísticas Unificadas) */}
          <SafeCard name="ProgressOverview">
            <Suspense fallback={null}>
              <ProgressOverview />
            </Suspense>
          </SafeCard>

          {/* 5 — ANÁLISES AVANÇADAS (Accordion técnico) */}
          <div id="advanced-analytics" className="pt-2">
            <SafeCard name="AdvancedAnalytics">
              <Suspense fallback={null}>
                <AdvancedAnalyticsAccordion
                  showMissionDetails={!!activeRec}
                  justification={justification}
                  adaptiveState={adaptiveState}
                  alternatives={alternatives}
                  activeRecType={activeRec?.type}
                  onSelectAlternative={handleSelectAlternative}
                  value={advancedAccordion}
                  onValueChange={setAdvancedAccordion}
                />
              </Suspense>
            </SafeCard>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
