import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Sparkles, Clock, CheckCircle2, List } from "lucide-react";
import { useStudyEngine, type StudyRecommendation } from "@/hooks/useStudyEngine";
import { buildStudyPath } from "@/lib/studyRouter";
import { getHumanReadableReason } from "@/lib/humanizedReasons";
import { useTopicEvolution, getEvolutionForTopic } from "@/hooks/useTopicEvolution";
import EvolutionBadge from "@/components/dashboard/EvolutionBadge";

const TYPE_LABELS: Record<string, string> = {
  review: "Revisão",
  error_review: "Correção",
  practice: "Prática",
  clinical: "Clínica",
  new: "Novo Tema",
  simulado: "Simulado",
};

const TYPE_COLORS: Record<string, string> = {
  review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  error_review: "bg-destructive/15 text-destructive",
  practice: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  clinical: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  new: "bg-primary/15 text-primary",
  simulado: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function TaskRow({ task, onStart, evolution }: { task: StudyRecommendation; onStart: () => void; evolution?: ReturnType<typeof getEvolutionForTopic> }) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/60 hover:border-primary/30 cursor-pointer transition-all group"
      onClick={onStart}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium border-0 ${TYPE_COLORS[task.type] || "bg-muted text-muted-foreground"}`}>
            {TYPE_LABELS[task.type] || task.type}
          </Badge>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {task.estimatedMinutes}min
          </span>
          {task.priority >= 80 && (
            <span className="text-[10px] text-destructive font-medium">Alta prioridade</span>
          )}
          {evolution && <EvolutionBadge status={evolution.status} />}
        </div>
        <p className="font-medium text-sm truncate">{task.topic}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
          💡 {getHumanReadableReason(task)}
        </p>
      </div>
      <Play className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

export default function TodayStudyCard() {
  const navigate = useNavigate();
  const { data: recommendations, isLoading } = useStudyEngine();
  const { data: evolutions } = useTopicEvolution();

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
            <div className="h-5 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-16 w-full bg-muted animate-pulse rounded-xl" />
            <div className="h-16 w-full bg-muted animate-pulse rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tasks = recommendations || [];

  if (tasks.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-background">
        <CardContent className="p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-foreground">Tudo em dia! 🎉</p>
          <p className="text-xs text-muted-foreground mt-1">
            Nenhuma tarefa pendente. Que tal estudar algo novo?
          </p>
        </CardContent>
      </Card>
    );
  }

  const topTask = tasks[0];
  const totalMinutes = (tasks as StudyRecommendation[]).reduce((s: number, t: StudyRecommendation) => s + (t.estimatedMinutes || 0), 0);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background shadow-[0_0_30px_hsl(var(--primary)/0.06)]">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            Hoje você deve estudar
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"} · ~{totalMinutes}min
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {tasks.slice(0, 5).map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            evolution={getEvolutionForTopic(evolutions, task.topic)}
            onStart={() => navigate(buildStudyPath(task, "daily-plan"))}
          />
        ))}

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="flex-1 gap-1.5 font-semibold"
            onClick={() => navigate(buildStudyPath(topTask, "daily-plan"))}
          >
            <Play className="h-4 w-4" />
            Iniciar próximo bloco
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => navigate("/dashboard/planner")}
          >
            <List className="h-3.5 w-3.5" />
            Plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
