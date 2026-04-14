import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, Pause, Square } from "lucide-react";
import type { StudySessionMetrics } from "@/hooks/useStudySession";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  metrics: StudySessionMetrics;
  onEnd: () => void;
}

export default function SessionBar({ metrics, onEnd }: Props) {
  if (!metrics.active) return null;

  return (
    <div className="sticky top-0 z-30 animate-fade-in">
      <Card className="border-primary/20 bg-card/95 backdrop-blur-md shadow-sm">
        <CardContent className="py-2 px-3 sm:px-4 flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Timer */}
          <span className="flex items-center gap-1.5 text-sm font-mono font-semibold tabular-nums text-primary">
            <Clock className="h-3.5 w-3.5" />
            {fmt(metrics.durationSeconds)}
          </span>

          {/* Divider */}
          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Metrics chips */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              {metrics.correctAnswers}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              {metrics.wrongAnswers}
            </span>
            <span>{metrics.tasksCompleted} {metrics.tasksCompleted === 1 ? "ação" : "ações"}</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* End session */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={onEnd}
          >
            <Square className="h-3 w-3" />
            Encerrar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
