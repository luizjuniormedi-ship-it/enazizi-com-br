import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Flame } from "lucide-react";

interface Props {
  completed: number;
  total: number;
  streak: number;
}

const MOTIVATIONAL = [
  "Cada bloco conta. Continue!",
  "Você está construindo consistência.",
  "Progresso é progresso, não importa o ritmo.",
  "Foco no próximo passo.",
  "Disciplina supera motivação.",
];

export default function MissionDayProgress({ completed, total, streak }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const phrase = MOTIVATIONAL[Math.floor(Date.now() / 86400000) % MOTIVATIONAL.length];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          Progresso do dia
        </h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completed}/{total} blocos</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2.5" />
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <Flame className="h-3.5 w-3.5" />
            <span>{streak} dias consecutivos</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic">{phrase}</p>
      </CardContent>
    </Card>
  );
}
