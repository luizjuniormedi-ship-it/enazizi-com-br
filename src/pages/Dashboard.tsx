import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useStudyNext } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { useEnaflixUsage } from "@/hooks/useEnaflixUsage";
import { ENAFLIX_MODULES } from "@/data/enaflix/enaflixModules";
import { Rocket, Sparkles, Brain, Info, Play, Clock, Zap, Target, BookOpen, AlertCircle, RefreshCw, Activity, Timer } from "lucide-react";
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

const ProgressOverview = lazy(() => import("@/components/dashboard/ProgressOverview"));
const MedicalMasteryDashboard = lazy(() => import("@/components/MedicalMasteryDashboard").then(m => ({ default: m.MedicalMasteryDashboard })));

const Dashboard = () => {
  const mountTimeRef = useRef(Date.now());
  const telemetryFiredRef = useRef(false);
  const retryFiredRef = useRef(false);
  
  useRevisionNotifier();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get("debug") === "cockpit";
  
  const { user } = useAuth();
  const { data: dashData, isLoading: dashLoading, error: dashError } = useDashboardData();
  const { data: studyNext, isLoading: missionLoading, error: missionError, refresh: refreshStudyNext } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading, error: snapError, refetch: refreshSnapshot } = useAnalyticsSnapshot();
  const enaflixUsage = useEnaflixUsage();
  const recentIds = enaflixUsage.recentIds;

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
        
        // Registrar telemetria
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase.from("telemetry_events").insert([{
            user_id: user.id,
            session_id: crypto.randomUUID(),
            event_name: "cockpit_partial_mode",
            properties: {
              route: window.location.pathname,
              load_time_ms: loadTime,
              timed_out: true,
              failed_blocks: failedBlocks,
              fallback_used: true,
              timestamp: new Date().toISOString()
            }
          }]).then();
        });

        // Persistência leve
        sessionStorage.setItem("cockpit_partial_mode", "true");
        sessionStorage.setItem("cockpit_partial_reason", failedBlocks.join(","));

        if (import.meta.env.DEV) {
          console.warn(`[Cockpit Diagnostic] Partial mode activated after ${loadTime}ms. Pending:`, failedBlocks);
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [missionLoading, snapLoading, dashLoading, studyNext, snapshot, dashData, user]);

  // Retry automático após 10s
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

  // Limpar persistência quando tudo carregar
  useEffect(() => {
    if (studyNext && snapshot && dashData) {
      sessionStorage.removeItem("cockpit_partial_mode");
      sessionStorage.removeItem("cockpit_partial_reason");
      if (telemetryFiredRef.current && import.meta.env.DEV) {
        console.log(`[Cockpit Diagnostic] Full recovery complete at ${Date.now() - mountTimeRef.current}ms`);
      }
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

  const isDataMissing = !studyNext || !snapshot || !dashData;
  // Solo bloqueamos el render si falta data crítica Y no hemos llegado al timeout
  const initialLoading = isDataMissing && !cockpitTimedOut && (missionLoading || snapLoading || dashLoading);

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

      {/* Debug Panel */}
      {debugPanel}

      {/* Sync Warning Banner */}
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
              onClick={() => {
                refreshStudyNext();
                refreshSnapshot();
              }}
              className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
            >
              Tentar atualizar
            </button>
            <button 
              onClick={() => navigate("/dashboard/sessao-estudo")}
              className="text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white transition-colors"
            >
              Iniciar sessão mesmo assim
            </button>
          </div>
        </div>
      )}

      {/* Hero Cinematic Style - Netflix Medical */}
      <div className="px-4 sm:px-8 lg:px-14">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative min-h-[500px] rounded-[40px] overflow-hidden flex items-end p-8 sm:p-12 lg:p-16 group"
        >
          {/* Background Poster */}
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1576091160550-2173bdb999ef?q=80&w=2000&auto=format&fit=crop" 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              alt="Medical Mission"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/80 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="flex flex-col gap-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3"
              >
                <EnaflixBadge type="ia" className="bg-primary/20 text-primary border-primary/40 shadow-[0_0_15px_rgba(var(--pixar-blue),0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">Missão Crítica</span>
              </motion.div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-2xl">
                Sua missão de hoje, <span className="gradient-text">{firstName}</span>
              </h1>
              <p className="text-lg sm:text-xl text-white/80 font-medium max-w-xl leading-tight">
                {activeRec?.title || "Começar revisão inteligente"} — {activeRec?.description || "O motor ACE está preparando sua jornada personalizada."}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Enaflix3DButton 
                size="lg" 
                glow 
                iconLeft={<Rocket className="h-5 w-5" />}
                onClick={() => navigate(`/dashboard/sessao-estudo?source=dashboard_hero`)}
              >
                Começar agora
              </Enaflix3DButton>
              <Enaflix3DButton 
                variant="outline" 
                size="lg" 
                iconLeft={<Clock className="h-5 w-5" />}
                onClick={() => navigate("/dashboard/flashcards")}
              >
                Ver revisões
              </Enaflix3DButton>
              
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-white/70 italic">
                   "IA ACE: {adaptiveState?.justification || 'Ajuste adaptativo baseado no seu ritmo.'}"
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>


      <div className="enaflix-stagger space-y-16 pb-24">
        {/* Atividade Recente / Continuar — só renderiza com dados reais */}
        {(continueModules.length > 0) && (
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

        {/* "Temas Populares" e "Revisões Recomendadas" hardcoded foram removidos.
            Substituições reais (derivadas de user_topic_profiles + FSRS due) virão
            nas próximas fases. Não exibimos placeholders fake. */}

        <EnaflixRow title="Tutor IA & Co-Pilot">
           <EnaflixCinematicCard variant="tutor" className="col-span-full h-48 flex items-center p-8 gap-8">
              <div className="h-32 w-32 rounded-3xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center border border-white/10 shrink-0">
                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="text-3xl font-black text-white">Tutor Médico IA</h3>
                  <p className="text-white/60">Deep learning applied aos seus casos clínicos e dúvidas de prova.</p>
                </div>
                <Enaflix3DButton variant="violet" onClick={() => navigate("/dashboard/mentor")}>
                  Iniciar Conversa
                </Enaflix3DButton>
              </div>
           </EnaflixCinematicCard>
        </EnaflixRow>

        {/* Analysis Section */}
        <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12">
          <div className="space-y-6">
            <EnaflixSectionTitle kicker="ANÁLISE DE PERFORMANCE" title="Panorama do Aluno" />
            <Suspense fallback={<LocalSectionSkeleton />}>
              {(dashLoading && !dashData && !cockpitTimedOut) ? <LocalSectionSkeleton /> : <ProgressOverview />}
            </Suspense>
          </div>
          <div className="space-y-6">
            <EnaflixSectionTitle kicker="MAESTRIA CLÍNICA" title="Domínio por Especialidade" />
            <Suspense fallback={<LocalSectionSkeleton />}>
              {(dashLoading && !dashData && !cockpitTimedOut) ? <LocalSectionSkeleton /> : <MedicalMasteryDashboard />}
            </Suspense>
          </div>
        </div>
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