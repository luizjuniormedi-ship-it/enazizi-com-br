import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Pause, Play, CheckCircle2, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type ProfessorPlan,
  useUpdatePlanStatus,
  useDeleteProfessorPlan,
} from "@/hooks/useProfessorPlans";
import AddSubtopicsDialog from "./AddSubtopicsDialog";

interface Props {
  plan: ProfessorPlan;
}

const intensityColor = {
  leve: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  moderado: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  intenso: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const statusLabel = {
  active: "Ativo",
  paused: "Pausado",
  finished: "Encerrado",
};

const PlanListItem = ({ plan }: Props) => {
  const statusMut = useUpdatePlanStatus();
  const delMut = useDeleteProfessorPlan();

  const daysLeft = plan.exam_date
    ? Math.ceil((new Date(plan.exam_date).getTime() - Date.now()) / 86400000)
    : null;

  const handleDelete = () => {
    if (confirm(`Apagar o plano "${plan.name}"? Esta ação não pode ser desfeita.`)) {
      delMut.mutate(plan.id);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{plan.name}</h3>
              <Badge variant="outline">{statusLabel[plan.status]}</Badge>
              <Badge className={intensityColor[plan.intensity]} variant="secondary">
                {plan.intensity}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {plan.exam_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(plan.exam_date), "dd MMM yyyy", { locale: ptBR })}
                  {daysLeft !== null && daysLeft >= 0 && (
                    <span className="text-primary font-medium ml-1">({daysLeft}d restantes)</span>
                  )}
                </span>
              )}
              <span>Criado em {format(new Date(plan.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
            {plan.notes && (
              <p className="text-xs text-muted-foreground line-clamp-2">{plan.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {plan.status === "active" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMut.mutate({ planId: plan.id, status: "paused" })}
                title="Pausar"
              >
                <Pause className="h-4 w-4" />
              </Button>
            ) : plan.status === "paused" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMut.mutate({ planId: plan.id, status: "active" })}
                title="Retomar"
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : null}
            {plan.status !== "finished" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMut.mutate({ planId: plan.id, status: "finished" })}
                title="Encerrar"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              title="Apagar"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanListItem;
