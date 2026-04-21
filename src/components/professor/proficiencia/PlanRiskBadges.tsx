import { AlertTriangle, RefreshCcw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlanAnalytics } from "@/hooks/useProficiencyAnalytics";

interface Props {
  planId: string;
}

/**
 * Fase 6 — sinais operacionais do professor por plano.
 * Reaproveita usePlanAnalytics (já cacheado pelo dialog do relatório),
 * mostrando contadores de risco diretamente no item da lista.
 */
export default function PlanRiskBadges({ planId }: Props) {
  const { data, isLoading } = usePlanAnalytics(planId);

  if (isLoading || !data) return null;
  const { summary } = data;
  if (summary.totalStudents === 0) return null;

  const missedGoal = data.students.filter((s) => s.weekly_goal_status === "missed").length;
  const hasSignal = summary.lateCount > 0 || missedGoal > 0 || summary.totalRecalcs > 0;
  if (!hasSignal) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className="gap-1 text-[10px] h-5">
        <Users className="h-3 w-3" /> {summary.totalStudents}
      </Badge>
      {summary.lateCount > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-rose-500/10 text-rose-700 dark:text-rose-400"
          title="Alunos atrasados"
        >
          <AlertTriangle className="h-3 w-3" /> {summary.lateCount} atrasado(s)
        </Badge>
      )}
      {missedGoal > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          title="Meta semanal perdida"
        >
          {missedGoal} meta(s) perdida(s)
        </Badge>
      )}
      {summary.totalRecalcs > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-sky-500/10 text-sky-700 dark:text-sky-400"
          title="Recálculos automáticos"
        >
          <RefreshCcw className="h-3 w-3" /> {summary.totalRecalcs} recalc.
        </Badge>
      )}
    </div>
  );
}
