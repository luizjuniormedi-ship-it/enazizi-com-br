import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle2, SkipForward, Clock } from "lucide-react";
import { buildStudyPath } from "@/lib/studyRouter";
import { getHumanReadableReason } from "@/lib/humanizedReasons";
import type { StudyRecommendation } from "@/hooks/useStudyEngine";
import { useAuth } from "@/hooks/useAuth";
import { markRecommendationClicked } from "@/lib/coverageBoostTelemetry";

interface Props {
  task: StudyRecommendation;
  onComplete: () => void;
  onSkip: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  review: "Revisão", error_review: "Correção de Erros", practice: "Prática de Questões",
  clinical: "Treino Clínico", new: "Novo Conteúdo", simulado: "Simulado",
};

const TYPE_ICONS: Record<string, string> = {
  review: "🔄", error_review: "🔴", practice: "📝",
  clinical: "🏥", new: "📚", simulado: "🎯",
};

export default function MissionTaskActions({ task, onComplete, onSkip }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pendingCount = (task as any).pendingCount as number | undefined;
  const hasPending = pendingCount && pendingCount > 1;

  return (
    <Card className="rounded-xl border-primary/30 shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{TYPE_ICONS[task.type] || "📋"}</span>
          <Badge variant="secondary" className="text-[10px]">
            {TYPE_LABELS[task.type] || task.type}
          </Badge>
          {hasPending && (
            <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{task.estimatedMinutes}min
          </span>
        </div>

        <div>
          <h2 className="text-lg font-bold">
            {task.topic}
          </h2>
          {task.type === "review" && hasPending && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              {pendingCount} revisões pendentes deste tema
            </p>
          )}
          {task.type === "review" && pendingCount === 1 && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              Última revisão pendente deste tema
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {getHumanReadableReason(task)}
          </p>
        </div>

        <Button
          className="w-full gap-2 text-base h-14"
          size="lg"
          onClick={() => {
            // Telemetria Fase 1.7: marca como clicado (fire-and-forget, tolerante a falhas).
            if (user?.id) void markRecommendationClicked(user.id, task.id);
            navigate(buildStudyPath(task, "mission"));
          }}
        >
          <Play className="h-5 w-5" />
          Iniciar Atividade
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-1.5" size="sm" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {hasPending ? `Concluí 1/${pendingCount}` : "Já concluí"}
          </Button>
          <Button variant="ghost" className="gap-1.5" size="sm" onClick={onSkip}>
            <SkipForward className="h-3.5 w-3.5" />
            Pular
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
