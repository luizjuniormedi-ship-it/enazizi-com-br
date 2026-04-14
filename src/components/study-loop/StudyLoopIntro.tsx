import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Clock, Target } from "lucide-react";
import type { LoopContext } from "@/hooks/useStudyLoop";

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  review: { label: "Revisão", emoji: "🔄" },
  error_review: { label: "Correção de Erro", emoji: "🔴" },
  daily_task: { label: "Missão do Dia", emoji: "📋" },
  free_study: { label: "Estudo Livre", emoji: "📚" },
};

interface Props {
  context: LoopContext;
  onStart: () => void;
  onCancel: () => void;
}

export default function StudyLoopIntro({ context, onStart, onCancel }: Props) {
  const rec = context.recommendation;
  const cfg = TYPE_LABELS[rec.type] || TYPE_LABELS.free_study;

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-6 px-4">
      <div className="text-5xl">{cfg.emoji}</div>

      <Badge variant="secondary" className="text-xs">
        {cfg.label}
      </Badge>

      <h2 className="text-xl font-bold text-foreground leading-tight">
        {rec.title}
      </h2>

      <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
        {rec.description}
      </p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {rec.estimatedMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <Target className="h-3.5 w-3.5" />
          Prioridade: {Math.round(rec.priorityScore * 100) / 100}
        </span>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs pt-2">
        <Button size="lg" className="w-full h-12 text-base font-semibold gap-2" onClick={onStart}>
          <Rocket className="h-5 w-5" />
          Iniciar missão
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
