import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useStudyNext } from "@/hooks/useStudyNext";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRevisionNotifier } from "@/hooks/useRevisionNotifier";
import { Rocket, Sparkles, Brain, Info, Play, Clock, Zap, Target, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
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
  useRevisionNotifier();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: studyNext, isLoading: missionLoading, refresh } = useStudyNext();
  const { data: snapshot, isLoading: snapLoading } = useAnalyticsSnapshot();

  const autostartConsumedRef = useRef(false);

  const activeRec = studyNext?.recommendation;
  const adaptiveState = studyNext?.adaptiveState;

  useEffect(() => {
    if (autostartConsumedRef.current) return;
    if (missionLoading || !studyNext) return;
    const autostart = searchParams.get("autostart");
    if (autostart !== "true") return;

    autostartConsumedRef.current = true;
    navigate(`/dashboard/sessao-estudo?source=dashboard_autostart`);
  }, [missionLoading, studyNext, searchParams, navigate]);

  const initialLoading = (missionLoading && !studyNext) || (snapLoading && !snapshot) || (dashLoading && !dashData);
  if (initialLoading) return <MissionControlSkeleton />;

  const firstName = dashData?.displayName?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Doutor";

  return (
    <div className="pb-32 pt-6 space-y-12 relative min-h-screen overflow-x-hidden">
      <EnaflixBackgroundFX intensity="intense" />
      <AchievementToast />

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
                {activeRec?.title || "Carregando próxima missão..."} — {activeRec?.description || "O motor ACE está calibrando sua jornada."}
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


      {/* Rows Style - Netflix Grid */}
      <div className="enaflix-stagger space-y-16">
        <EnaflixRow title="Continuar Estudando">
          <EnaflixContinueCard
            title="Insuficiência Cardíaca"
            category="Cardiologia"
            progress={65}
            lastAccess="hoje"
            timeLeft="12 min"
            onClick={() => navigate("/dashboard/videoaulas")}
          />
          <EnaflixContinueCard
            title="Diabetes Mellitus"
            category="Endocrinologia"
            progress={12}
            lastAccess="ontem"
            timeLeft="45 min"
            onClick={() => navigate("/dashboard/videoaulas")}
          />
        </EnaflixRow>

        <EnaflixRow title="Temas Populares">
          <EnaflixThemeCard title="Cardiologia" icon="🫀" gradient="from-red-500 to-orange-500" />
          <EnaflixThemeCard title="Pediatria" icon="👶" gradient="from-blue-500 to-cyan-500" />
          <EnaflixThemeCard title="Cirurgia" icon="🔪" gradient="from-emerald-500 to-teal-500" />
          <EnaflixThemeCard title="Gineco" icon="🤰" gradient="from-pink-500 to-rose-500" />
          <EnaflixThemeCard title="Preventiva" icon="🛡️" gradient="from-violet-500 to-purple-500" />
        </EnaflixRow>

        <EnaflixRow title="Revisões Recomendadas">
          <EnaflixCinematicCard 
            variant="poster"
            onClick={() => navigate("/dashboard/flashcards")}
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <Target className="h-8 w-8 text-primary" />
                <EnaflixBadge type="ia" className="bg-primary/20 text-primary border-primary/40" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-xl text-white">Pediatria: Crescimento</h4>
                <p className="text-sm text-white/60 italic">"Risco de esquecimento alto detectado pela IA"</p>
              </div>
              <Enaflix3DButton size="sm" className="w-full">Revisar Agora</Enaflix3DButton>
            </div>
          </EnaflixCinematicCard>
          
          <EnaflixCinematicCard 
            variant="poster"
            onClick={() => navigate("/dashboard/flashcards")}
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <Clock className="h-8 w-8 text-primary" />
                <EnaflixBadge type="urgente" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-xl text-white">Cirurgia: Abdome Agudo</h4>
                <p className="text-sm text-white/60 italic">Dificuldade estimada: Média (15 min)</p>
              </div>
              <Enaflix3DButton size="sm" variant="outline" className="w-full">Agendar</Enaflix3DButton>
            </div>
          </EnaflixCinematicCard>

          <EnaflixCinematicCard 
            variant="poster"
            onClick={() => navigate("/dashboard/simulados")}
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <BookOpen className="h-8 w-8 text-primary" />
                <EnaflixBadge type="ia" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-xl text-white">Gineco & Obstetrícia</h4>
                <p className="text-sm text-white/60 italic">"Focar em temas com queda de 12% no acerto"</p>
              </div>
              <Enaflix3DButton size="sm" variant="violet" className="w-full">Treinar Erros</Enaflix3DButton>
            </div>
          </EnaflixCinematicCard>
        </EnaflixRow>

        <EnaflixRow title="Tutor IA & Co-Pilot">
           <EnaflixCinematicCard variant="tutor" className="col-span-full h-48 flex items-center p-8 gap-8">
              <div className="h-32 w-32 rounded-3xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center border border-white/10 shrink-0">
                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="text-3xl font-black text-white">Tutor Médico IA</h3>
                  <p className="text-white/60">Deep learning aplicado aos seus casos clínicos e dúvidas de prova.</p>
                </div>
                <Enaflix3DButton variant="violet" onClick={() => navigate("/dashboard/chatgpt")}>
                  Iniciar Conversa
                </Enaflix3DButton>
              </div>
           </EnaflixCinematicCard>
        </EnaflixRow>
      </div>

      {/* Analysis Section */}
      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12">
        <div className="space-y-6">
          <EnaflixSectionTitle kicker="ANÁLISE DE PERFORMANCE" title="Panorama do Aluno" />
          <Suspense fallback={null}><ProgressOverview /></Suspense>
        </div>
        <div className="space-y-6">
          <EnaflixSectionTitle kicker="MAESTRIA CLÍNICA" title="Domínio por Especialidade" />
          <Suspense fallback={null}><MedicalMasteryDashboard /></Suspense>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;