import { Link } from "react-router-dom";
import { TrendingUp, AlertTriangle, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMonthlyGoal } from "@/hooks/useMonthlyGoal";

const MonthlyGoalCard = () => {
  const { data, isLoading } = useMonthlyGoal();

  if (isLoading || !data) return null;

  const {
    targetQuestions,
    completedQuestions,
    percentComplete,
    daysRemaining,
    requiredDailyQuestions,
    currentDailyPace,
    paceStatus,
    examWithinMonth,
  } = data;

  const statusConfig = {
    behind: {
      icon: AlertTriangle,
      label: "Atrasado",
      color: "text-destructive",
      bg: "bg-destructive/10",
      barClass: "[&>div]:bg-destructive",
    },
    on_track: {
      icon: TrendingUp,
      label: "No ritmo",
      color: "text-primary",
      bg: "bg-primary/10",
      barClass: "",
    },
    ahead: {
      icon: Zap,
      label: "Adiantado",
      color: "text-green-500",
      bg: "bg-green-500/10",
      barClass: "[&>div]:bg-green-500",
    },
  } as const;

  const cfg = statusConfig[paceStatus];
  const Icon = cfg.icon;

  return (
    <div className="glass-card p-5 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">Meta de questões do mês</h3>
        </div>
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} flex-shrink-0`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold">{completedQuestions.toLocaleString("pt-BR")}</span>
        <span className="text-sm text-muted-foreground">/ {targetQuestions.toLocaleString("pt-BR")}</span>
        <span className="ml-auto text-sm font-semibold">{percentComplete}%</span>
      </div>

      <Progress value={percentComplete} className={`h-2 mb-3 ${cfg.barClass}`} />

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-muted/40 rounded-md px-2 py-1.5">
          <p className="text-muted-foreground">Necessário/dia</p>
          <p className="font-semibold text-foreground">{requiredDailyQuestions} questões</p>
        </div>
        <div className="bg-muted/40 rounded-md px-2 py-1.5">
          <p className="text-muted-foreground">Seu ritmo atual</p>
          <p className="font-semibold text-foreground">{currentDailyPace}/dia</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {examWithinMonth ? "📅 Prova este mês — " : ""}
        {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
      </p>

      <Link to="/dashboard/simulados">
        <Button size="sm" className="w-full gap-1.5">
          <Zap className="h-4 w-4" />
          Resolver questões agora
        </Button>
      </Link>
    </div>
  );
};

export default MonthlyGoalCard;
