import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, Rocket, ArrowRight, Clock, Sparkles,
  CheckCircle2, ChevronDown, ChevronUp, Flame,
} from "lucide-react";
import { useState } from "react";
import { useMissionMode } from "@/hooks/useMissionMode";
import { useStudyEngine, type StudyRecommendation } from "@/hooks/useStudyEngine";
import { useSafeCta } from "@/hooks/useSafeCta";
import { buildStudyPath } from "@/lib/studyRouter";
import { useDashboardData } from "@/hooks/useDashboardData";
import { getHumanReadableReason } from "@/lib/humanizedReasons";
import { useAuth } from "@/hooks/useAuth";
import { markRecommendationClicked } from "@/lib/coverageBoostTelemetry";
import { telemetry } from "@/lib/pedagogicalTelemetry";

/* ── Dynamic Title Logic ── */
function getDynamicTitle(
  missionActive: boolean,
  missionPaused: boolean,
  isNewUser: boolean,
  tasksCount: number,
): { title: string; subtitle: string } {
  if (missionPaused) return { title: "Vamos continuar de onde você parou", subtitle: "Sua missão está pausada" };
  if (missionActive) return { title: "Missão em andamento", subtitle: "Continue para manter o ritmo" };
  if (isNewUser) return { title: "Sua primeira missão está pronta", subtitle: "Comece agora e veja seu progresso" };
  if (tasksCount === 0) return { title: "Tudo em dia! 🎉", subtitle: "Nenhuma tarefa pendente" };

  const hour = new Date().getHours();
  if (hour < 12) return { title: "Pronto para continuar?", subtitle: "Sua missão de hoje está pronta" };
  if (hour < 18) return { title: "Sua missão de hoje está pronta", subtitle: "Foco e consistência levam ao resultado" };
  return { title: "Ainda dá tempo hoje", subtitle: "Uma sessão antes de dormir faz diferença" };
}

/* ── Day Plan Row — thumb-friendly ── */
const STEP_ICONS: Record<string, string> = {
  review: "🔄", error_review: "❌", practice: "📝",
  clinical: "🩺", new: "📚", simulado: "📋",
};
const STEP_LABELS: Record<string, string> = {
  review: "Revisão", error_review: "Correção", practice: "Questões",
  clinical: "Clínica", new: "Conteúdo novo", simulado: "Simulado",
};

function DayPlanRow({ task, onTap }: { task: StudyRecommendation; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 py-3 px-2 active:bg-muted/50 transition-colors rounded-lg text-left"
    >
      <span className="text-lg shrink-0">{STEP_ICONS[task.type] || "📖"}</span>
      <span className="flex-1 text-sm font-medium truncate">
        {STEP_LABELS[task.type] || task.type} — {task.topic}
      </span>
      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
        <Clock className="h-3 w-3" />
        {task.estimatedMinutes}min
      </span>
    </button>
  );
}

export default function HeroStudyCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading: starting, execute: safeCta } = useSafeCta();
  const {
    state, progress, totalMinutes, completedMinutes,
    engineLoading, hasTasks, startMission, resumeMission,
  } = useMissionMode();
  const { data: recommendations, isLoading: recLoading, adaptive } = useStudyEngine();
  const { data: dashData } = useDashboardData();
  const [expanded, setExpanded] = useState(false);

  const isLoading = engineLoading || starting || recLoading;
  const tasks = recommendations || [];
  const totalStudyMinutes = (tasks as StudyRecommendation[]).reduce((s: number, t: StudyRecommendation) => s + (t.estimatedMinutes || 0), 0);
  const isMissionActive = state.status === "active";
  const isMissionPaused = state.status === "paused";
  const isNewUser = dashData
    ? (dashData.metrics.questionsAnswered === 0 && dashData.stats.flashcards === 0)
    : false;

  const isRecovery = adaptive?.recoveryMode === true;

  // ── Indicadores de retorno (streak / última sessão / pendentes) ──
  const streak = dashData?.metrics.gamificationStreak ?? 0;
  const pendingReviews = dashData?.metrics.pendingRevisoes ?? 0;
  const errorsCount = dashData?.metrics.errorsCount ?? 0;
  const pendingActions = pendingReviews + Math.min(errorsCount, 99);
  const lastActivityLabel = (() => {
    const ts = (dashData as any)?.lastActivityAt as string | undefined;
    if (!ts) return null;
    const diffMs = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return "agora há pouco";
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ontem";
    if (days < 7) return `há ${days} dias`;
    return null;
  })();

  const { title, subtitle } = isRecovery && !isMissionActive && !isMissionPaused
    ? { title: "Modo recuperação ativo", subtitle: "Priorizando o essencial para você retomar o ritmo" }
    : getDynamicTitle(isMissionActive, isMissionPaused, isNewUser, tasks.length);

  // ─── Mission Active/Paused ───
  if (isMissionActive || isMissionPaused) {
    return (
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-[0_0_40px_hsl(var(--primary)/0.12)] animate-fade-in overflow-hidden">
        <CardContent className="p-0">
          <div className="h-2 bg-muted">
            <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse shrink-0">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight">{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {state.completedIds.length}/{state.tasks.length} tarefas · {completedMinutes}/{totalMinutes}min
                </p>
              </div>
              <Badge variant="outline" className="text-sm font-bold px-3 py-1.5 shrink-0">
                {Math.round(progress)}%
              </Badge>
            </div>
            <Button
              className="w-full gap-2 font-bold text-lg h-14 shadow-lg shadow-primary/20"
              size="lg"
              onClick={() => {
                telemetry.track('continuar_clicked', { mission_status: state.status, progress: Math.round(progress) });
                if (isMissionPaused) resumeMission();
                navigate("/mission");
              }}
            >
              <ArrowRight className="h-5 w-5" />
              {isMissionPaused ? "RETOMAR MISSÃO" : "CONTINUAR MISSÃO"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Loading ───
  if (isLoading) {
    return (
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-[0_0_40px_hsl(var(--primary)/0.12)]">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 animate-pulse" />
            <div className="h-5 w-56 bg-muted animate-pulse rounded" />
            <div className="h-14 w-full bg-muted animate-pulse rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── All Caught Up ───
  if (tasks.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-background shadow-[0_0_30px_hsl(142_70%_45%/0.08)]">
        <CardContent className="p-6 sm:p-8 text-center space-y-3">
          <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
          <p className="font-bold text-xl">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    );
  }

  // ─── Main: Idle with tasks ───
  const handleStart = (focusTotal = false) => {
    telemetry.track('hero_cta_clicked', {
      focus_total: focusTotal,
      tasks_count: tasks.length,
      total_minutes: totalStudyMinutes,
      pending_reviews: pendingReviews,
      streak,
      is_new_user: isNewUser,
      is_recovery: isRecovery,
    });
    telemetry.track('study_session_started', {
      origin: 'hero_cta',
      tasks_count: tasks.length,
      top_task_type: topTask?.type,
      top_task_topic: topTask?.topic,
    });
    safeCta({
      action: () => { startMission(); },
      nextStep: focusTotal ? "/mission?focus=total" : "/mission",
      errorMessage: "Não foi possível iniciar. Tente novamente.",
    });
  };

  const topTask = tasks[0];

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-[0_0_40px_hsl(var(--primary)/0.12)] animate-fade-in overflow-hidden">
      <CardContent className="p-0">
        {/* ── Header — fills first screen on mobile ── */}
        <div className="p-5 sm:p-6 pb-5 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-xl leading-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">
              {topTask.topic} · ~{totalStudyMinutes}min
            </p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              💡 {getHumanReadableReason(topTask)}
            </p>

            {/* ── Status de retorno (streak / última sessão / pendentes) ── */}
            {(streak > 0 || lastActivityLabel || pendingActions > 0) && (
              <div className="flex items-center justify-center gap-3 flex-wrap pt-1.5 text-[11px] text-muted-foreground">
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Flame className="h-3 w-3 text-primary" />
                    {streak} {streak === 1 ? "dia" : "dias"} seguidos
                  </span>
                )}
                {lastActivityLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Última sessão {lastActivityLabel}
                  </span>
                )}
                {pendingActions > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    {pendingActions} ações pendentes
                  </span>
                )}
              </div>
            )}
          </div>


          {/* ── Primary CTA — min 56px height, thumb-friendly ── */}
          <Button
            className="w-full gap-2.5 font-bold text-lg h-14 shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
            size="lg"
            disabled={isLoading}
            onClick={() => handleStart(false)}
          >
            <Play className="h-5 w-5" />
            COMEÇAR ESTUDO
          </Button>

          {/* ── Secondary CTA — Focus Total ── */}
          <Button
            variant="outline"
            className="w-full gap-2 text-sm h-11 border-destructive/30 text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-transform"
            disabled={isLoading}
            onClick={() => handleStart(true)}
          >
            🔥 Ativar Modo Foco Total
          </Button>
        </div>

          {/* ── Mini Plan Summary (always visible) ── */}
        <div className="border-t border-border/30">
          {/* Quick summary chips */}
          {(() => {
            const reviewCount = tasks.filter(t => t.type === "review" || t.type === "error_review").length;
            const practiceCount = tasks.filter(t => t.type === "practice" || t.type === "simulado").length;
            const newCount = tasks.filter(t => t.type === "new" || t.type === "clinical").length;
            return (
              <div className="flex items-center justify-center gap-2 flex-wrap px-4 py-3">
                {reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    🔄 {reviewCount} {reviewCount === 1 ? "revisão" : "revisões"}
                  </span>
                )}
                {practiceCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    📝 {practiceCount} {practiceCount === 1 ? "questão" : "questões"}
                  </span>
                )}
                {newCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary">
                    📚 {newCount} {newCount === 1 ? "conteúdo novo" : "novos"}
                  </span>
                )}
              </div>
            );
          })()}

          {/* First 3 tasks always visible */}
          <div className="px-4 sm:px-5 divide-y divide-border/30">
            {tasks.slice(0, 3).map((task) => (
              <DayPlanRow
                key={task.id}
                task={task}
                onTap={() => {
                  if (user?.id) void markRecommendationClicked(user.id, task.id);
                  telemetry.track('study_session_started', { origin: 'day_plan_row', task_type: task.type, task_topic: task.topic });
                  navigate(buildStudyPath(task, "daily-plan"));
                }}
              />
            ))}
          </div>

          {/* Expandable: remaining tasks */}
          {tasks.length > 3 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground active:bg-muted/30 transition-colors border-t border-border/20"
              >
                {expanded ? (
                  <>Ocultar <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Ver mais ({tasks.length - 3} {tasks.length - 3 === 1 ? "tarefa" : "tarefas"}) <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>

              {expanded && (
                <div className="px-4 sm:px-5 pb-4 divide-y divide-border/30 animate-fade-in">
                  {tasks.slice(3, 8).map((task) => (
                    <DayPlanRow
                      key={task.id}
                      task={task}
                      onTap={() => {
                        if (user?.id) void markRecommendationClicked(user.id, task.id);
                        telemetry.track('study_session_started', { origin: 'day_plan_row_expanded', task_type: task.type, task_topic: task.topic });
                        navigate(buildStudyPath(task, "daily-plan"));
                      }}
                    />
                  ))}
                  {tasks.length > 8 && (
                    <p className="text-xs text-center text-muted-foreground pt-3">
                      +{tasks.length - 8} {tasks.length - 8 === 1 ? "tarefa" : "tarefas"} restantes
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
