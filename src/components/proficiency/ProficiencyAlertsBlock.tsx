import { AlertTriangle, RefreshCcw, GraduationCap, Bell } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ActiveProfessorPlan } from "@/hooks/useStudentActivePlan";
import type { ProficiencyRecalculation } from "@/hooks/useProficiencyReplan";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  plan: ActiveProfessorPlan;
  recalcs: ProficiencyRecalculation[];
}

/**
 * Fase 6 — alertas internos do aluno na Proficiência Guiada.
 * Mostra apenas quando há sinal acionável: atraso, meta perdida ou recálculo recente (<48h).
 * Reaproveita dados de plan.progress e professor_plan_recalculations — sem schema novo.
 */
export default function ProficiencyAlertsBlock({ plan, recalcs }: Props) {
  const overdue = plan.progress?.overdue_tasks ?? 0;
  const goalMissed = plan.progress?.weekly_goal_status === "missed";

  const TWO_DAYS_MS = 1000 * 60 * 60 * 48;
  const recentRecalc = recalcs.find(
    (r) => Date.now() - new Date(r.created_at).getTime() < TWO_DAYS_MS,
  );
  const recentTeacherUpdate =
    recentRecalc?.recalculation_type === "teacher_update" ? recentRecalc : null;
  const recentMissedRecalc =
    recentRecalc?.recalculation_type === "missed_goal" ? recentRecalc : null;

  if (!overdue && !goalMissed && !recentRecalc) return null;

  return (
    <Alert className="border-primary/40 bg-primary/5">
      <Bell className="h-4 w-4 text-primary" />
      <AlertTitle className="flex items-center gap-2">
        Atenção neste plano
        <Badge variant="outline" className="text-[10px] py-0 h-4">
          Proficiência Guiada
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-1.5">
        {overdue > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span>
              Você tem <strong>{overdue} tarefa(s) atrasada(s)</strong>. Conclua-as o quanto antes
              para evitar replanejamento da semana.
            </span>
          </div>
        )}
        {goalMissed && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span>
              Sua <strong>meta semanal foi perdida</strong>. O sistema redistribuiu o conteúdo
              pendente nos próximos dias.
            </span>
          </div>
        )}
        {recentMissedRecalc && (
          <div className="flex items-start gap-2 text-sm">
            <RefreshCcw className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span>
              Plano <strong>recalculado por atraso</strong>{" "}
              <span className="text-muted-foreground">
                ({formatDistanceToNow(new Date(recentMissedRecalc.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
                )
              </span>
              .
            </span>
          </div>
        )}
        {recentTeacherUpdate && (
          <div className="flex items-start gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              <strong>{plan.professorName ?? "Seu professor"}</strong> atualizou este plano{" "}
              <span className="text-muted-foreground">
                ({formatDistanceToNow(new Date(recentTeacherUpdate.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
                )
              </span>
              . Confira as novas tarefas abaixo.
            </span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
