/**
 * @deprecated [Alert Orchestrator — Fase 2]
 * Substituído por `RiskAlertsCard` + `MinimumDailyMissionCard` (orchestrated).
 * Mantido como legacy (0 imports). Não usar.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb, BookOpen, Brain, Target, AlertTriangle,
  ClipboardList, Stethoscope, GraduationCap, Zap
} from "lucide-react";
import type { DashboardMetrics, DashboardStats } from "@/hooks/useDashboardData";

interface Recommendation {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
  priority: "alta" | "média" | "baixa";
  reason: string;
}

interface Props {
  stats: DashboardStats;
  metrics: DashboardMetrics;
  hasCompletedDiagnostic: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  média: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  baixa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function SmartRecommendations({ stats, metrics, hasCompletedDiagnostic }: Props) {
  const navigate = useNavigate();

  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];

    // 1. No diagnostic done yet
    if (!hasCompletedDiagnostic) {
      recs.push({
        id: "diagnostic",
        icon: <Target className="h-5 w-5 text-primary" />,
        title: "Faça o Nivelamento Inicial",
        description: "Descubra seus pontos fortes e fracos antes de estudar.",
        path: "/dashboard/diagnostico",
        priority: "alta",
        reason: "Primeiro passo essencial",
      });
    }

    // 2. Low accuracy → practice more questions
    if (metrics.questionsAnswered > 10 && metrics.accuracy < 60) {
      recs.push({
        id: "low-accuracy",
        icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        title: "Reforce com Questões",
        description: `Sua precisão está em ${metrics.accuracy}%. Pratique questões para melhorar.`,
        path: "/dashboard/simulados",
        priority: "alta",
        reason: `Precisão ${metrics.accuracy}% abaixo de 60%`,
      });
    }

    // 3. Pending reviews
    if (metrics.pendingRevisoes > 3) {
      recs.push({
        id: "pending-reviews",
        icon: <Brain className="h-5 w-5 text-purple-500" />,
        title: "Revisões Pendentes",
        description: `Você tem ${metrics.pendingRevisoes} revisões pendentes. Não perca o timing!`,
        path: "/dashboard/planner",
        priority: "alta",
        reason: `${metrics.pendingRevisoes} revisões acumuladas`,
      });
    }

    // 4. Many errors → use Error Bank
    if (metrics.errorsCount > 5) {
      recs.push({
        id: "error-bank",
        icon: <ClipboardList className="h-5 w-5 text-rose-500" />,
        title: "Revise seus Erros",
        description: `${metrics.errorsCount} erros registrados. Revise para não repetir.`,
        path: "/dashboard/banco-erros",
        priority: "média",
        reason: `${metrics.errorsCount} erros acumulados`,
      });
    }

    // 5. Zero flashcards → suggest creation
    if (stats.flashcards === 0) {
      recs.push({
        id: "flashcards",
        icon: <BookOpen className="h-5 w-5 text-blue-500" />,
        title: "Crie Flashcards",
        description: "Flashcards com repetição espaçada fixam o conteúdo a longo prazo.",
        path: "/dashboard/gerar-flashcards",
        priority: "média",
        reason: "Nenhum flashcard criado",
      });
    }

    // 6. No clinical simulation → try one
    if (metrics.clinicalSimulations === 0) {
      recs.push({
        id: "clinical",
        icon: <Stethoscope className="h-5 w-5 text-teal-500" />,
        title: "Teste uma Simulação Clínica",
        description: "Treine a conduta médica com casos interativos.",
        path: "/dashboard/simulacao-clinica",
        priority: "baixa",
        reason: "Módulo ainda não explorado",
      });
    }

    // 7. Good accuracy → level up with simulados
    if (metrics.accuracy >= 70 && metrics.simuladosCompleted < 3) {
      recs.push({
        id: "simulado",
        icon: <GraduationCap className="h-5 w-5 text-indigo-500" />,
        title: "Faça um Simulado Completo",
        description: "Com boa precisão, teste em condições reais de prova.",
        path: "/dashboard/simulados",
        priority: "média",
        reason: `Precisão ${metrics.accuracy}%, pronto para simular`,
      });
    }

    // 8. Streak = 0 → encourage starting
    if (stats.streak === 0 && metrics.questionsAnswered > 0) {
      recs.push({
        id: "streak",
        icon: <Zap className="h-5 w-5 text-yellow-500" />,
        title: "Comece uma Sequência",
        description: "Estude hoje para iniciar seu streak e ganhar XP bônus!",
        path: "/dashboard/plano-dia",
        priority: "baixa",
        reason: "Sem sequência ativa",
      });
    }

    return recs.slice(0, 3);
  }, [stats, metrics, hasCompletedDiagnostic]);

  if (recommendations.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          Recomendações Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
            onClick={() => navigate(rec.path)}
          >
            <div className="mt-0.5 shrink-0">{rec.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm">{rec.title}</span>
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[rec.priority]}`}>
                  {rec.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{rec.description}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{rec.reason}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            >
              Ir →
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
