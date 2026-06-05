import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo, memo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStudyNext } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { useEnaflixUsage } from "@/hooks/useEnaflixUsage";
import { ENAFLIX_MODULES } from "@/data/enaflix/enaflixModules";
import { Rocket, Sparkles, Brain, Info, Play, Clock, Zap, Target, BookOpen, AlertCircle, RefreshCw, Activity, Timer, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixCinematicCard } from "@/components/enaflix/EnaflixCinematicCard";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";
import { EnaflixContinueCard } from "@/components/enaflix/EnaflixContinueCard";
import { EnaflixThemeCard } from "@/components/enaflix/EnaflixThemeCard";
import { EnaflixRecommendationCard } from "@/components/enaflix/EnaflixRecommendationRow";
import AchievementToast from "@/components/gamification/AchievementToast";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";
import { UnifiedMissionHero } from "@/components/dashboard/UnifiedMissionHero";
import { MascotAvatar } from "@/components/mascot/MascotAvatar";
import { MascotBubble } from "@/components/mascot/MascotBubble";
import { useMascotState } from "@/components/mascot/useMascotState";

const ProgressOverview = lazy(() => import("@/components/dashboard/ProgressOverview"));
const MedicalMasteryDashboard = lazy(() => import("@/components/MedicalMasteryDashboard").then(m => ({ default: m.MedicalMasteryDashboard })));
const PendingReviewsCard = lazy(() => import("@/components/dashboard/PendingReviewsCard"));
const ErrorReviewCard = lazy(() => import("@/components/dashboard/ErrorReviewCard"));
const DailyPlanWidget = lazy(() => import("@/components/dashboard/DailyPlanWidget"));
const DashboardMetricsGrid = lazy(() => import("@/components/dashboard/DashboardMetricsGrid"));
const CognitiveValidation = lazy(() => import("@/components/admin/CognitiveValidation").then(m => ({ default: m.CognitiveValidation })));
const HighImpactThemesCard = lazy(() => import("@/components/dashboard/HighImpactThemesCard"));
const EnamedMatrixHealth = lazy(() => import("@/components/dashboard/EnamedMatrixHealth"));
const ApprovalIntelligenceDashboard = lazy(() => import("@/components/dashboard/ApprovalIntelligenceDashboard"));

import { ApprovalChanceDashboard } from "@/components/dashboard-v2/ApprovalChanceDashboard";
const EnamedImpactDashboard = lazy(() => import("@/components/dashboard/EnamedImpactDashboard"));
const EnamedEvidenceDashboard = lazy(() => import("@/components/dashboard/EnamedEvidenceDashboard"));
const EvidenceValidationDashboard = lazy(() => import("@/components/dashboard/EvidenceValidationDashboard"));
const EvidenceGovernanceDashboard = lazy(() => import("@/components/dashboard/EvidenceGovernanceDashboard"));
const OutcomeValidationDashboard = lazy(() => import("@/components/dashboard/OutcomeValidationDashboard"));
const OutcomeScienceDashboard = lazy(() => import("@/components/dashboard/OutcomeScienceDashboard"));

const Dashboard = () => {
  const mountTimeRef = useRef(Date.now());
  const telemetryFiredRef = useRef(false);
  const retryFiredRef = useRef(false);
  
  useEffect(() => {
    console.debug("[DashboardHydration START]");
    const timer = setTimeout(() => {
      console.warn("[DashboardHydration STUCK] Hydration taking > 10s");
    }, 10000);
    return () => {
      console.debug("[DashboardHydration UNMOUNT]");
      clearTimeout(timer);
    };
  }, []);

  useRevisionNotifier();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get("debug") === "cockpit";
  
  const { user } = useAuth();
  const { data: dashData, isLoading: dashLoading, error: dashError, refetch: refreshDash } = useDashboardData();
  const { data: studyNext, isLoading: missionLoading, error: missionError, refresh: refreshStudyNext } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading, error: snapError, refetch: refreshSnapshot } = useAnalyticsSnapshot();
  const enaflixUsage = useEnaflixUsage();
  const recentIds = enaflixUsage.recentIds;
  const { state: mascotState, speech: mascotSpeech, triggerInteraction } = useMascotState();

  useEffect(() => {
    if (dashData && studyNext && snapshot) {
      console.debug(`[DashboardHydration END] ${Date.now() - mountTimeRef.current}ms`);
    }
  }, [dashData, studyNext, snapshot]);

  useEffect(() => {
    if (!dashLoading && dashData) {
      const name = dashData.displayName?.split(" ")[0] || "Doutor";
      triggerInteraction({
        state: 'idle',
        type: 'welcome',
        speech: `Bem-vindo de volta, ${name}. Vamos dominar novos temas hoje?`
      });
    }
  }, [dashLoading, dashData, triggerInteraction]);

  const continueModules = useMemo(() => {
    return recentIds
      .map(id => ENAFLIX_MODULES.find(m => m.id === id))
      .filter((m): m is any => !!m)
      .slice(0, 4);
  }, [recentIds]);

  const [cockpitTimedOut, setCockpitTimedOut] = useState(false);
  const autostartConsumedRef = useRef(false);

  const activeRec = studyNext?.recommendation;
  const adaptiveState = studyNext?.adaptiveState;

  useEffect(() => {
    const timer = setTimeout(() => {
      setCockpitTimedOut(true);
      
      const failedBlocks = [];
      if (missionLoading || !studyNext) failedBlocks.push("study_next");
      if (snapLoading || !snapshot) failedBlocks.push("analytics_snapshot");
      if (dashLoading || !dashData) failedBlocks.push("dashboard_data");

      if (failedBlocks.length > 0 && !telemetryFiredRef.current && user) {
        telemetryFiredRef.current = true;
        const loadTime = Date.now() - mountTimeRef.current;
        
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase.functions.invoke("unified-telemetry", {
            body: {
              userId: user.id,
              eventType: "COCKPIT_PARTIAL_MODE",
              data: {
                route: window.location.pathname,
                load_time_ms: loadTime,
                timed_out: true,
                failed_blocks: failedBlocks,
                fallback_used: true
              }
            }
          }).then();
        });

        sessionStorage.setItem("cockpit_partial_mode", "true");
        sessionStorage.setItem("cockpit_partial_reason", failedBlocks.join(","));

        if (import.meta.env.DEV) {
          console.warn(`[Cockpit Diagnostic] Partial mode activated after ${loadTime}ms. Pending:`, failedBlocks);
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [missionLoading, snapLoading, dashLoading, studyNext, snapshot, dashData, user]);

  useEffect(() => {
    if (cockpitTimedOut && !retryFiredRef.current) {
      const retryTimer = setTimeout(() => {
        retryFiredRef.current = true;
        if (import.meta.env.DEV) console.log("[Cockpit Diagnostic] Executing automatic secure retry...");
        if (!studyNext) refreshStudyNext();
        if (!snapshot) refreshSnapshot();
      }, 10000);
      return () => clearTimeout(retryTimer);
    }
  }, [cockpitTimedOut, studyNext, snapshot, refreshStudyNext, refreshSnapshot]);

  useEffect(() => {
    if (studyNext && snapshot && dashData) {
      sessionStorage.removeItem("cockpit_partial_mode");
      sessionStorage.removeItem("cockpit_partial_reason");
    }
  }, [studyNext, snapshot, dashData]);

  useEffect(() => {
    if (autostartConsumedRef.current) return;
    if (missionLoading || !studyNext) return;
    const autostart = searchParams.get("autostart");
    if (autostart !== "true") return;

    autostartConsumedRef.current = true;
    navigate(`/dashboard/sessao-estudo?source=dashboard_autostart`);
  }, [missionLoading, studyNext, searchParams, navigate]);

  const isDataMissing = !studyNext;
  const initialLoading = isDataMissing && !cockpitTimedOut && missionLoading;

  const firstName = dashData?.displayName?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Doutor";

  const debugPanel = isDebug && (
    <div className="fixed top-20 right-4 z-[999] p-4 rounded-2xl bg-black/80 border border-primary/20 backdrop-blur-xl text-[10px] font-mono space-y-2 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
        <Activity className="h-3 w-3 text-primary" />
        <span className="font-bold text-primary uppercase">Cockpit Diagnostic</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-white/50">StudyNext:</span>
        <span className={studyNext ? "text-emerald-400" : "text-amber-500"}>{studyNext ? "OK" : missionLoading ? "Loading" : "Failed"}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-white/50">Snapshot:</span>
        <span className={snapshot ? "text-emerald-400" : "text-amber-500"}>{snapshot ? "OK" : snapLoading ? "Loading" : "Failed"}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-white/50">Dashboard:</span>
        <span className={dashData ? "text-emerald-400" : "text-amber-500"}>{dashData ? "OK" : dashLoading ? "Loading" : "Failed"}</span>
      </div>
      <div className="flex justify-between gap-4 pt-2 border-t border-white/10">
        <span className="text-white/50">Load Time:</span>
        <span className="text-primary font-bold">{(Date.now() - mountTimeRef.current)}ms</span>
      </div>
      {cockpitTimedOut && (
        <div className="text-amber-500 font-bold uppercase animate-pulse">Partial Mode Active</div>
      )}
    </div>
  );

  if (initialLoading) return (
    <>
      {debugPanel}
      <MissionControlSkeleton />
    </>
  );

  return (
    <div className="pb-32 pt-6 space-y-8 relative min-h-screen overflow-x-hidden">
      <EnaflixBackgroundFX intensity="intense" />
      <AchievementToast />

      {debugPanel}

      {isDebug && (
        <div className="mx-4 sm:mx-8 lg:mx-14 relative z-10">
          <Suspense fallback={null}>
            <CognitiveValidation />
          </Suspense>
        </div>
      )}

      {cockpitTimedOut && isDataMissing && (
        <div className="mx-4 sm:mx-8 lg:mx-14 px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-amber-500 animate-spin-slow" />
            <p className="text-sm font-medium text-amber-200/80">
              Algumas métricas ainda estão sincronizando. Você já pode estudar.
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              aria-label="Atualizar métricas"
              data-testid="dashboard-retry-sync"
              onClick={() => {
                refreshStudyNext();
                refreshSnapshot();
                refreshDash();
              }}
              className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
            >
              Tentar atualizar
            </button>
            <button 
              aria-label="Iniciar sessão agora"
              data-testid="dashboard-start-session-anyway"
              onClick={() => navigate("/dashboard/sessao-estudo")}
              className="text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white transition-colors"
            >
              Iniciar sessão mesmo assim
            </button>
          </div>
        </div>
      )}

      <UnifiedMissionHero
        firstName={firstName}
        recommendationTitle={activeRec?.title}
        recommendationDescription={activeRec?.description}
        recommendationType={activeRec?.type}
        recommendationTopic={activeRec?.targetId}
        adaptiveJustification={adaptiveState?.justification}
      />

      <div className="enaflix-stagger space-y-16 pb-24">
        <EnaflixRow title="Atalhos Rápidos">
          <Link to="/dashboard/enaflix" className="glass-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors rounded-xl min-w-[200px]">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-sm">ENAFLIX</p>
              <p className="text-xs text-muted-foreground">Biblioteca de conteúdo</p>
            </div>
          </Link>
          <Link to="/dashboard/flashcards" className="glass-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors rounded-xl min-w-[200px]">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Flashcards</p>
              <p className="text-xs text-muted-foreground">Repetição Espaçada</p>
            </div>
          </Link>
          <Link to="/dashboard/simulados" className="glass-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors rounded-xl min-w-[200px]">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Simulados</p>
              <p className="text-xs text-muted-foreground">Provas & Questões</p>
            </div>
          </Link>
          <Link to="/dashboard/proficiencia" className="glass-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors rounded-xl min-w-[200px]">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Proficiência</p>
              <p className="text-xs text-muted-foreground">Avaliações Atribuídas</p>
            </div>
          </Link>
        </EnaflixRow>

        {continueModules.length > 0 && (
          <EnaflixRow title="Continuar Estudando">
            {continueModules.map(m => (
              <EnaflixContinueCard
                key={m.id}
                title={m.title}
                category={m.category}
                lastAccess="recente"
                onClick={() => navigate(m.path || `/dashboard/${m.id}`)}
              />
            ))}
          </EnaflixRow>
        )}

        <EnaflixRow title="Tutor IA & Co-Pilot">
           <EnaflixCinematicCard 
             variant="tutor" 
             className="col-span-full h-48 flex items-center p-8 gap-8"
             onClick={async () => {
               const { getOrchestratorDecision } = await import("@/lib/cognitiveOrchestrator");
               if (user) {
                 await getOrchestratorDecision(user.id, "dashboard-tutor-banner", {
                   source: "tutor-card"
                 });
               }
               navigate("/dashboard/sessao-estudo?mode=tutor")
             }}
           >
              <div className="shrink-0 group-hover:scale-110 transition-transform duration-500">
                <MascotAvatar state="teaching" size="xl" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="text-3xl font-black text-white">Tutor IA V3</h3>
                  <p className="text-white/60">Deep learning aplicado aos seus casos clínicos e dúvidas de prova.</p>
                </div>
                <Enaflix3DButton variant="violet">
                  Iniciar Tutor IA V3
                </Enaflix3DButton>
              </div>
           </EnaflixCinematicCard>
        </EnaflixRow>

        <div className="px-4 sm:px-8 lg:px-14">
          <EnaflixSectionTitle kicker="PAINEL DE CONTROLE" title="Módulos de Estudo" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <Suspense fallback={<LocalSectionSkeleton />}>
              <PendingReviewsCard />
            </Suspense>
            <Suspense fallback={<LocalSectionSkeleton />}>
              <ErrorReviewCard />
            </Suspense>
            <Suspense fallback={<LocalSectionSkeleton />}>
              <DailyPlanWidget />
            </Suspense>
          </div>
        </div>

        <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12">
          <div className="space-y-6">
            <EnaflixSectionTitle kicker="MATRIZ ENAMED 2026" title="Motor de Aprovação" />
            <Suspense fallback={<LocalSectionSkeleton />}>
              <ApprovalIntelligenceDashboard />
            </Suspense>
            
            <EnaflixSectionTitle kicker="INTELIGÊNCIA PREDITIVA" title="Chance de Aprovação" className="mt-12" />
            <Suspense fallback={<LocalSectionSkeleton />}>
              <ApprovalChanceDashboard />
            </Suspense>
            <Suspense fallback={<LocalSectionSkeleton />}>
              <div className="mt-6">
                <HighImpactThemesCard />
                <EnamedImpactDashboard />
              </div>
            </Suspense>
            <Suspense fallback={<LocalSectionSkeleton />}>
              <div className="mt-6">
                <EnamedMatrixHealth />
              </div>
            </Suspense>
          </div>
          <div className="space-y-6">
            <EnaflixSectionTitle kicker="MAESTRIA CLÍNICA" title="Domínio por Especialidade" />
            {dashData && (
              <Suspense fallback={<LocalSectionSkeleton />}>
                <MedicalMasteryDashboard />
              </Suspense>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-8 lg:px-14 pb-12">
          <EnaflixSectionTitle kicker="ENAMED EVIDENCE ENGINE" title="Evidência de Performance" />
          <div className="mt-6">
            <Suspense fallback={<LocalSectionSkeleton />}>
              <EnamedEvidenceDashboard />
            </Suspense>
          </div>
        </div>

        <div className="px-4 sm:px-8 lg:px-14 pb-24">
          <EnaflixSectionTitle kicker="SCALABILITY OF EVIDENCE" title="Validação de Motores" />
          <div className="mt-6">
            <Suspense fallback={<LocalSectionSkeleton />}>
              <EvidenceValidationDashboard />
            </Suspense>
          </div>
          <div className="mt-12">
            <Suspense fallback={<LocalSectionSkeleton />}>
              <EvidenceGovernanceDashboard />
            </Suspense>
          </div>
          <div className="mt-24">
            <Suspense fallback={<LocalSectionSkeleton />}>
              <OutcomeValidationDashboard />
            </Suspense>
          </div>
          <div className="mt-24">
            <Suspense fallback={<LocalSectionSkeleton />}>
              <OutcomeScienceDashboard />
            </Suspense>
          </div>
        </div>

        <div className="px-4 sm:px-8 lg:px-14 pb-12">
          <EnaflixSectionTitle kicker="MÉTRICAS DETALHADAS" title="Estatísticas de Estudo" />
          <div className="mt-6">
            {dashData ? (
              <DashboardMetricsGrid stats={dashData.stats} metrics={dashData.metrics} />
            ) : (
              <div className="h-48 rounded-[32px] bg-white/5 border border-white/10 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-2">
        <MascotBubble speech={mascotSpeech} />
        <MascotAvatar state={mascotState} size="lg" />
      </div>
    </div>
  );
};

const LocalSectionSkeleton = () => (
  <div className="p-6 rounded-[32px] bg-white/5 border border-white/10 space-y-4 animate-pulse">
    <div className="h-4 w-1/3 bg-white/10 rounded-full" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-32 bg-white/5 rounded-2xl" />
      <div className="h-32 bg-white/5 rounded-2xl" />
    </div>
  </div>
);

export default memo(Dashboard);