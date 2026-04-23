/**
 * ProgressOverview — Bloco único de progresso do aluno
 * ────────────────────────────────────────────────────
 * Funde 4 cards anteriores em um único componente:
 *   • ApprovalScoreCard
 *   • CoverageCard (cobertura curricular)
 *   • MonthlyGoalCard (meta de questões/mês)
 *   • ReadinessCard (prontidão p/ prova)
 *
 * Reusa hooks existentes (sem nova query):
 *   useAnalyticsSnapshot · useCoverageStatus · useMonthlyGoal · useDashboardData · useCoreData
 */
import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Target, ShieldCheck, TrendingUp, Award, ArrowRight,
} from "lucide-react";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useCoverageStatus } from "@/hooks/useCoverageStatus";
import { useMonthlyGoal } from "@/hooks/useMonthlyGoal";
import { useCoreData } from "@/hooks/useCoreData";
import { useApprovalPrediction } from "@/hooks/useApprovalPrediction";
import { approvalBadgeBg } from "@/engines/approvalEngine";
import { TrendingDown, Minus } from "lucide-react";
import { CinematicMetricHalo } from "@/components/cinematic";

type Tone = "primary" | "success" | "warn" | "danger" | "muted";

function ProgressOverview() {
  const navigate = useNavigate();
  const { data: snap } = useAnalyticsSnapshot();
  const { data: coverage } = useCoverageStatus();
  const { data: goal } = useMonthlyGoal();
  const { data: core } = useCoreData();
  const prediction = useApprovalPrediction();

  // Score preditivo > snapshot legado (fallback se sem dados)
  const approvalScore = prediction?.score ?? snap?.approvalScore ?? 0;
  const approvalTone: Tone =
    approvalScore >= 70 ? "success" :
    approvalScore >= 50 ? "primary" :
    approvalScore >= 30 ? "warn" : "danger";

  const coveragePct = coverage?.requiredCoveragePct ?? 0;
  const coverageTone: Tone =
    coveragePct >= 80 ? "success" :
    coveragePct >= 50 ? "primary" : "danger";

  const goalPct = goal?.percentComplete ?? 0;
  const goalTone: Tone =
    !goal ? "muted" :
    goal.paceStatus === "ahead" ? "success" :
    goal.paceStatus === "on_track" ? "primary" : "warn";

  // Readiness (prontidão p/ prova) — média acertos de simulados recentes
  const examSessions = core?.examSessions ?? [];
  const readinessPct = useMemo(() => {
    if (examSessions.length === 0) return null;
    const avg = examSessions.slice(0, 5).reduce((s, e) => {
      const acc = e.total_questions > 0 ? (e.score / e.total_questions) * 100 : 0;
      return s + acc;
    }, 0) / Math.min(5, examSessions.length);
    return Math.round(avg);
  }, [examSessions]);
  const readinessTone: Tone =
    readinessPct === null ? "muted" :
    readinessPct >= 70 ? "success" :
    readinessPct >= 50 ? "primary" :
    readinessPct >= 30 ? "warn" : "danger";

  // Drill-down inteligente: vai para a métrica mais fraca
  const handleDrillDown = () => {
    const candidates = [
      { tone: coverageTone, path: "/dashboard/cronograma?source=progress_overview" },
      { tone: goalTone, path: "/dashboard/banco-questoes?source=progress_overview" },
      { tone: readinessTone, path: "/dashboard/simulados?source=progress_overview" },
      { tone: approvalTone, path: "/dashboard/analytics?source=progress_overview" },
    ];
    const weakest = candidates.find(c => c.tone === "danger") ||
                    candidates.find(c => c.tone === "warn") ||
                    candidates[0];
    navigate(weakest.path);
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Seu progresso
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDrillDown}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            Detalhes <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Banner Preditivo de Aprovação */}
        {prediction && prediction.hasEnoughData && (
          <div className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 ${approvalBadgeBg(prediction.riskLevel)}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Target className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">
                  Chance de aprovação: {prediction.score}%
                </p>
                <p className="text-[10px] opacity-80 leading-tight truncate">
                  {prediction.message}
                </p>
              </div>
            </div>
            {prediction.delta !== null && (
              <div className="flex items-center gap-0.5 text-xs font-semibold tabular-nums flex-shrink-0">
                {prediction.trend === "up" && <TrendingUp className="h-3 w-3" />}
                {prediction.trend === "down" && <TrendingDown className="h-3 w-3" />}
                {prediction.trend === "stable" && <Minus className="h-3 w-3" />}
                {prediction.delta > 0 ? "+" : ""}{prediction.delta}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CinematicMetricHalo
            module="dashboard"
            icon={Target}
            label="Aprovação"
            value={approvalScore}
            suffix="%"
            size="sm"
            subtitle={
              prediction?.daysToExam != null
                ? `${prediction.daysToExam}d até a prova`
                : snap?.phase ? `Fase: ${snap.phase}` : "Acompanhe sua trajetória"
            }
            onClick={() => navigate("/dashboard/analytics?source=progress_overview")}
          />
          <CinematicMetricHalo
            module="planner"
            icon={ShieldCheck}
            label="Cobertura"
            value={coveragePct}
            suffix="%"
            size="sm"
            subtitle={
              coverage
                ? `${coverage.requiredSeen}/${coverage.requiredTopics} obrigatórios`
                : "Currículo em construção"
            }
            onClick={() => navigate("/dashboard/cronograma?source=progress_overview")}
          />
          <CinematicMetricHalo
            module="flashcard"
            icon={TrendingUp}
            label="Meta do mês"
            value={goal ? goalPct : 0}
            displayValue={goal ? undefined : "—"}
            suffix={goal ? "%" : undefined}
            size="sm"
            subtitle={
              goal
                ? `${goal.completedQuestions}/${goal.targetQuestions} questões`
                : "Defina sua meta"
            }
            onClick={() => navigate("/dashboard/banco-questoes?source=progress_overview")}
          />
          <CinematicMetricHalo
            module="simulado"
            icon={Award}
            label="Prontidão"
            value={readinessPct ?? 0}
            displayValue={readinessPct === null ? "—" : undefined}
            suffix={readinessPct !== null ? "%" : undefined}
            size="sm"
            subtitle={
              examSessions.length > 0
                ? `${examSessions.length} simulado${examSessions.length === 1 ? "" : "s"} recentes`
                : "Faça um simulado para calibrar"
            }
            onClick={() => navigate("/dashboard/simulados?source=progress_overview")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(ProgressOverview);
