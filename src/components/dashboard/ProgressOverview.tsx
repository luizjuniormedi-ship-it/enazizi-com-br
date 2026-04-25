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

  // Drill-down inteligente: vai para a central de estudo/revisões
  const handleDrillDown = () => {
    navigate("/dashboard/sessao-estudo?source=progress_overview");
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Panorama de Desempenho
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDrillDown}
            className="h-8 text-xs font-semibold gap-1.5 text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            Análise detalhada <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Banner Preditivo de Aprovação */}
        {prediction && prediction.hasEnoughData && (
          <div className={`rounded-2xl border-0 px-4 py-3 flex items-center justify-between gap-3 shadow-sm ${approvalBadgeBg(prediction.riskLevel)}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-black leading-tight tracking-tight uppercase">
                  Chance de aprovação: {prediction.score}%
                </p>
                <p className="text-[11px] font-medium opacity-80 leading-snug">
                  {prediction.message}
                </p>
              </div>
            </div>
            {prediction.delta !== null && (
              <div className="flex items-center gap-1 text-[13px] font-black tabular-nums flex-shrink-0 bg-white/10 px-2 py-1 rounded-lg">
                {prediction.trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
                {prediction.trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                {prediction.trend === "stable" && <Minus className="h-3.5 w-3.5" />}
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
            onClick={() => navigate("/dashboard/sessao-estudo?source=progress_overview_score")}
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
            onClick={() => navigate("/dashboard/sessao-estudo?source=progress_overview_coverage")}
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
            onClick={() => navigate("/dashboard/sessao-estudo?source=progress_overview_goal")}
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
            onClick={() => navigate("/dashboard/sessao-estudo?source=progress_overview_readiness")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(ProgressOverview);
