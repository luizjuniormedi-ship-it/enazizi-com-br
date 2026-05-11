import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  GraduationCap,
  Loader2,
  Sparkles,
  Target,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Brain,
  Repeat,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStudentActivePlan, type ActiveProfessorPlan } from "@/hooks/useStudentActivePlan";
import {
  useProficiencyDailyTasks,
  useProficiencyWeekTasks,
  useGenerateProficiencyPlan,
  useUpdateProficiencyTaskStatus,
  type ProficiencyDailyTask,
} from "@/hooks/useProficiencyPlanner";
import {
  useProficiencyRecalculations,
  useRecalcProficiencyProgress,
  type ProficiencyRecalculation,
} from "@/hooks/useProficiencyReplan";
import ProficiencyAlertsBlock from "./ProficiencyAlertsBlock";

/**
 * Painel central da Proficiência Guiada (Fase 3).
 * - Renderiza somente quando há plano ativo (`useStudentActivePlan`).
 * - Caso contrário retorna null, preservando o fallback da tela atual.
 * - Auto-gera tarefas se o plano existir mas a janela de 14 dias estiver vazia.
 */
export default function ProficiencyGuidedPanel() {
  const { data: plan, isLoading: loadingPlan } = useStudentActivePlan();

  if (loadingPlan) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Carregando seu plano de proficiência guiada…
        </CardContent>
      </Card>
    );
  }

  if (!plan) return null;
  return <GuidedPanelContent plan={plan} />;
}

function GuidedPanelContent({ plan }: { plan: ActiveProfessorPlan }) {
  const navigate = useNavigate();
  const dailyQ = useProficiencyDailyTasks(plan.id);
  const weekQ = useProficiencyWeekTasks(plan.id, undefined, 14);
  const generate = useGenerateProficiencyPlan();
  const updateStatus = useUpdateProficiencyTaskStatus();
  const recalcsQ = useProficiencyRecalculations(plan.id, 3);
  const recalcProgress = useRecalcProficiencyProgress();
  const triggeredRef = useRef(false);
  const progressRecalcRef = useRef(false);

  const weekTasks = weekQ.data ?? [];
  const dailyTasks = dailyQ.data ?? [];

  // Geração automática quando NÃO há nenhuma tarefa futura.
  useEffect(() => {
    if (triggeredRef.current) return;
    if (weekQ.isLoading || dailyQ.isLoading) return;
    if (generate.isPending) return;
    if (weekTasks.length > 0 || dailyTasks.length > 0) return;

    triggeredRef.current = true;
    generate.mutate(plan.id);
  }, [
    plan.id,
    weekQ.isLoading,
    dailyQ.isLoading,
    weekTasks.length,
    dailyTasks.length,
    generate,
  ]);

  // Recálculo automático de progresso (1x por mount) — pode disparar replan missed_goal.
  useEffect(() => {
    if (progressRecalcRef.current) return;
    if (weekQ.isLoading || dailyQ.isLoading) return;
    if (weekTasks.length === 0 && dailyTasks.length === 0) return;
    progressRecalcRef.current = true;
    recalcProgress.mutate({ planId: plan.id });
  }, [plan.id, weekQ.isLoading, dailyQ.isLoading, weekTasks.length, dailyTasks.length, recalcProgress]);

  const grouped = useMemo(() => groupByDate(weekTasks), [weekTasks]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const recalcs = recalcsQ.data ?? [];

  return (
    <div className="space-y-4">
      <PlanHeader plan={plan} onRegenerate={() => generate.mutate(plan.id)} regenerating={generate.isPending} />

      <ProficiencyAlertsBlock plan={plan} recalcs={recalcs} />

      {recalcs.length > 0 && <RecalculationsBlock recalcs={recalcs} />}

      <ProgressBlock plan={plan} />

      <DailyTasksBlock
        loading={dailyQ.isLoading || (generate.isPending && dailyTasks.length === 0)}
        tasks={dailyTasks}
        onComplete={(taskId) => {
          const task = dailyTasks.find(t => t.id === taskId);
          updateStatus.mutate({ taskId, status: "completed", task });
        }}
        onSkip={(taskId) => updateStatus.mutate({ taskId, status: "skipped" })}
        busy={updateStatus.isPending}
        navigate={navigate}
      />

      <TimelineBlock
        loading={weekQ.isLoading || (generate.isPending && weekTasks.length === 0)}
        grouped={grouped}
        todayIso={todayIso}
      />
    </div>
  );
}

/* -------------------------- Recalculations -------------------------- */
function RecalculationsBlock({ recalcs }: { recalcs: ProficiencyRecalculation[] }) {
  const labelFor = (t: string) => {
    if (t === "missed_goal") return { label: "Plano recalculado por atraso semanal", tone: "amber" as const };
    if (t === "teacher_update") return { label: "Plano atualizado pelo professor", tone: "primary" as const };
    if (t === "auto") return { label: "Recálculo automático", tone: "muted" as const };
    return { label: "Recálculo manual", tone: "muted" as const };
  };
  return (
    <Card className="border-primary/20 bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Recálculos recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {recalcs.map((r) => {
          const { label, tone } = labelFor(r.recalculation_type);
          return (
            <div
              key={r.id}
              className={`flex items-center justify-between text-xs rounded-md border px-2.5 py-1.5 ${
                tone === "amber"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : tone === "primary"
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
              }`}
            >
              <span className="font-medium truncate">{label}</span>
              <span className="text-muted-foreground shrink-0 ml-2">
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}


/* -------------------------- Header -------------------------- */
function PlanHeader({
  plan,
  onRegenerate,
  regenerating,
}: {
  plan: ActiveProfessorPlan;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const intensityLabel: Record<string, string> = {
    leve: "Leve",
    moderado: "Moderado",
    intenso: "Intenso",
  };
  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> Proficiência Guiada
            </Badge>
            <CardTitle className="text-xl flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              {plan.name}
            </CardTitle>
            {plan.professorName && (
              <p className="text-xs text-muted-foreground">
                Professor responsável: <span className="font-medium">{plan.professorName}</span>
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="gap-1"
          >
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Recalcular
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          label="Data da prova"
          value={plan.exam_date ? formatDate(plan.exam_date) : "—"}
        />
        <Stat
          icon={<Clock className="h-4 w-4 text-primary" />}
          label="Dias restantes"
          value={plan.daysUntilExam !== null ? `${plan.daysUntilExam} dia(s)` : "—"}
        />
        <Stat
          icon={<Target className="h-4 w-4 text-primary" />}
          label="Intensidade"
          value={intensityLabel[plan.intensity] ?? plan.intensity}
        />
        <Stat
          icon={<BookOpen className="h-4 w-4 text-primary" />}
          label="Subtemas"
          value={`${plan.subtopics.length}`}
        />
        {plan.notes && (
          <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 italic">
            {plan.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/50 p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

/* -------------------------- Progresso -------------------------- */
function ProgressBlock({ plan }: { plan: ActiveProfessorPlan }) {
  const p = plan.progress;
  const percent = p?.progress_percent ?? 0;
  const goal = p?.weekly_goal_status ?? null;

  const goalBadge =
    goal === "done" ? (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
        ✅ Meta semanal cumprida
      </Badge>
    ) : goal === "partial" ? (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
        🟡 Meta semanal parcial
      </Badge>
    ) : goal === "missed" ? (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Meta semanal não cumprida
      </Badge>
    ) : (
      <Badge variant="outline">Meta semanal em andamento</Badge>
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Progresso geral
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Avanço do plano</span>
            <span className="font-semibold">{percent.toFixed(0)}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <MiniStat label="Concluídas" value={p?.completed_tasks ?? 0} tone="success" />
          <MiniStat label="Pendentes" value={p?.pending_tasks ?? 0} tone="muted" />
          <MiniStat label="Atrasadas" value={p?.overdue_tasks ?? 0} tone="danger" />
          <div className="flex items-center justify-center">{goalBadge}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "muted" | "danger";
}) {
  const colors =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="rounded-md border bg-card/50 p-2">
      <div className={`text-lg font-bold ${colors}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

/* -------------------------- Plano do dia -------------------------- */
function DailyTasksBlock({
  loading,
  tasks,
  onComplete,
  onSkip,
  busy,
  navigate,
}: {
  loading: boolean;
  tasks: ProficiencyDailyTask[];
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  busy: boolean;
  navigate: any;
}) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Plano do dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando seu plano de hoje…
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma tarefa atribuída para hoje. Aproveite para revisar erros ou aguardar a próxima janela.
          </p>
        ) : (
          tasks.map((t) => <TaskRow key={t.id} task={t} onComplete={onComplete} onSkip={onSkip} busy={busy} navigate={navigate} />)
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  onComplete,
  onSkip,
  busy,
  navigate,
}: {
  task: ProficiencyDailyTask;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  busy: boolean;
  navigate: any;
}) {
  const meta = taskMeta(task.task_type);
  const subtopicName = (task.task_payload?.subtopic_name as string | undefined) ?? "Subtema";
  const isDone = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const isOverdue = task.status === "overdue";

  const handleStart = () => {
    const mode = task.task_type === "theory" ? "full" : task.task_type === "questions" ? "practice" : "review";
    const topic = task.task_payload?.subtopic_name || "";
    navigate(`/dashboard/sessao-estudo?topic=${encodeURIComponent(topic)}&origin=guided&auto=1&assignmentId=${task.id}&focus=${mode}`);
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
        isDone
          ? "bg-emerald-500/5 border-emerald-500/30"
          : isOverdue
            ? "bg-destructive/5 border-destructive/40"
            : "bg-card"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-md flex items-center justify-center ${meta.bg} ${meta.fg} shrink-0`}
        >
          {meta.icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{subtopicName}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>{meta.label}</span>
            {task.task_payload?.target_count ? (
              <span>· meta {String(task.task_payload.target_count)}</span>
            ) : null}
            {isOverdue && <Badge variant="destructive" className="h-4 text-[10px]">Atrasada</Badge>}
            {isSkipped && <Badge variant="outline" className="h-4 text-[10px]">Pulada</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isDone && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSkip(task.id)}
              disabled={busy}
              className="text-xs h-7"
            >
              Pular
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleStart}
              disabled={busy}
              className="gap-1 h-7 text-xs"
            >
              <Play className="h-3.5 w-3.5" /> Iniciar
            </Button>
            <Button
              size="sm"
              onClick={() => onComplete(task.id)}
              disabled={busy}
              className="gap-1 h-7 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
            </Button>
          </>
        )}
        {isDone && (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Feita
          </Badge>
        )}
      </div>
    </div>
  );
}

/* -------------------------- Timeline -------------------------- */
function TimelineBlock({
  loading,
  grouped,
  todayIso,
}: {
  loading: boolean;
  grouped: Array<{ date: string; tasks: ProficiencyDailyTask[] }>;
  todayIso: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Próximos dias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando sua linha do tempo…
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">
            Nenhuma tarefa programada nos próximos dias.
          </p>
        ) : (
          grouped.map((g) => {
            const isToday = g.date === todayIso;
            return (
              <div
                key={g.date}
                className={`rounded-md border p-3 ${
                  isToday ? "border-primary/50 bg-primary/5" : "bg-card/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold flex items-center gap-2">
                    {formatDateLong(g.date)}
                    {isToday && (
                      <Badge variant="secondary" className="h-4 text-[10px]">Hoje</Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {g.tasks.length} tarefa(s)
                  </span>
                </div>
                <div className="space-y-1">
                  {g.tasks.map((t) => {
                    const meta = taskMeta(t.task_type);
                    const isReview = t.task_type === "review";
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                          isReview ? "bg-amber-500/10" : "bg-muted/40"
                        }`}
                      >
                        <span className={`${meta.fg}`}>{meta.icon}</span>
                        <span className="truncate flex-1">
                          {(t.task_payload?.subtopic_name as string | undefined) ?? "Subtema"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------- helpers -------------------------- */
function taskMeta(type: string) {
  if (type === "theory") {
    return {
      label: "Teoria",
      icon: <BookOpen className="h-4 w-4" />,
      bg: "bg-blue-500/15",
      fg: "text-blue-600 dark:text-blue-400",
    };
  }
  if (type === "questions") {
    return {
      label: "Questões",
      icon: <Brain className="h-4 w-4" />,
      bg: "bg-violet-500/15",
      fg: "text-violet-600 dark:text-violet-400",
    };
  }
  if (type === "review") {
    return {
      label: "Revisão",
      icon: <Repeat className="h-4 w-4" />,
      bg: "bg-amber-500/15",
      fg: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: type,
    icon: <Target className="h-4 w-4" />,
    bg: "bg-muted",
    fg: "text-muted-foreground",
  };
}

function groupByDate(tasks: ProficiencyDailyTask[]) {
  const map = new Map<string, ProficiencyDailyTask[]>();
  for (const t of tasks) {
    const list = map.get(t.planned_date) ?? [];
    list.push(t);
    map.set(t.planned_date, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({ date, tasks }));
}

function formatDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formatDateLong(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return iso;
  }
}
