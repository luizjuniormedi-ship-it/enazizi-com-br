import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardInvalidation } from "@/hooks/useDashboardInvalidation";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Brain, Clock, BookOpen, RefreshCw, CheckCircle2, Loader2, Zap,
  Target, FlipVertical, GraduationCap, Calendar, AlertTriangle,
  Layers, ChevronDown, ArrowRight, Rocket, Play, Compass
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { updateStudyPerformanceContext } from "@/lib/cronogramaSync";
import { buildStudyPath } from "@/lib/studyRouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { useCoreData } from "@/hooks/useCoreData";
import { encodeStudyContext, type StudyContext, objectiveFromTaskType } from "@/lib/studyContext";
import DailyPlanProgress from "@/components/daily-plan/DailyPlanProgress";
import MasteryBadge, { getMasteryLevel } from "@/components/daily-plan/MasteryBadge";
import MicroQuizDialog from "@/components/daily-plan/MicroQuizDialog";
import { useMissionMode } from "@/hooks/useMissionMode";
import SelfAssessmentDialog from "@/components/daily-plan/SelfAssessmentDialog";
import type { ScheduledReview } from "@/components/daily-plan/DailyPlanTypes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import NextTaskBanner from "@/components/daily-plan/NextTaskBanner";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { EnaflixCinematicCard } from "@/components/enaflix/EnaflixCinematicCard";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";
import { EnaflixLoader } from "@/components/enaflix/EnaflixLoader";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { motion } from "framer-motion";

const reviewTimeEstimates: Record<string, number> = {
  D1: 20, D3: 15, D7: 12, D15: 10, D30: 8,
};

/**
 * Daily Plan — Operational layer.
 * Displays today's tasks derived from Adaptive Coordinator (daily_plans) + Study Engine.
 * Integrates directly with the Master Planner Engine rules.
 */
const DailyPlan = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invalidateAll } = useDashboardInvalidation();
  const autoReviewStartedRef = useRef(false);
  const autoStartReviews = new URLSearchParams(location.search).get("autostart") === "reviews";

  const [loading, setLoading] = useState(true);
  const [scheduledReviews, setScheduledReviews] = useState<ScheduledReview[]>([]);
  const [completedReviews, setCompletedReviews] = useState<Set<string>>(new Set());
  const [todayTopics, setTodayTopics] = useState<Array<{ id: string; tema: string; especialidade: string; subtopico: string | null }>>([]);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [masteryData, setMasteryData] = useState<Map<string, { correctRate: number; reviewsDone: number }>>(new Map());
  const [dailyMinutes, setDailyMinutes] = useState(240);
  const [overflowReviews, setOverflowReviews] = useState<ScheduledReview[]>([]);
  const [overflowTopics, setOverflowTopics] = useState<Array<{ id: string; tema: string; especialidade: string; subtopico: string | null }>>([]);
  const [showOverflowReviews, setShowOverflowReviews] = useState(false);
  const [showOverflowTopics, setShowOverflowTopics] = useState(false);

  // Adaptive Coordinator state
  const [dailyPlan, setDailyPlan] = useState<any>(null);
  const [dailyPlanTasks, setDailyPlanTasks] = useState<any[]>([]);

  // Mission Mode integration
  const { state: missionState, startMission, hasTasks: missionHasTasks } = useMissionMode();

  // Micro-quiz
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizReview, setQuizReview] = useState<{ id: string; tema: string; especialidade: string } | null>(null);

  // Self-assessment
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentTopic, setAssessmentTopic] = useState("");
  const [pendingTopicId, setPendingTopicId] = useState<string | null>(null);

  // Auto-encadeamento: última task concluída → mostrar próxima ação
  const [lastCompletedAt, setLastCompletedAt] = useState<number | null>(null);

  // Study Engine recommendations (from Planner + performance data)
  const { data: engineRecs, adaptive: engineAdaptive } = useStudyEngine();
  const { data: coreData } = useCoreData();
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? null;


  // ── Load today's data from Planner tables ──
  useEffect(() => {
    if (!user) return;

    // Telemetry: mission opened
    supabase.functions.invoke("unified-telemetry", {
      body: { userId: user.id, eventType: "daily_mission_opened", module: "daily-plan" }
    }).then();

    const loadToday = async () => {

      try {
        setLoading(true);
        // BR timezone (America/Sao_Paulo) – fixes "today" para usuários após 21h BRT
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());

        const [reviewsRes, attemptsRes, todayTemasRes, profileRes, dailyPlanRes] = await Promise.all([
          supabase
            .from("revisoes")
            .select("id, tema_id, tipo_revisao, data_revisao, status, prioridade, risco_esquecimento")
            .eq("user_id", user.id)
            .eq("status", "pendente")
            .gt("created_at", resetAt || "1900-01-01T00:00:00Z")
            .lte("data_revisao", today)
            .order("prioridade", { ascending: false }),
          supabase
            .from("performance_unified" as any)
            .select("tema, questoes_feitas, taxa_acerto")
            .eq("user_id", user.id)
            .gt("data_registro", resetAt || "1900-01-01T00:00:00Z"),
          supabase
            .from("temas_estudados")
            .select("id, tema, especialidade, subtopico")
            .eq("user_id", user.id)
            .gt("created_at", resetAt || "1900-01-01T00:00:00Z")
            .eq("status", "ativo"),
          supabase
            .from("profiles")
            .select("daily_study_hours")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("daily_plans")
            .select("*, daily_plan_tasks(*)")
            .eq("user_id", user.id)
            .eq("plan_date", today)
            .maybeSingle(),
        ]);

        if (dailyPlanRes.data) {
          setDailyPlan(dailyPlanRes.data);
          setDailyPlanTasks(dailyPlanRes.data.daily_plan_tasks || []);
        } else {
          // SE NÃO EXISTE PLANO PARA HOJE: Disparar geração via Coordenador Adaptativo
          console.log("[DailyPlan] No plan for today. Triggering Adaptive Coordinator...");
          const { data: result, error: invokeErr } = await supabase.functions.invoke("generate-daily-plan", {
            method: "POST"
          });
          
          if (invokeErr) {
            console.error("[DailyPlan] Error generating plan:", invokeErr);
            if (invokeErr.message?.includes("Crie um cronograma")) {
              toast({ 
                title: "Cronograma Necessário", 
                description: "Vá ao Painel de Métricas para configurar seu plano de estudos.",
                variant: "destructive" 
              });
            } else {
              toast({ 
                title: "Erro ao gerar missão", 
                description: "Não foi possível criar sua missão automática agora.",
                variant: "destructive" 
              });
            }
            setLoading(false);
            return;
          }

          if (result?.planId) {
            // Re-fetch now that it's generated
            const { data: newPlan } = await supabase
              .from("daily_plans")
              .select("*, daily_plan_tasks(*)")
              .eq("id", result.planId)
              .single();
              
            if (newPlan) {
              setDailyPlan(newPlan);
              setDailyPlanTasks(newPlan.daily_plan_tasks || []);
              toast({ title: "Plano Diário Atualizado", description: "Seu coordenador adaptativo montou sua missão de hoje." });
            }
          }
        }




        if (reviewsRes.error) throw reviewsRes.error;
        if (attemptsRes.error) throw attemptsRes.error;
        if (todayTemasRes.error) throw todayTemasRes.error;
        if (profileRes.error) throw profileRes.error;

        const userDailyMinutes = Math.round((profileRes.data?.daily_study_hours || 4) * 60);
        setDailyMinutes(userDailyMinutes);

        const mMap = new Map<string, { correctRate: number; reviewsDone: number }>();
        const temaTextToId = new Map<string, string>();
        for (const t of (todayTemasRes.data || [])) {
          if (t.tema) temaTextToId.set(t.tema.toLowerCase(), t.id);
        }
        if (attemptsRes.data) {
          for (const d of attemptsRes.data as any[]) {
            const tId = d.tema ? temaTextToId.get(String(d.tema).toLowerCase()) : null;
            if (!tId) continue;
            const existing = mMap.get(tId) || { correctRate: 0, reviewsDone: 0 };
            existing.correctRate = Number(d.taxa_acerto) / 100;
            mMap.set(tId, existing);
          }
        }

        let usedReviewMinutes = 0;
        if (reviewsRes.data && reviewsRes.data.length > 0) {
          const temaIds = [...new Set(reviewsRes.data.map(r => r.tema_id))];
          const [temasRes, doneReviewsRes] = await Promise.all([
            supabase.from("temas_estudados").select("id, tema, especialidade, subtopico").gt("created_at", resetAt || "1900-01-01T00:00:00Z").in("id", temaIds),
            supabase.from("revisoes").select("tema_id").eq("user_id", user.id).eq("status", "concluida").gt("created_at", resetAt || "1900-01-01T00:00:00Z").in("tema_id", temaIds),
          ]);

          if (temasRes.error) throw temasRes.error;
          if (doneReviewsRes.error) throw doneReviewsRes.error;

          const reviewCounts = new Map<string, number>();
          for (const r of (doneReviewsRes.data || [])) {
            reviewCounts.set(r.tema_id, (reviewCounts.get(r.tema_id) || 0) + 1);
          }
          for (const tId of temaIds) {
            const existing = mMap.get(tId) || { correctRate: 0, reviewsDone: 0 };
            existing.reviewsDone = reviewCounts.get(tId) || 0;
            mMap.set(tId, existing);
          }

          const temaMap = new Map((temasRes.data || []).map(t => [t.id, t]));
          const enriched: ScheduledReview[] = reviewsRes.data
            .map(r => {
              const tema = temaMap.get(r.tema_id);
              return {
                ...r,
                tema: tema?.tema || "Tema desconhecido",
                especialidade: tema?.especialidade || "Geral",
                subtopico: tema?.subtopico || null,
                overdue: r.data_revisao < today,
                estimatedMinutes: reviewTimeEstimates[r.tipo_revisao] || 15,
              };
            })
            .sort((a, b) => {
              if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
              return (b.prioridade || 0) - (a.prioridade || 0);
            });

          const reviewBudget = Math.round(userDailyMinutes * 0.6);
          const fittingReviews: ScheduledReview[] = [];
          const extraReviews: ScheduledReview[] = [];
          for (const r of enriched) {
            if (usedReviewMinutes + (r.estimatedMinutes || 15) <= reviewBudget) {
              fittingReviews.push(r);
              usedReviewMinutes += r.estimatedMinutes || 15;
            } else {
              extraReviews.push(r);
            }
          }
          setScheduledReviews(fittingReviews);
          setOverflowReviews(extraReviews);
        } else {
          setScheduledReviews([]);
          setOverflowReviews([]);
        }

        const reviewedTemaIds = new Set((reviewsRes.data || []).map(r => r.tema_id));
        const { data: completedReviewTemas } = await supabase
          .from("revisoes").select("tema_id").eq("user_id", user.id).eq("status", "concluida");
        const completedTemaIds = new Set((completedReviewTemas || []).map(r => r.tema_id));
        const allNewTopics = (todayTemasRes.data || []).filter(t => !reviewedTemaIds.has(t.id) && !completedTemaIds.has(t.id));

        const topicBudget = Math.min(userDailyMinutes - usedReviewMinutes, Math.round(userDailyMinutes * 0.4));
        const TOPIC_DURATION = 40;
        let usedTopicMinutes = 0;
        const fittingTopics: typeof allNewTopics = [];
        const extraTopics: typeof allNewTopics = [];
        for (const t of allNewTopics) {
          if (fittingTopics.length < 5 && usedTopicMinutes + TOPIC_DURATION <= topicBudget) {
            fittingTopics.push(t);
            usedTopicMinutes += TOPIC_DURATION;
          } else {
            extraTopics.push(t);
          }
        }
        setTodayTopics(fittingTopics);
        setOverflowTopics(extraTopics);
        setMasteryData(mMap);
      } catch (err) {
        console.error("Erro ao carregar plano do dia:", err);
        setScheduledReviews([]);
        setOverflowReviews([]);
        setTodayTopics([]);
        setOverflowTopics([]);
        toast({
          title: "Não conseguimos carregar seu plano",
          description: "Tente recarregar a página em instantes.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadToday();
  }, [user, location.key, resetAt, toast]);

  // ── Navigation helpers with studyContext ──
  const navigateWithContext = (path: string, ctx: StudyContext) => {
    const params = encodeStudyContext(ctx);
    navigate(`${path}?${params.toString()}`);
  };

  const goToTutor = (topic: string, specialty: string, objective: "review" | "new_content", subtopico?: string | null, task_type?: string) => {
    navigateWithContext("/dashboard/sessao-estudo", {
      source: "daily-plan",
      specialty,
      topic,
      subtopic: subtopico || undefined,
      objective,
      taskType: (task_type as any) || (objective === "review" ? "review" : "new"),
    });
  };

  const goToQuestions = (topic: string, specialty: string) => {
    navigateWithContext("/dashboard/simulados", {
      source: "daily-plan",
      specialty,
      topic,
      taskType: "practice",
      objective: "practice",
    });
  };

  const goToFlashcards = (topic: string, specialty: string) => {
    navigateWithContext("/dashboard/flashcards", {
      source: "daily-plan",
      specialty,
      topic,
      taskType: "review",
      objective: "review",
    });
  };

  // ── Review completion ──
  const handleReviewComplete = (reviewId: string, tema: string, especialidade: string) => {
    setQuizReview({ id: reviewId, tema, especialidade });
    setQuizOpen(true);
  };

  const toggleReviewDone = async (reviewId: string) => {
    const wasDone = completedReviews.has(reviewId);

    if (wasDone) {
      // Undo: revert to pending
      const { error } = await supabase
        .from("revisoes")
        .update({ status: "pendente", concluida_em: null })
        .eq("id", reviewId)
        .eq("user_id", user!.id);

      if (error) {
        console.error("[DailyPlan] Falha ao reverter revisão:", error.message);
        toast({ title: "Erro ao reverter revisão", description: error.message, variant: "destructive" });
        return;
      }

      const next = new Set(completedReviews);
      next.delete(reviewId);
      setCompletedReviews(next);
    } else {
      // Complete: persist first, then update UI
      const { error } = await supabase
        .from("revisoes")
        .update({ status: "concluida", concluida_em: new Date().toISOString() })
        .eq("id", reviewId)
        .eq("user_id", user!.id);

      if (error) {
        console.error("[DailyPlan] Falha ao concluir revisão:", error.message);
        toast({ title: "Erro ao salvar revisão", description: error.message, variant: "destructive" });
        return;
      }

      const next = new Set(completedReviews);
      next.add(reviewId);
      setCompletedReviews(next);
      setLastCompletedAt(Date.now());

      // Update performance context in background
      const review = scheduledReviews.find(r => r.id === reviewId);
      if (review && user) {
        updateStudyPerformanceContext(user.id, [{ id: "", tema: review.tema, especialidade: review.especialidade }]).catch(() => {});
      }
    }

    // Invalidate all dashboard/mission/engine caches after confirmed persistence
    invalidateAll();
    queryClient.invalidateQueries({ queryKey: ["mission-mode"] });
    queryClient.invalidateQueries({ queryKey: ["weekly-goals"] });
    queryClient.invalidateQueries({ queryKey: ["preparation-index"] });
  };

  // ── Topic completion with self-assessment ──
  const handleTopicDone = (topicId: string, topicName: string) => {
    setAssessmentTopic(topicName);
    setPendingTopicId(topicId);
    setAssessmentOpen(true);
  };

  const handleAssessmentSubmit = async (confidence: number) => {
    if (pendingTopicId) {
      const next = new Set(completedTopics);
      next.add(pendingTopicId);
      setCompletedTopics(next);
      setPendingTopicId(null);
      setLastCompletedAt(Date.now());
      toast({ title: "Autoavaliação salva!", description: `Confiança: ${confidence}/5 em ${assessmentTopic}` });
      if (user) {
        updateStudyPerformanceContext(user.id, [{ id: "", tema: assessmentTopic, especialidade: "" }]).catch(() => {});
      }
    }
  };

  // ── Derived metrics ──
  const totalItems = dailyPlanTasks.length > 0 
    ? dailyPlanTasks.length 
    : scheduledReviews.length + todayTopics.length + Math.min((engineRecs || []).length, 3);
    
  const totalDone = dailyPlanTasks.length > 0
    ? dailyPlanTasks.filter(t => t.completed).length
    : completedReviews.size + completedTopics.size;

  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;
  
  const reviewMinutes = scheduledReviews.reduce((sum, r) => sum + (r.estimatedMinutes || 15), 0);
  const topicMinutes = todayTopics.length * 40;
  const engineMinutes = Math.min((engineRecs || []).length, 3) * 20;
  const planMinutes = dailyPlanTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  
  const totalMinutes = dailyPlanTasks.length > 0 ? planMinutes : reviewMinutes + topicMinutes + engineMinutes;
  const timeUsedPct = dailyMinutes > 0 ? Math.min(100, Math.round((totalMinutes / dailyMinutes) * 100)) : 0;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? `${m}min` : ""}` : `${m}min`;
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-20">
        <EnaflixBackgroundFX intensity="subtle" />
        <EnaflixLoader variant="hologram" label="Sincronizando plano diário..." />
      </div>
    );
  }

  const hasContent = scheduledReviews.length > 0 || todayTopics.length > 0 || (engineRecs && engineRecs.length > 0);

  // Próxima ação após uma conclusão (próxima revisão pendente → próximo tópico → primeira recomendação do engine)
  const nextPendingReview = scheduledReviews.find((r) => !completedReviews.has(r.id));
  const nextPendingTopic = todayTopics.find((t) => !completedTopics.has(t.id));
  const firstEngineRec = (engineRecs || [])[0];
  const nextAction =
    nextPendingReview
      ? {
          label: nextPendingReview.tema,
          hint: `${nextPendingReview.especialidade} · ~${nextPendingReview.estimatedMinutes}min`,
          go: () => goToTutor(nextPendingReview.tema, nextPendingReview.especialidade, "review", nextPendingReview.subtopico),
        }
      : nextPendingTopic
      ? {
          label: nextPendingTopic.tema,
          hint: `${nextPendingTopic.especialidade} · novo conteúdo`,
          go: () => goToTutor(nextPendingTopic.tema, nextPendingTopic.especialidade, "new_content", nextPendingTopic.subtopico),
        }
      : firstEngineRec
      ? {
          label: firstEngineRec.topic,
          hint: `${firstEngineRec.specialty || ""} · ~${firstEngineRec.estimatedMinutes || 20}min`,
          go: () => navigate(buildStudyPath(firstEngineRec, "daily-plan")),
        }
      : null;

  // Banner aparece por 90s após uma conclusão (lastCompletedAt set)
  const showNextBanner = lastCompletedAt !== null && nextAction !== null
    && (Date.now() - lastCompletedAt) < 90_000;

  return (
    <div className="relative min-h-screen pb-20">
      <EnaflixBackgroundFX intensity="medium" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* Header / Hero */}
        <section className="relative overflow-hidden rounded-3xl p-8 sm:p-12 mb-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-violet-500/10 to-transparent -z-10" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -z-10" />
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="enaflix-hud-label !text-primary tracking-widest uppercase font-black">Missão Médica</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tighter leading-none bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                Hoje no ENAFLIX
              </h1>
              <p className="text-lg text-white/70 max-w-xl font-medium">
                Sua jornada personalizada, organizada por IA para máxima retenção.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                {nextAction && (
                  <Enaflix3DButton 
                    glow 
                    size="lg" 
                    iconRight={<Play className="ml-2 h-5 w-5" />}
                    onClick={nextAction.go}
                  >
                    Começar Missão
                  </Enaflix3DButton>
                )}
                <Enaflix3DButton 
                  variant="outline" 
                  size="lg" 
                  iconLeft={<Compass className="mr-2 h-5 w-5" />}
                  onClick={() => navigate("/dashboard/radar-trajetoria")}
                >
                  Ver Trajetória
                </Enaflix3DButton>
              </div>
            </div>

            {hasContent && (
              <div className="w-full md:w-80 shrink-0">
                <EnaflixCinematicCard variant="analytics" className="p-5 space-y-4 border-white/10 bg-black/40 backdrop-blur-xl">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Progresso do Dia</span>
                    <span className="text-3xl font-black text-primary">{overallPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPct}%` }}
                      className="h-full bg-gradient-to-r from-primary via-cyan-400 to-violet-500"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase">
                    <span>{totalDone}/{totalItems} atividades</span>
                    <span className={timeUsedPct > 100 ? "text-red-400" : ""}>
                      {formatTime(totalMinutes)} planejados
                    </span>
                  </div>
                </EnaflixCinematicCard>
              </div>
            )}
          </div>
        </section>

        {/* Banner de auto-encadeamento */}
        {showNextBanner && nextAction && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <NextTaskBanner
              nextLabel={nextAction.label}
              hint={nextAction.hint}
              onContinue={nextAction.go}
              onOpenRadar={() => navigate("/dashboard/radar-trajetoria")}
              onDismiss={() => setLastCompletedAt(null)}
            />
          </motion.div>
        )}

        {/* ── COORDENADOR ADAPTATIVO (MISSÃO DO DIA) ── */}
        {dailyPlan && dailyPlanTasks.length > 0 && (
          <section className="space-y-6">
            <EnaflixSectionTitle 
              kicker="Ecossistema Cognitivo"
              title="Missão do Dia Adaptativa"
              subtitle={dailyPlan.objective || "Seu coordenador pedagógico reorganizou seu estudo para hoje."}
              action={
                <div className="flex items-center gap-2">
                  {dailyPlan.approval_score && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      Score Sugerido: {Math.round(dailyPlan.approval_score)}%
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => {
                      if (confirm("Deseja regenerar sua missão? Seu progresso atual será preservado, mas novas tarefas serão calculadas.")) {
                        supabase.functions.invoke("unified-telemetry", {
                          body: { userId: user!.id, eventType: "daily_mission_regenerated", module: "daily-plan" }
                        }).then();
                        
                        const { error } = await supabase.functions.invoke("generate-daily-plan", {
                          method: "POST"
                        });
                        if (!error) {
                          window.location.reload();
                        }
                      }
                    }}
                    className="h-8 text-[10px] font-black uppercase tracking-widest gap-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerar
                  </Button>
                </div>
              }

            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dailyPlanTasks.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((task) => (
                <EnaflixCinematicCard
                  key={task.id}
                  variant="lesson"
                  className={cn(
                    "p-5 space-y-4 transition-all group",
                    task.completed && "opacity-40 grayscale"
                  )}
                  onClick={() => {
                    if (task.completed) return;
                    
                    // Telemetry: task started
                    supabase.functions.invoke("unified-telemetry", {
                      body: { 
                        userId: user!.id, 
                        eventType: "daily_mission_task_started", 
                        module: "daily-plan",
                        data: { task_id: task.id, type: task.task_type || task.type, topic: task.topic }
                      }
                    }).then();

                    navigate(buildStudyPath({ 
                      id: task.id, 
                      topic: task.topic, 
                      specialty: task.subject || task.specialty || "Medicina",
                      task_type: task.task_type || task.type
                    }, "daily-plan"));
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <EnaflixBadge type={task.task_type === "error_recovery" ? "urgente" : "ia"} />
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                          {task.estimated_minutes}min
                        </span>
                      </div>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                        {task.title}
                      </h3>
                      <p className="text-[10px] text-white/50 uppercase font-black tracking-wider">
                        {task.subject || task.specialty}
                      </p>
                    </div>
                    {task.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-all">
                        <Play className="h-4 w-4 text-white/40 group-hover:text-primary" />
                      </div>
                    )}
                  </div>
                  
                  {(task.description) && (
                    <p className="text-xs text-white/40 line-clamp-2 italic">
                      "{task.description}"
                    </p>
                  )}

                  {!task.completed && (
                    <div className="pt-2">
                      <Enaflix3DButton size="sm" variant="ghost" className="w-full text-[10px] uppercase font-black">
                        Iniciar Bloco
                      </Enaflix3DButton>
                    </div>
                  )}
                </EnaflixCinematicCard>
              ))}
            </div>


            {dailyPlan.diagnosis_summary && (
              <EnaflixCinematicCard className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Parecer do Coordenador</h4>
                    <p className="text-sm text-white/70 mt-1 leading-relaxed">
                      {dailyPlan.diagnosis_summary}
                    </p>
                  </div>
                </div>
              </EnaflixCinematicCard>
            )}
          </section>
        )}

        {/* ── MISSÃO PRINCIPAL ── */}
        {nextAction && (

          <section className="space-y-4">
            <EnaflixSectionTitle 
              kicker="IA de Estudos"
              title="Próxima Melhor Ação"
              subtitle="O que você deve fazer agora para manter o ritmo."
            />
            <EnaflixCinematicCard 
              variant="tutor" 
              glow
              className="group p-8 relative overflow-hidden min-h-[220px] flex flex-col justify-center"
              onClick={nextAction.go}
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Brain className="h-32 w-32" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <EnaflixBadge type="recomendado" />
                  <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{nextAction.hint}</span>
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-white group-hover:text-primary transition-colors">
                  {nextAction.label}
                </h3>
                <div className="flex items-center gap-4">
                  <Enaflix3DButton size="md" className="w-fit">
                    Continuar agora
                  </Enaflix3DButton>
                </div>
              </div>
            </EnaflixCinematicCard>
          </section>
        )}

        {/* ── REVISÕES INTELIGENTES ── */}
        {scheduledReviews.length > 0 && (
          <section className="space-y-6">
            <EnaflixSectionTitle 
              title="Revisões Inteligentes"
              subtitle="Seu cronograma de repetição espaçada."
              action={
                <div className="flex items-center gap-2 text-xs font-bold text-white/40">
                  <Clock className="h-4 w-4" />
                  ~{reviewMinutes}min estimado
                </div>
              }
            />
            <EnaflixRow title="" className="!space-y-0 -mx-4 sm:-mx-8 lg:-mx-14">
              {scheduledReviews.map((review) => {
                const done = completedReviews.has(review.id);
                const mastery = masteryData.get(review.tema_id);
                const masteryLevel = mastery ? getMasteryLevel(mastery.correctRate, mastery.reviewsDone) : null;

                return (
                  <EnaflixCinematicCard
                    key={review.id}
                    variant="lesson"
                    className={cn(
                      "min-w-[280px] sm:min-w-[320px] p-5 space-y-4 transition-all",
                      done && "opacity-40 grayscale"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <EnaflixBadge type={review.overdue ? "urgente" : "ia"} />
                          {masteryLevel && <MasteryBadge level={masteryLevel.level} percentage={masteryLevel.percentage} compact />}
                        </div>
                        <h3 className="font-bold text-lg line-clamp-2">{review.tema}</h3>
                        <p className="text-[10px] text-white/50 uppercase font-black tracking-wider">
                          {review.especialidade} {review.subtopico ? `· ${review.subtopico}` : ""}
                        </p>
                      </div>
                      <div 
                        className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          done ? toggleReviewDone(review.id) : handleReviewComplete(review.id, review.tema, review.especialidade);
                        }}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <RefreshCw className="h-5 w-5 text-white/40" />}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Enaflix3DButton 
                        variant="ghost" 
                        size="sm" 
                        className="!h-8 !px-3"
                        onClick={() => goToTutor(review.tema, review.especialidade, "review", review.subtopico)}
                      >
                        Tutor IA
                      </Enaflix3DButton>
                      <Enaflix3DButton 
                        variant="ghost" 
                        size="sm" 
                        className="!h-8 !px-3"
                        onClick={() => goToQuestions(review.tema, review.especialidade)}
                      >
                        Questões
                      </Enaflix3DButton>
                    </div>
                  </EnaflixCinematicCard>
                );
              })}
            </EnaflixRow>
          </section>
        )}

        {/* ── CONTEÚDO NOVO ── */}
        {todayTopics.length > 0 && (
          <section className="space-y-6">
            <EnaflixSectionTitle 
              title="Aulas recomendadas"
              subtitle="Novos temas para expandir sua base de conhecimento hoje."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {todayTopics.map((topic) => {
                const done = completedTopics.has(topic.id);
                return (
                  <EnaflixCinematicCard
                    key={topic.id}
                    variant="medical"
                    className={cn(
                      "p-6 flex flex-col justify-between min-h-[180px]",
                      done && "opacity-40 grayscale"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <EnaflixBadge type="novo" />
                        <div 
                          className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 cursor-pointer hover:bg-white/10"
                          onClick={() => done ? setCompletedTopics(prev => { const n = new Set(prev); n.delete(topic.id); return n; }) : handleTopicDone(topic.id, topic.tema)}
                        >
                          {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <BookOpen className="h-5 w-5 text-white/40" />}
                        </div>
                      </div>
                      <h3 className="text-xl font-black tracking-tight">{topic.tema}</h3>
                      <p className="text-xs text-white/50">{topic.especialidade} · ~40min</p>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Enaflix3DButton 
                        size="sm" 
                        className="flex-1"
                        onClick={() => goToTutor(topic.tema, topic.especialidade, "new_content", topic.subtopico)}
                      >
                        Estudar
                      </Enaflix3DButton>
                      <Enaflix3DButton 
                        variant="outline" 
                        size="sm"
                        onClick={() => goToQuestions(topic.tema, topic.especialidade)}
                      >
                        Praticar
                      </Enaflix3DButton>
                    </div>
                  </EnaflixCinematicCard>
                );
              })}
            </div>
          </section>
        )}

        {/* ── RECOMENDAÇÕESestatísticas ── */}
        {engineRecs && engineRecs.length > 0 && (
          <section className="space-y-6">
            <EnaflixSectionTitle 
              title="Ajuste da jornada"
              subtitle="Otimizações sugeridas pela IA com base no seu desempenho recente."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {engineRecs.slice(0, 3).map(rec => (
                <div
                  key={rec.id}
                  className="card-pixar group p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => navigate(buildStudyPath(rec, "daily-plan"))}
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{rec.topic}</p>
                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-black truncate">{rec.reason}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
            <div className="relative">
              <Brain className="h-24 w-24 text-white/10" />
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black">Sua mente está descansada.</h3>
              <p className="text-white/50 max-w-sm mx-auto">
                Nenhuma tarefa pendente para hoje. Que tal revisar seu plano geral?
              </p>
            </div>
            <Enaflix3DButton 
              variant="primary" 
              iconLeft={<Calendar className="mr-2 h-5 w-5" />}
              onClick={() => navigate("/dashboard/planner")}
            >
              Ir para o Plano Geral
            </Enaflix3DButton>
          </div>
        )}
      </div>

      {/* Micro Quiz */}
      {quizReview && (
        <MicroQuizDialog
          open={quizOpen}
          onOpenChange={setQuizOpen}
          topic={quizReview.tema}
          specialty={quizReview.especialidade}
          onPass={() => toggleReviewDone(quizReview.id)}
        />
      )}

      {/* Self Assessment */}
      <SelfAssessmentDialog
        open={assessmentOpen}
        onOpenChange={(open) => { setAssessmentOpen(open); if (!open) setPendingTopicId(null); }}
        topic={assessmentTopic}
        onSubmit={handleAssessmentSubmit}
      />
    </div>
  );
};

export default DailyPlan;
