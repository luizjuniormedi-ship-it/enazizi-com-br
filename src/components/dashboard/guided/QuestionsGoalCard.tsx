import { Link } from "react-router-dom";
import { ListChecks, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuestionGoal } from "@/hooks/useQuestionGoal";

/**
 * QuestionsGoalCard — visão de janela rolante de 30 dias.
 * Complementa o MonthlyGoalCard (mês-calendário).
 */
const QuestionsGoalCard = () => {
  const { data, isLoading } = useQuestionGoal();

  if (isLoading || !data) return null;

  const { questions_30d, target, backlog, daily_target, status } = data;
  const percent = Math.min(100, Math.round((questions_30d / target) * 100));
  const isBehind = status === "behind";

  return (
    <div className="glass-card p-5 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">Volume de questões (30d)</h3>
        </div>
        <span
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
            isBehind
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-green-500/10 text-green-600 dark:text-green-400"
          }`}
        >
          {isBehind ? <AlertTriangle className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
          {isBehind ? "Abaixo da meta" : "No ritmo"}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold">{questions_30d.toLocaleString("pt-BR")}</span>
        <span className="text-sm text-muted-foreground">/ {target.toLocaleString("pt-BR")}</span>
        <span className="ml-auto text-sm font-semibold">{percent}%</span>
      </div>

      <Progress
        value={percent}
        className={`h-2 mb-3 ${isBehind ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`}
      />

      {isBehind ? (
        <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-md px-2 py-1.5 mb-3">
          ⚠️ Você está abaixo da meta de questões para aprovação.
          <br />
          <span className="font-semibold">
            Meta diária: {daily_target}/dia
          </span>{" "}
          ({backlog.toLocaleString("pt-BR")} restantes)
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">
          ✅ Meta de 2000 questões nos últimos 30 dias atingida.
        </p>
      )}

      <Link to="/dashboard/simulados">
        <Button size="sm" className="w-full gap-1.5" variant={isBehind ? "default" : "outline"}>
          <Zap className="h-4 w-4" />
          Resolver questões agora
        </Button>
      </Link>
    </div>
  );
};

export default QuestionsGoalCard;
