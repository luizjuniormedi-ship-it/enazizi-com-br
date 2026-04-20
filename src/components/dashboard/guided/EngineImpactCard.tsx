import { useState } from "react";
import {
  Activity, ChevronDown, ChevronUp, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Target, ListChecks, CheckCircle2, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudyEngineImpact, type Trend } from "@/hooks/useStudyEngineImpact";
import { getCalibrationLabel, STUDY_ENGINE_CALIBRATION_MODE } from "@/lib/studyEngineCalibration";

const TrendIcon = ({ trend }: { trend: Trend }) => {
  if (trend === "improving") return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (trend === "declining") return <TrendingDown className="h-3 w-3 text-destructive" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

/**
 * EngineImpactCard — auditoria de impacto do Study Engine V3.
 * Mostra resultado real, atuação do motor e diagnóstico curto.
 */
const EngineImpactCard = () => {
  const { data, isLoading } = useStudyEngineImpact();
  const [showDebug, setShowDebug] = useState(false);

  if (isLoading || !data) return null;

  const {
    questions7d, questions30d, requiredCoveragePct, criticalGapsCount,
    completionRate7d, engineAdjustments, recentSnapshots, status, trend,
  } = data;

  // Diagnóstico curto
  const diagnostics: string[] = [];
  if (recentSnapshots.length === 0) {
    diagnostics.push("Telemetria do motor ainda não está chegando do edge principal");
  }
  if (engineAdjustments.goalBoosts > 0 && questions7d < 50)
    diagnostics.push("Meta está influenciando o motor, mas não a execução");
  else if (engineAdjustments.goalBoosts > 0)
    diagnostics.push("Motor puxando mais questões por atraso de meta");
  if (engineAdjustments.coverageBoosts === 0 && recentSnapshots.length >= 3 && criticalGapsCount > 0)
    diagnostics.push("Boost de cobertura sem efeito observável");
  else if (engineAdjustments.coverageBoosts > 0)
    diagnostics.push("Motor puxando cobertura por gaps obrigatórios");
  if (engineAdjustments.examPressureBoosts > 0)
    diagnostics.push("Reta final: revisão e questões dominando");
  if (diagnostics.length === 0 && status === "inactive")
    diagnostics.push("O motor ainda não gerou impacto observável nas prioridades recentes");
  if (status === "insufficient_data" && recentSnapshots.length === 0)
    diagnostics.push("Use o Tutor ou pratique questões — cada decisão registra um snapshot");

  // Leitura da calibração — qual sinal está dominando
  const totalBoosts =
    engineAdjustments.coverageBoosts +
    engineAdjustments.goalBoosts +
    engineAdjustments.examPressureBoosts +
    engineAdjustments.approvalRiskBoosts +
    engineAdjustments.approvalDownBoosts +
    engineAdjustments.approvalLowBoosts;
  let calibrationReading = "";
  if (totalBoosts === 0) {
    calibrationReading = "Sem boosts recentes";
  } else {
    const candidates: Array<[string, number]> = [
      ["Reta final dominante", engineAdjustments.examPressureBoosts],
      ["Coverage dominante", engineAdjustments.coverageBoosts],
      ["Meta mensal dominante", engineAdjustments.goalBoosts],
      ["Risco de aprovação dominante", engineAdjustments.approvalRiskBoosts],
      ["Tendência de queda dominante", engineAdjustments.approvalDownBoosts],
      ["Aprovação favorável dominante", engineAdjustments.approvalLowBoosts],
    ];
    candidates.sort((a, b) => b[1] - a[1]);
    const [dominantLabel, dominantVal] = candidates[0];
    const ratio = dominantVal / totalBoosts;
    calibrationReading = ratio < 0.45 ? "Motor bem distribuído" : dominantLabel;
  }

  // Alertas
  const alerts: string[] = [];
  if (requiredCoveragePct > 0 && requiredCoveragePct < 70)
    alerts.push(`Cobertura obrigatória baixa (${requiredCoveragePct}%)`);
  if (questions30d < 2000)
    alerts.push(`Volume abaixo da meta (${questions30d}/2000 em 30d)`);
  if (completionRate7d < 30 && data.tasksCreated7d > 0)
    alerts.push(`Taxa de conclusão baixa (${completionRate7d}%)`);

  const statusBadge =
    status === "active"
      ? { label: "Ativo", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" }
      : status === "inactive"
      ? { label: "Sem impacto", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" }
      : { label: "Coletando", color: "text-muted-foreground", bg: "bg-muted" };

  return (
    <div className="glass-card p-5 border-primary/10 md:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">Impacto do motor adaptativo</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge.bg} ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Bloco 1 — Resultado atual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="rounded-md px-2 py-1.5 bg-muted/40">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Questões 30d
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-foreground">
            {questions30d.toLocaleString("pt-BR")}
            <TrendIcon trend={trend.questions} />
          </div>
          <div className="text-[10px] text-muted-foreground">{questions7d} nos últimos 7d</div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-muted/40">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="h-3 w-3" /> Cobertura
          </div>
          <div className="text-sm font-bold text-foreground">{requiredCoveragePct}%</div>
          <div className="text-[10px] text-muted-foreground">{criticalGapsCount} gaps críticos</div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-muted/40">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> Conclusão 7d
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-foreground">
            {completionRate7d}%
            <TrendIcon trend={trend.completion} />
          </div>
          <div className="text-[10px] text-muted-foreground">
            {data.tasksCompleted7d}/{data.tasksCreated7d} tarefas
          </div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-muted/40">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gauge className="h-3 w-3" /> Snapshots
          </div>
          <div className="text-sm font-bold text-foreground">{recentSnapshots.length}</div>
          <div className="text-[10px] text-muted-foreground">decisões observadas</div>
        </div>
      </div>

      {/* Bloco 2 — Atuação do motor */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="rounded-md px-2 py-1.5 bg-blue-500/10">
          <div className="text-[10px] text-muted-foreground">🎯 Cobertura</div>
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {engineAdjustments.coverageBoosts}
          </div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-primary/10">
          <div className="text-[10px] text-muted-foreground">📊 Meta</div>
          <div className="text-sm font-bold text-primary">
            {engineAdjustments.goalBoosts}
          </div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-amber-500/10">
          <div className="text-[10px] text-muted-foreground">⏱️ Prova</div>
          <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
            {engineAdjustments.examPressureBoosts}
          </div>
        </div>
      </div>

      {/* Bloco 2b — Aprovação preditiva (V3.2) */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-md px-2 py-1.5 bg-destructive/10">
          <div className="text-[10px] text-muted-foreground">🚨 Risco</div>
          <div className="text-sm font-bold text-destructive">
            {engineAdjustments.approvalRiskBoosts}
          </div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-orange-500/10">
          <div className="text-[10px] text-muted-foreground">📉 Tendência</div>
          <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
            {engineAdjustments.approvalDownBoosts}
          </div>
        </div>
        <div className="rounded-md px-2 py-1.5 bg-emerald-500/10">
          <div className="text-[10px] text-muted-foreground">🟢 Aprovação favorável</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {engineAdjustments.approvalLowBoosts}
          </div>
        </div>
      </div>

      {/* Bloco 3 — Diagnóstico */}
      {diagnostics.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2 leading-tight">
          🧭 {diagnostics[0]}
        </div>
      )}

      {/* Leitura da calibração */}
      <div className="text-[11px] text-muted-foreground mb-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <span>⚙️ {calibrationReading}</span>
        <span className="opacity-70">{getCalibrationLabel(STUDY_ENGINE_CALIBRATION_MODE)}</span>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-1 mb-3">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-md px-2 py-1">
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Debug colapsável */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs gap-1"
        onClick={() => setShowDebug(v => !v)}
      >
        {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Ver detalhes do motor
      </Button>

      {showDebug && (
        <div className="mt-3 space-y-2">
          {recentSnapshots.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum snapshot recente.</p>
          )}
          {recentSnapshots.slice(0, 3).map((snap, i) => (
            <div key={i} className="border border-border rounded-md p-2 bg-muted/20">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>{new Date(snap.created_at).toLocaleString("pt-BR")}</span>
                <span>
                  🎯 {snap.boost_totals.coverageBoosts} · 📊 {snap.boost_totals.goalBoosts} · ⏱️ {snap.boost_totals.examPressureBoosts}
                  {" · "}🚨 {snap.boost_totals.approvalRiskBoosts} · 📉 {snap.boost_totals.approvalDownBoosts} · 🟢 {snap.boost_totals.approvalLowBoosts}
                </span>
              </div>
              <div className="space-y-0.5">
                {snap.top_recommendations.slice(0, 5).map((rec: any, j: number) => (
                  <div key={j} className="text-[11px] flex items-center justify-between gap-2">
                    <span className="truncate text-foreground">
                      <span className="text-muted-foreground">[{rec.type ?? "?"}]</span>{" "}
                      {rec.topic ?? "—"}
                    </span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {rec.base_priority ?? "?"} → <span className="text-primary font-semibold">{rec.final_priority ?? "?"}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EngineImpactCard;
