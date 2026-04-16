import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWeeklyGoals } from "@/hooks/useWeeklyGoals";
import { Trophy, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";

function TrendIcon({ percent }: { percent: number }) {
  if (percent >= 80) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (percent >= 40) return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
}

function gradeFromPercent(p: number): { label: string; color: string } {
  if (p >= 100) return { label: "Excelente", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
  if (p >= 80) return { label: "Ótimo", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" };
  if (p >= 60) return { label: "Bom", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
  if (p >= 30) return { label: "Regular", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" };
  return { label: "Início", color: "bg-muted text-muted-foreground" };
}

export default function WeeklySummaryCard() {
  const { data } = useWeeklyGoals();
  if (!data) return null;

  const { goals, overallPercent, weekLabel } = data;
  const grade = gradeFromPercent(overallPercent);

  const completedGoals = goals.filter(g => g.percent >= 100).length;
  const totalDone = goals.reduce((sum, g) => sum + g.current, 0);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-background border-primary/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Resumo Semanal</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {weekLabel}
          </div>
        </div>

        {/* Grade badge + overall */}
        <div className="flex items-center gap-3">
          <Badge className={`${grade.color} border-0 text-xs px-2 py-0.5`}>
            {grade.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {completedGoals}/{goals.length} metas atingidas · {totalDone} atividades
          </span>
        </div>

        {/* Mini stat grid */}
        <div className="grid grid-cols-2 gap-2">
          {goals.map(g => (
            <div key={g.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <span className="text-sm">{g.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{g.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {g.current}/{g.target}
                </p>
              </div>
              <TrendIcon percent={g.percent} />
            </div>
          ))}
        </div>

        {/* Motivational */}
        <p className="text-xs text-center text-muted-foreground italic">
          {overallPercent >= 100
            ? "🎉 Semana perfeita! Continue assim!"
            : overallPercent >= 70
            ? "💪 Ótimo progresso esta semana!"
            : overallPercent >= 40
            ? "📈 Você está evoluindo. Mantenha o foco!"
            : "🚀 Cada questão conta. Comece agora!"}
        </p>
      </CardContent>
    </Card>
  );
}
