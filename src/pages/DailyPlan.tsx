import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardInvalidation } from "@/hooks/useDashboardInvalidation";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Brain, Clock, BookOpen, RefreshCw, CheckCircle2, Loader2, Zap,
  Target, FlipVertical, GraduationCap, Calendar, AlertTriangle,
  Layers, ChevronDown, ArrowRight, Rocket, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { updateStudyPerformanceContext } from "@/lib/cronogramaSync";
import { buildStudyPath } from "@/lib/studyRouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { encodeStudyContext, type StudyContext } from "@/lib/studyContext";
import DailyPlanProgress from "@/components/daily-plan/DailyPlanProgress";
import MasteryBadge, { getMasteryLevel } from "@/components/daily-plan/MasteryBadge";
import MicroQuizDialog from "@/components/daily-plan/MicroQuizDialog";
import { useMissionMode } from "@/hooks/useMissionMode";
import SelfAssessmentDialog from "@/components/daily-plan/SelfAssessmentDialog";
import type { ScheduledReview } from "@/components/daily-plan/DailyPlanTypes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import NextTaskBanner from "@/components/daily-plan/NextTaskBanner";

const reviewTimeEstimates: Record<string, number> = {
  D1: 20, D3: 15, D7: 12, D15: 10, D30: 8,
};

/**
 * Daily Plan — Operational layer.
 * Displays today's tasks derived from Planner + Study Engine.
 * Does NOT generate its own planning logic.
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
  const { data: engineRecs } = useStudyEngine();

  // ── Load today's data from Planner tables ──
  useEffect(() => {
    if (!user) return;
    const loadToday = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [reviewsRes, attemptsRes, todayTemasRes, profileRes] = await Promise.all([
        supabase
          .from("revisoes")
          .select("id, tema_id, tipo_revisao, data_revisao, status, prioridade, risco_esquecimento")
          .eq("user_id", user.id)
          .eq("status", "pendente")
          .lte("data_revisao", today)
          .order("prioridade", { ascending: false }),
        supabase
          .from("desempenho_questoes")
          .select("tema_id, questoes_feitas, taxa_acerto")
          .eq("user_id", user.id),
        supabase
          .from("temas_estudados")
          .select("id, tema, especialidade, subtopico")
          .eq("user_id", user.id)
          .eq("status", "ativo"),
        supabase
          .from("profiles")
          .select("daily_study_hours")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const userDailyMinutes = Math.round((profileRes.data?.daily_study_hours || 4) * 60);
      setDailyMinutes(userDailyMinutes);

      // Build mastery map
      const mMap = new Map<string, { correctRate: number; reviewsDone: number }>();
      if (attemptsRes.data) {
        for (const d of attemptsRes.data) {
          const existing = mMap.get(d.tema_id) || { correctRate: 0, reviewsDone: 0 };
          existing.correctRate = Number(d.taxa_acerto) / 100;
          mMap.set(d.tema_id, existing);
        }
      }

      // Enrich reviews
      let usedReviewMinutes = 0;
      if (reviewsRes.data && reviewsRes.data.length > 0) {
        const temaIds = [...new Set(reviewsRes.data.map(r => r.tema_id))];
        const [temasRes, doneReviewsRes] = await Promise.all([
          supabase.from("temas_estudados").select("id, tema, especialidade, subtopico").in("id", temaIds),
          supabase.from("revisoes").select("tema_id").eq("user_id", user.id).eq("status", "concluida").in("tema_id", temaIds),
        ]);

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
      }

      // New topics (first contact — no completed reviews yet)
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
      setLoading(false);
    };
    loadToday();
  }, [user, location.key]);

  // ── Navigation helpers with studyContext ──
  const navigateWithContext = (path: string, ctx: StudyContext) => {
    const params = encodeStudyContext(ctx);
    navigate(`${path}?${params.toString()}`);
  };

  const goToTutor = (topic: string, specialty: string, objective: "review" | "new_content", subtopico?: string | null) => {
    navigateWithContext("/dashboard/chatgpt", {
      source: "daily-plan",
      specialty,
      topic,
      subtopic: subtopico || undefined,
      objective,
      taskType: objective === "review" ? "review" : "new",
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
  const totalItems = scheduledReviews.length + todayTopics.length + Math.min((engineRecs || []).length, 3);
  const totalDone = completedReviews.size + completedTopics.size;
  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;
  const reviewMinutes = scheduledReviews.reduce((sum, r) => sum + (r.estimatedMinutes || 15), 0);
  const topicMinutes = todayTopics.length * 40;
  const engineMinutes = Math.min((engineRecs || []).length, 3) * 20;
  const totalMinutes = reviewMinutes + topicMinutes + engineMinutes;
  const timeUsedPct = dailyMinutes > 0 ? Math.min(100, Math.round((totalMinutes / dailyMinutes) * 100)) : 0;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? `${m}min` : ""}` : `${m}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const hasContent = scheduledReviews.length > 0 || todayTopics.length > 0 || (engineRecs && engineRecs.length > 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Plano de Hoje
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          O que o sistema selecionou para você estudar hoje.
        </p>
      </div>

      {/* Progress */}
      {hasContent && (
        <div className="space-y-3">
          <DailyPlanProgress
            overallPct={overallPct}
            totalDone={totalDone}
            totalItems={totalItems}
            totalMinutes={totalMinutes}
          />
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Tempo planejado
              </span>
              <span className={`font-semibold ${timeUsedPct > 100 ? "text-destructive" : "text-foreground"}`}>
                {formatTime(totalMinutes)} / {formatTime(dailyMinutes)}
              </span>
            </div>
            <Progress value={timeUsedPct} className="h-1.5" />
          </div>
        </div>
      )}

      {/* ── SECTION 1: Scheduled Reviews (from Planner) ── */}
      {scheduledReviews.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Revisões Programadas
            <Badge variant="secondary" className="text-[10px]">{scheduledReviews.length}</Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">~{reviewMinutes}min</span>
          </h2>
          {scheduledReviews.map((review) => {
            const done = completedReviews.has(review.id);
            const mastery = masteryData.get(review.tema_id);
            const masteryLevel = mastery ? getMasteryLevel(mastery.correctRate, mastery.reviewsDone) : null;

            return (
              <div
                key={review.id}
                className={`rounded-lg border p-3 flex items-start gap-3 transition-all ${done ? "opacity-40 border-border/40" : review.overdue ? "border-destructive/40 bg-destructive/5" : "border-primary/20 bg-primary/5"}`}
              >
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform bg-primary/10"
                  onClick={() => done ? toggleReviewDone(review.id) : handleReviewComplete(review.id, review.tema, review.especialidade)}
                >
                  {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <RefreshCw className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <h3 className={`font-medium text-sm ${done ? "line-through" : ""}`}>{review.tema}</h3>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{review.tipo_revisao}</Badge>
                    {review.overdue && (
                      <span className="text-[9px] text-destructive flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" /> Atrasada
                      </span>
                    )}
                    {masteryLevel && <MasteryBadge level={masteryLevel.level} percentage={masteryLevel.percentage} compact />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {review.especialidade} · ~{review.estimatedMinutes}min
                    {review.subtopico && <> · {review.subtopico}</>}
                  </p>
                  {!done && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2"
                        onClick={() => goToTutor(review.tema, review.especialidade, "review", review.subtopico)}>
                        <GraduationCap className="h-3 w-3" /> Tutor
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2"
                        onClick={() => goToQuestions(review.tema, review.especialidade)}>
                        <Target className="h-3 w-3" /> Questões
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2"
                        onClick={() => goToFlashcards(review.tema, review.especialidade)}>
                        <FlipVertical className="h-3 w-3" /> Flashcards
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overflow reviews */}
      {overflowReviews.length > 0 && (
        <Collapsible open={showOverflowReviews} onOpenChange={setShowOverflowReviews}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground text-xs">
              <span>Revisões extras ({overflowReviews.length})</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showOverflowReviews ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 mt-1">
            {overflowReviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-border/40 p-2.5 flex items-center gap-2.5 opacity-60">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{review.tema}</p>
                  <p className="text-[10px] text-muted-foreground">{review.tipo_revisao} · {review.especialidade} · ~{review.estimatedMinutes}min</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2"
                  onClick={() => goToTutor(review.tema, review.especialidade, "review")}>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ── SECTION 2: New Topics (from Planner) ── */}
      {todayTopics.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Conteúdo Novo
            <Badge variant="secondary" className="text-[10px]">{todayTopics.length}</Badge>
          </h2>
          {todayTopics.map((topic) => {
            const done = completedTopics.has(topic.id);
            return (
              <div
                key={topic.id}
                className={`rounded-lg border p-3 flex items-start gap-3 transition-all ${done ? "opacity-40 border-border/40" : "border-primary/20 bg-primary/5"}`}
              >
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform bg-primary/10"
                  onClick={() => done ? setCompletedTopics(prev => { const n = new Set(prev); n.delete(topic.id); return n; }) : handleTopicDone(topic.id, topic.tema)}
                >
                  {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <h3 className={`font-medium text-sm ${done ? "line-through" : ""}`}>{topic.tema}</h3>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">Novo</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {topic.especialidade} · ~40min
                    {topic.subtopico && <> · {topic.subtopico}</>}
                  </p>
                  {!done && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2"
                        onClick={() => goToTutor(topic.tema, topic.especialidade, "new_content", topic.subtopico)}>
                        <GraduationCap className="h-3 w-3" /> Tutor
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2"
                        onClick={() => goToQuestions(topic.tema, topic.especialidade)}>
                        <Target className="h-3 w-3" /> Questões
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overflow topics */}
      {overflowTopics.length > 0 && (
        <Collapsible open={showOverflowTopics} onOpenChange={setShowOverflowTopics}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground text-xs">
              <span>Mais temas para depois ({overflowTopics.length})</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showOverflowTopics ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 mt-1">
            {overflowTopics.map((topic) => (
              <div key={topic.id} className="rounded-lg border border-border/40 p-2.5 flex items-center gap-2.5 opacity-60">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{topic.tema}</p>
                  <p className="text-[10px] text-muted-foreground">{topic.especialidade} · ~40min</p>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ── SECTION 3: Study Engine Recommendations ── */}
      {engineRecs && engineRecs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Recomendações Inteligentes
          </h2>
          {engineRecs.slice(0, 3).map(rec => {
            const path = buildStudyPath(rec, "daily-plan");
            return (
              <div
                key={rec.id}
                className="rounded-lg border border-border/60 p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(path)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rec.topic}</p>
                  <p className="text-[10px] text-muted-foreground">{rec.reason}</p>
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                  <Clock className="h-3 w-3" />
                  {rec.estimatedMinutes}min
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Mission CTA — start full guided flow ── */}
      {hasContent && missionState.status === "idle" && missionHasTasks && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Executar tudo como Missão</p>
              <p className="text-[10px] text-muted-foreground">O sistema guia você passo a passo por todas as tarefas.</p>
            </div>
          </div>
          <Button
            className="w-full gap-2 font-semibold"
            onClick={() => { startMission(); navigate("/mission"); }}
          >
            <Play className="h-4 w-4" /> INICIAR MISSÃO DO DIA
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="text-center py-16 space-y-3">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje.</p>
          <p className="text-xs text-muted-foreground">
            Configure seu plano de estudos no <strong>Plano Geral</strong> para ver tarefas aqui.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/planner")}>
            <Calendar className="h-4 w-4 mr-2" /> Ir para o Plano Geral
          </Button>
        </div>
      )}

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
