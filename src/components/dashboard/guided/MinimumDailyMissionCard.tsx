/**
 * MinimumDailyMissionCard — Reativação leve de execução diária
 * ─────────────────────────────────────────────────────────────
 * Aparece SOMENTE quando o aluno está com baixa atividade (7d):
 *   - 0 questões practicadas, OU
 *   - 0 revisões FSRS, OU
 *   - 0 tasks concluídas
 *
 * Missão mínima: 10 questões + 1 revisão + 1 tema crítico.
 * CTA leva direto para a primeira ação concreta.
 */
import { useNavigate } from "react-router-dom";
import { Rocket, ListChecks, BookOpen, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudyEngineImpact } from "@/hooks/useStudyEngineImpact";
import { useAlertOrchestrator } from "@/hooks/useAlertOrchestrator";

export default function MinimumDailyMissionCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useStudyEngineImpact();
  const { getDecision } = useAlertOrchestrator();

  if (isLoading || !data) return null;

  // Critério de baixa atividade — qualquer um dispara
  const lowActivity =
    data.questions7d === 0 ||
    data.tasksCompleted7d === 0;

  if (!lowActivity) return null;

  // Alert Orchestrator — pode rebaixar/suprimir quando há critical estrutural
  if (!getDecision("min-mission").visible) return null;

  const hasGap = data.criticalGapsCount > 0;

  return (
    <div className="glass-card p-5 border-2 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-foreground">
            Missão mínima de hoje
          </h3>
          <p className="text-xs text-muted-foreground">
            Você está sem atividade nos últimos 7 dias. Vamos destravar com algo simples.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs text-foreground">
          <ListChecks className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span>10 questões para aquecer</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground">
          <BookOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span>1 revisão curta (5 min)</span>
        </div>
        {hasGap && (
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Target className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span>1 tema crítico de cobertura</span>
          </div>
        )}
      </div>

      <Button
        onClick={() => navigate("/banco-questoes?mode=quick10")}
        className="w-full gap-2"
        size="sm"
      >
        Começar missão mínima
        <Rocket className="h-4 w-4" />
      </Button>
    </div>
  );
}
