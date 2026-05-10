/**
 * ProgressOverview — Bloco único de progresso do aluno
 * ────────────────────────────────────────────────────
 * Funde 4 cards anteriores em um único componente:
 *   • ApprovalScoreCard
 *   • CoverageCard (cobertura curricular)
 *   • MonthlyGoalCard (meta de questões/mês)
 *   • ReadinessCard (prontidão p/ prova)
 *
 * Fase Enterprise+: Integração com Neuroanalytics
 */
import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, ShieldCheck, TrendingUp, Award, ArrowRight, Brain, Activity, Zap
} from "lucide-react";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import { useCoverageStatus } from "@/hooks/useCoverageStatus";
import { useMonthlyGoal } from "@/hooks/useMonthlyGoal";
import { useCoreData } from "@/hooks/useCoreData";
import { useApprovalPrediction } from "@/hooks/useApprovalPrediction";
import { approvalBadgeBg } from "@/engines/approvalEngine";
import { TrendingDown, Minus } from "lucide-react";
import { CinematicMetricHalo } from "@/components/cinematic";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useNeuroanalytics } from "@/hooks/useNeuroanalytics";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

type Tone = "primary" | "success" | "warn" | "danger" | "muted";

function ProgressOverview() {
  const navigate = useNavigate();
  const { trackAction } = useTelemetry();
  const { data: snap } = useAnalyticsSnapshot();
  const { data: coverage } = useCoverageStatus();
  const { data: goal } = useMonthlyGoal();
  const { data: core } = useCoreData();
  const { profile } = useNeuroanalytics();
  const prediction = useApprovalPrediction();

  // Score preditivo > snapshot legado (null se sem dados — exibe '—' honestamente)
  const approvalScoreRaw = prediction?.score ?? snap?.approvalScore ?? null;
  const approvalScore = approvalScoreRaw ?? 0;
  const hasApproval = approvalScoreRaw != null && approvalScoreRaw > 0;

  const coveragePctRaw = coverage?.requiredCoveragePct ?? null;
  const coveragePct = coveragePctRaw ?? 0;
  const hasCoverage = coverage != null;
  const goalPct = goal?.percentComplete ?? 0;

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

  // Drill-down inteligente: vai para a central de estudo/revisões
  const handleDrillDown = () => {
    trackAction('analytics_opened', { source: 'progress_overview' });
    navigate("/dashboard/sessao-estudo?source=progress_overview");
  };

  return (
    <div className="card-pixar group overflow-hidden">
      <div className="p-5 space-y-6 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
            Panorama de Desempenho
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDrillDown}
            className="h-8 text-[11px] font-black uppercase tracking-wider gap-1.5 text-[#00d2ff] hover:bg-white/5 hover:text-white rounded-full transition-all border border-white/5 px-4"
          >
            Análise detalhada <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Banner Preditivo de Aprovação */}
        {prediction && prediction.hasEnoughData && (
          <div className={`rounded-2xl border-0 px-5 py-4 flex items-center justify-between gap-4 shadow-xl ${approvalBadgeBg(prediction.riskLevel)} relative overflow-hidden group/prediction`}>
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/prediction:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 min-w-0 relative z-10">
              <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-lg border border-white/20">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-black leading-tight tracking-tight uppercase text-white">
                  Chance de aprovação: {prediction.score}%
                </p>
                <p className="text-[11px] font-bold opacity-90 leading-snug text-white/80 mt-0.5">
                  {prediction.message}
                </p>
              </div>
            </div>
            {prediction.delta !== null && (
              <div className="flex items-center gap-1.5 text-[14px] font-black tabular-nums flex-shrink-0 bg-white/20 px-3 py-1.5 rounded-full border border-white/20 text-white relative z-10">
                {prediction.trend === "up" && <TrendingUp className="h-4 w-4" />}
                {prediction.trend === "down" && <TrendingDown className="h-4 w-4" />}
                {prediction.trend === "stable" && <Minus className="h-4 w-4" />}
                {prediction.delta > 0 ? "+" : ""}{prediction.delta}
              </div>
            )}
          </div>
        )}

        {/* Bloco Neuroanalítico Enterprise+ */}
        {profile && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#9d50bb]/20">
                  <Brain className="h-4 w-4 text-[#9d50bb]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">Estado Cognitivo Adaptativo</span>
              </div>
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white/10 border-white/10 text-white/60 px-2 py-0">Active Engine</Badge>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-white/50">
                  <span>Score de Retenção</span>
                  <span className="text-[#00d2ff]">{Math.round((Number(profile.retention_score) || 0) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((Number(profile.retention_score) || 0) * 100)}%` }}
                    className="h-full bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-white/50">
                  <span>Limiar de Overload</span>
                  <span className="text-amber-500">{Math.round((Number(profile.overload_threshold) || 0) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((Number(profile.overload_threshold) || 0) * 100)}%` }}
                    className="h-full bg-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CinematicMetricHalo
            module="dashboard"
            icon={Target}
            label="Aprovação"
            value={approvalScore}
            displayValue={hasApproval ? undefined : "—"}
            suffix={hasApproval ? "%" : undefined}
            size="sm"
            subtitle={
              prediction?.daysToExam != null
                ? `${prediction.daysToExam}d até a prova`
                : hasApproval
                  ? (snap?.phase ? `Fase: ${snap.phase}` : "Acompanhe sua trajetória")
                  : "Sem dado suficiente — pratique para calibrar"
            }
            onClick={() => navigate("/dashboard/sessao-estudo?source=progress_overview_score")}
          />
          <CinematicMetricHalo
            module="planner"
            icon={ShieldCheck}
            label="Cobertura"
            value={coveragePct}
            displayValue={hasCoverage ? undefined : "—"}
            suffix={hasCoverage ? "%" : undefined}
            size="sm"
            subtitle={
              hasCoverage
                ? `${coverage!.requiredSeen}/${coverage!.requiredTopics} obrigatórios`
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
      </div>
    </div>
  );
}

export default memo(ProgressOverview);
