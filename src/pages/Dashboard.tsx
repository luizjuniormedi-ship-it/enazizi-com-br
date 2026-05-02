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
    <div className="pb-24 pt-8 space-y-12">
      <AchievementToast />

      {/* Header & Status */}
      <div className="px-4 sm:px-8 lg:px-14">
        <DashboardTopBar />
        <RecoveryModeBanner />
      </div>

      {/* Hero Principal - Missão de hoje */}
      {activeRec && (
        <div className="px-4 sm:px-8 lg:px-14">
          <CinematicMissionHero
            recommendation={activeRec}
            adaptiveState={adaptiveState}
            onStart={() => navigate(`/dashboard/sessao-estudo?source=dashboard_hero`)}
            onRefresh={refresh}
            onShowAlternatives={() => {}}
          />
        </div>
      )}

      {/* Missão de Hoje - Grid de Ações Rápidas */}
      <EnaflixRow title="Missão de hoje">
        <EnaflixCard
          title="Iniciar Sessão de Estudo"
          subtitle="IA organizadora recomendou focar em revisões agora."
          badge="Prioridade"
          onClick={() => navigate("/dashboard/sessao-estudo")}
          image="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=400&auto=format&fit=crop"
        />
        <EnaflixCard
          title="Revisão Inteligente"
          subtitle={`${dashData?.stats.flashcards || 0} pendentes para hoje.`}
          onClick={() => navigate("/dashboard/flashcards")}
          progress={(dashData?.stats.todayCompleted / dashData?.stats.todayTotal) * 100}
          image="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=400&auto=format&fit=crop"
        />
        <EnaflixCard
          title="Simulado Recomendado"
          subtitle="Simulado de Ginecologia e Obstetrícia"
          onClick={() => navigate("/dashboard/simulados")}
          image="https://images.unsplash.com/photo-1576091160550-2173bdb999ef?q=80&w=400&auto=format&fit=crop"
        />
        <EnaflixCard
          title="Tutor IA"
          subtitle="Tirar dúvidas sobre temas complexos"
          onClick={() => navigate("/dashboard/chatgpt")}
          image="https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop"
        />
      </EnaflixRow>

      {/* Continuar Assistindo */}
      <EnaflixRow title="Continuar assistindo">
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
      <EnaflixRow title="Revisões inteligentes">
        <EnaflixCard
          title="Pediatria: Crescimento"
          subtitle="Risco de esquecimento: Alto"
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
      <EnaflixRow title="Meus erros">
        <EnaflixCard
          title="Treinar Temas em Queda"
          subtitle="Ginecologia e Infectologia"
          badge="IA Recomendou"
          onClick={() => navigate("/dashboard/banco-erros")}
          image="https://images.unsplash.com/photo-1590105577767-e21a46b530f6?q=80&w=400&auto=format&fit=crop"
        />
      </EnaflixRow>

      {/* Progresso e Domínio */}
      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Meu Progresso
          </h2>
          <Suspense fallback={null}>
            <ProgressOverview />
          </Suspense>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Domínio Clínico
          </h2>
          <Suspense fallback={null}>
            <MedicalMasteryDashboard />
          </Suspense>
        </div>
      </div>
      
      {/* Tutor IA Section */}
      <div className="px-4 sm:px-8 lg:px-14">
        <Suspense fallback={null}>
          <TutorContinueCard />
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
