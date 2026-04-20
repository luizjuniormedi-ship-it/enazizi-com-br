/**
 * @deprecated [Alert Orchestrator — Fase 2]
 * Substituído por `RiskAlertsCard` + `useAlertOrchestrator`.
 * Mantido como legacy (0 imports) para preservar histórico — não usar
 * em novos lugares. Será removido em uma sprint futura de cleanup.
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ArrowRight, Play, TrendingDown, Target } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";

/**
 * @deprecated Use `RiskAlertsCard` (governado pelo orchestrator).
 */
export default function SmartAlertCard() {
  const navigate = useNavigate();
  const { data } = useDashboardData();

  if (!data) return null;
  const { metrics, stats } = data;

  // Priority 1: Exam very close
  if (stats.daysUntilExam !== null && stats.daysUntilExam <= 15) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10 shrink-0">
            <Target className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-snug">
              {stats.daysUntilExam} dias para a prova
            </p>
            <p className="text-xs text-muted-foreground">Foco total — cada sessão conta</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs gap-1 h-10 px-3 active:scale-[0.97] transition-transform border-destructive/30 text-destructive"
            onClick={() => navigate("/mission")}
          >
            <Play className="h-3.5 w-3.5" /> Estudar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Priority 2: Pending reviews
  if (metrics.pendingRevisoes >= 3) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 shrink-0">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">
              {metrics.pendingRevisoes} revisões atrasadas
            </p>
            <p className="text-xs text-muted-foreground">Essas revisões evitam esquecimento</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs gap-1 h-10 px-3 active:scale-[0.97] transition-transform"
            onClick={() => navigate("/dashboard/plano-dia?autostart=reviews")}
          >
            <Play className="h-3.5 w-3.5" /> Revisar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Priority 3: Exam approaching (30 days) with low progress
  if (stats.daysUntilExam !== null && stats.daysUntilExam <= 30) {
    const taskPercent = stats.totalTasks > 0
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;
    if (taskPercent < 50) {
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {stats.daysUntilExam} dias para a prova — intensifique o estudo
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs gap-1 h-10 px-3"
              onClick={() => navigate("/mission")}
            >
              Estudar <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      );
    }
  }

  // Priority 4: Frequency drop (streak = 0 but had activity before)
  if (stats.streak === 0 && metrics.questionsAnswered > 5) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 shrink-0">
            <TrendingDown className="h-5 w-5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">
              Você está desacelerando esta semana
            </p>
            <p className="text-xs text-muted-foreground">Retome o ritmo com uma sessão rápida</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs gap-1 h-10 px-3 active:scale-[0.97] transition-transform"
            onClick={() => navigate("/mission")}
          >
            <Play className="h-3.5 w-3.5" /> Começar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Priority 5: High error count
  if (metrics.errorsCount >= 5) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 shrink-0">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">
              {metrics.errorsCount} erros acumulados — revise para não repetir
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs gap-1 h-10 px-3 active:scale-[0.97] transition-transform"
            onClick={() => navigate("/dashboard/banco-erros")}
          >
            Resolver <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
