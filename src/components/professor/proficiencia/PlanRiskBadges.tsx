import { AlertTriangle, RefreshCcw, Users, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlansAnalyticsBatch } from "@/hooks/usePlansAnalyticsBatch";

interface Props {
  planId: string;
}

/**
 * Fase 6 — sinais operacionais do professor por plano.
 * Hardening: usa `usePlansAnalyticsBatch` (compartilhado entre todas as
 * instâncias da lista) para evitar N queries por plano. O hook agrupa
 * em 3 queries totais e cacheia o resultado por chave do conjunto de planos.
 *
 * Importante: para que o batch funcione, a lista precisa fornecer todos os
 * planIds via PlanRiskBadgesProvider (ver PlanListItem.tsx).
 */
export default function PlanRiskBadges({ planId }: Props) {
  // Quando montado isoladamente, faz 1 query só para esse plano.
  // Em listas, recomenda-se passar planIds via PlansRiskContext.
  const ids = usePlanIdsContext() ?? [planId];
  const { data, isLoading } = usePlansAnalyticsBatch(ids);

  if (isLoading || !data) return null;
  const summary = data[planId];
  if (!summary || summary.totalStudents === 0) return null;

  const { totalStudents, lateCount, missedGoalCount, totalRecalcs, inactiveCount } = summary;
  const hasSignal =
    lateCount > 0 || missedGoalCount > 0 || totalRecalcs > 0 || inactiveCount > 0;
  if (!hasSignal) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className="gap-1 text-[10px] h-5">
        <Users className="h-3 w-3" /> {totalStudents}
      </Badge>
      {lateCount > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-rose-500/10 text-rose-700 dark:text-rose-400"
          title="Alunos atrasados"
        >
          <AlertTriangle className="h-3 w-3" /> {lateCount} atrasado(s)
        </Badge>
      )}
      {missedGoalCount > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          title="Meta semanal perdida"
        >
          {missedGoalCount} meta(s) perdida(s)
        </Badge>
      )}
      {inactiveCount > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-slate-500/10 text-slate-700 dark:text-slate-300"
          title="Alunos sem atividade nos últimos 3 dias"
        >
          <Clock className="h-3 w-3" /> {inactiveCount} inativo(s)
        </Badge>
      )}
      {totalRecalcs > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 text-[10px] h-5 bg-sky-500/10 text-sky-700 dark:text-sky-400"
          title="Recálculos automáticos"
        >
          <RefreshCcw className="h-3 w-3" /> {totalRecalcs} recalc.
        </Badge>
      )}
    </div>
  );
}

// ---- Context para batch entre múltiplos PlanListItem ----
import { createContext, useContext, type ReactNode } from "react";

const PlanIdsContext = createContext<string[] | null>(null);

export function PlanIdsProvider({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  return <PlanIdsContext.Provider value={ids}>{children}</PlanIdsContext.Provider>;
}

function usePlanIdsContext() {
  return useContext(PlanIdsContext);
}
