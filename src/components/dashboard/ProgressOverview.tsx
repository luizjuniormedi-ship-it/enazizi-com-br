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
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Target, ShieldCheck, TrendingUp, Award, ArrowRight,
} from "lucide-react";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useCoverageStatus } from "@/hooks/useCoverageStatus";
import { useMonthlyGoal } from "@/hooks/useMonthlyGoal";
import { useCoreData } from "@/hooks/useCoreData";
import { useApprovalPrediction } from "@/hooks/useApprovalPrediction";
import { approvalBadgeBg, getApprovalFocus } from "@/engines/approvalEngine";
import { TrendingDown, Minus } from "lucide-react";

interface MetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  pct?: number;
  tone: "primary" | "success" | "warn" | "danger" | "muted";
  caption?: string;
}

function Metric({ icon: Icon, label, value, pct, tone, caption }: MetricProps) {
  const toneCls = {
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];

  const barCls = {
    primary: "",
    success: "[&>div]:bg-emerald-500",
    warn: "[&>div]:bg-amber-500",
    danger: "[&>div]:bg-destructive",
    muted: "[&>div]:bg-muted-foreground",
  }[tone];

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`h-3.5 w-3.5 ${toneCls} flex-shrink-0`} />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
        </div>
        <span className={`text-base font-bold tabular-nums ${toneCls}`}>{value}</span>
      </div>
      {typeof pct === "number" && <Progress value={pct} className={`h-1 ${barCls}`} />}
      {caption && <p className="text-[10px] text-muted-foreground truncate">{caption}</p>}
    </div>
  );
}

export default function ProgressOverview() {
  const navigate = useNavigate();
  const { data: snap } = useAnalyticsSnapshot();
  const { data: coverage } = useCoverageStatus();
  const { data: goal } = useMonthlyGoal();
  const { data: core } = useCoreData();
  const prediction = useApprovalPrediction();

  // Score preditivo > snapshot legado (fallback se sem dados)
  const approvalScore = prediction?.score ?? snap?.approvalScore ?? 0;
  const approvalTone: MetricProps["tone"] =
    approvalScore >= 70 ? "success" :
    approvalScore >= 50 ? "primary" :
    approvalScore >= 30 ? "warn" : "danger";

  const coveragePct = coverage?.requiredCoveragePct ?? 0;
  const coverageTone: MetricProps["tone"] =
    coveragePct >= 80 ? "success" :
    coveragePct >= 50 ? "primary" : "danger";

  const goalPct = goal?.percentComplete ?? 0;
  const goalTone: MetricProps["tone"] =
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
  const readinessTone: MetricProps["tone"] =
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

        <div className="grid grid-cols-2 gap-2">
          <Metric
            icon={Target}
            label="Aprovação"
            value={`${approvalScore}%`}
            pct={approvalScore}
            tone={approvalTone}
            caption={
              prediction?.daysToExam != null
                ? `${prediction.daysToExam}d até a prova`
                : snap?.phase ? `Fase: ${snap.phase}` : undefined
            }
          />
          <Metric
            icon={ShieldCheck}
            label="Cobertura"
            value={`${coveragePct}%`}
            pct={coveragePct}
            tone={coverageTone}
            caption={
              coverage
                ? `${coverage.requiredSeen}/${coverage.requiredTopics} obrigatórios`
                : undefined
            }
          />
          <Metric
            icon={TrendingUp}
            label="Meta do mês"
            value={goal ? `${goalPct}%` : "—"}
            pct={goal ? goalPct : undefined}
            tone={goalTone}
            caption={
              goal
                ? `${goal.completedQuestions}/${goal.targetQuestions} questões`
                : undefined
            }
          />
          <Metric
            icon={Award}
            label="Prontidão"
            value={readinessPct === null ? "—" : `${readinessPct}%`}
            pct={readinessPct ?? undefined}
            tone={readinessTone}
            caption={
              examSessions.length > 0
                ? `${examSessions.length} simulado${examSessions.length === 1 ? "" : "s"}`
                : "Faça um simulado"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
