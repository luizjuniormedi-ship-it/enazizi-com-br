import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useStudyNext, type StudyNextRecommendation } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { usePrefetch } from "@/hooks/usePrefetch";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { useDashboardMnemonic } from "@/hooks/useDashboardMnemonic";
import { Play, Sparkles, Clock, FileText, AlertTriangle, Target, Brain, Info, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTelemetry } from "@/hooks/useTelemetry";
import { motion } from "framer-motion";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";

import CinematicMissionHero from "@/components/dashboard-v2/CinematicMissionHero";
import RecoveryModeBanner from "@/components/dashboard/RecoveryModeBanner";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixCard } from "@/components/enaflix/EnaflixCard";
import SafeCard from "@/components/layout/SafeCard";
import AchievementToast from "@/components/gamification/AchievementToast";
import { fireCelebration } from "@/lib/celebrations";
import MissionControlSkeleton from "@/components/mission-control/MissionControlSkeleton";

const ProgressOverview = lazy(() => import("@/components/dashboard/ProgressOverview"));
const TutorContinueCard = lazy(() => import("@/components/dashboard/TutorContinueCard"));
const MedicalMasteryDashboard = lazy(() => import("@/components/MedicalMasteryDashboard").then(m => ({ default: m.MedicalMasteryDashboard })));

const Dashboard = () => {
  useRevisionNotifier();
  usePrefetch("/dashboard");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { trackAction } = useTelemetry();
  const { user } = useAuth();
  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: dashboardMnemonic } = useDashboardMnemonic();
  const { data, isLoading: missionLoading, isError, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();

  const autostartConsumedRef = useRef(false);

  const activeRec = data?.recommendation;
  const adaptiveState = data?.adaptiveState;

  // Autostart logic
  useEffect(() => {
    if (autostartConsumedRef.current) return;
    if (missionLoading || !data) return;
    const autostart = searchParams.get("autostart");
    if (autostart !== "true") return;

    autostartConsumedRef.current = true;
    navigate(`/dashboard/sessao-estudo?source=dashboard_autostart`);
  }, [missionLoading, data, searchParams, navigate]);

  // Loading state
  const initialLoading = (missionLoading && !data) || (snapLoading && !snapshot) || (dashLoading && !dashData);
  if (initialLoading) return <MissionControlSkeleton />;

  return (
    <div className="pb-32 pt-12 space-y-16 relative min-h-screen overflow-x-hidden">
      <EnaflixBackgroundFX intensity="high" />
      <AchievementToast />

      {/* Header & Status — Pixar Portal style */}
      <div className="px-4 sm:px-8 lg:px-14 flex flex-col gap-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-2 w-10 bg-gradient-to-r from-primary to-accent rounded-full" />
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50">Portal do Aluno</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-2xl">
              Hoje no <span className="gradient-text">ENAFLIX</span>
            </h1>
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full lg:w-auto lg:max-w-md"
          >
            <DashboardTopBar />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <RecoveryModeBanner />
        </motion.div>
      </div>

      {/* Hero Principal - Missão de hoje */}
      {activeRec && (
        <div className="px-4 sm:px-8 lg:px-14">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <CinematicMissionHero
              recommendation={activeRec}
              adaptiveState={adaptiveState}
              onStart={() => navigate(`/dashboard/sessao-estudo?source=dashboard_hero`)}
              onRefresh={refresh}
              onShowAlternatives={() => {}}
            />
          </motion.div>
        </div>
      )}

      {/* Staggered Rows */}
      <div className="enaflix-stagger space-y-16">
        {/* Missão de Hoje - Grid de Ações Rápidas */}
        <EnaflixRow title="Próximos Passos">
          <EnaflixCard
            title="Iniciar Sessão de Estudo"
            subtitle="IA organizadora recomendou focar em revisões agora."
            badge="Recomendado"
            onClick={() => navigate("/dashboard/sessao-estudo")}
            image="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=400&auto=format&fit=crop"
          />
          <EnaflixCard
            title="Revisão Espaçada"
            subtitle={`${dashData?.stats.flashcards || 0} pendentes para hoje.`}
            onClick={() => navigate("/dashboard/flashcards")}
            progress={(dashData?.stats.todayCompleted / dashData?.stats.todayTotal) * 100}
            image="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=400&auto=format&fit=crop"
          />
          <EnaflixCard
            title="Simulado de Performance"
            subtitle="Ginecologia e Obstetrícia"
            onClick={() => navigate("/dashboard/simulados")}
            image="https://images.unsplash.com/photo-1576091160550-2173bdb999ef?q=80&w=400&auto=format&fit=crop"
          />
          <EnaflixCard
            title="Tutor IA Co-Pilot"
            subtitle="Deep learning sobre temas médicos complexos"
            onClick={() => navigate("/dashboard/chatgpt")}
            image="https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop"
          />
        </EnaflixRow>

        {/* Continuar Assistindo */}
        <EnaflixRow title="Continuar de onde parou">
          <EnaflixCard
            title="Insuficiência Cardíaca"
            subtitle="Cardiologia - Aula 3"
            progress={65}
            onClick={() => navigate("/dashboard/videoaulas")}
            image="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=400&auto=format&fit=crop"
          />
          <EnaflixCard
            title="Diabetes Mellitus"
            subtitle="Endocrinologia - Aula 1"
            progress={12}
            onClick={() => navigate("/dashboard/videoaulas")}
            image="https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=400&auto=format&fit=crop"
          />
        </EnaflixRow>

        {/* Revisões Inteligentes */}
        <EnaflixRow title="Revisões Críticas">
          <EnaflixCard
            title="Pediatria: Crescimento"
            subtitle="Risco de esquecimento: Crítico"
            badge="Urgente"
            onClick={() => navigate("/dashboard/flashcards")}
            image="https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?q=80&w=400&auto=format&fit=crop"
          />
          <EnaflixCard
            title="Cirurgia Geral: Abdome Agudo"
            subtitle="Revisão pendente há 2 dias"
            onClick={() => navigate("/dashboard/flashcards")}
            image="https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=400&auto=format&fit=crop"
          />
        </EnaflixRow>

        {/* Meus Erros */}
        <EnaflixRow title="Zonas de Risco">
          <EnaflixCard
            title="Treinar Temas em Queda"
            subtitle="Ginecologia e Infectologia"
            badge="IA Boost"
            onClick={() => navigate("/dashboard/banco-erros")}
            image="https://images.unsplash.com/photo-1590105577767-e21a46b530f6?q=80&w=400&auto=format&fit=crop"
          />
        </EnaflixRow>
      </div>

      {/* Progresso e Domínio — Cinematic Dashboard style */}
      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <EnaflixSectionTitle
            kicker="Análise de Performance"
            title="Meu Panorama"
          />
          <Suspense fallback={null}>
            <ProgressOverview />
          </Suspense>
        </div>
        <div className="space-y-6">
          <EnaflixSectionTitle
            kicker="Brain Power"
            title="Domínio Clínico"
          />
          <Suspense fallback={null}>
            <MedicalMasteryDashboard />
          </Suspense>
        </div>
      </div>

      {/* Tutor IA Section */}
      <div className="px-4 sm:px-8 lg:px-14">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[32px] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
          <Suspense fallback={null}>
            <TutorContinueCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;