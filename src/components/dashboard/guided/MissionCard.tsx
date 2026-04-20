/**
 * MissionCard (Guided)
 * ────────────────────
 * Mostra progresso da missão do dia (daily_plan_tasks via useDashboardData).
 * - Com tasks: barra de progresso + "Continuar missão".
 * - Sem tasks: CTA para gerar plano.
 *
 * Reaproveita useDashboardData (sem nova query).
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight, Plus } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function MissionCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardData();

  const total = data?.stats.todayTotal ?? 0;
  const done = data?.stats.todayCompleted ?? 0;
  const hasPlan = data?.stats.hasStudyPlan ?? false;
  const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const handleContinue = () => navigate("/dashboard/cronograma?source=guided_mission");
  const handleGenerate = () => navigate("/dashboard/smart-planner?source=guided_mission");

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400 shrink-0">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Missão do dia</p>
              <p className="text-xs text-muted-foreground">
                {isLoading
                  ? "Carregando…"
                  : total > 0
                  ? `${done}/${total} tarefas concluídas`
                  : hasPlan
                  ? "Sem tarefas para hoje"
                  : "Nenhum plano ativo"}
              </p>
            </div>
          </div>
          {total > 0 ? (
            <Button size="sm" variant="default" onClick={handleContinue} className="shrink-0">
              Continuar
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleGenerate} className="shrink-0">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Gerar plano
            </Button>
          )}
        </div>

        {total > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
              aria-label={`Progresso ${progress}%`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
