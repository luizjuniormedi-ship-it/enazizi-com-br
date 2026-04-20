/**
 * /admin/validation
 * ─────────────────
 * Painel interno de validação do Study Engine V3.2 + Approval Prediction.
 * Apenas leitura. Não altera o sistema.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useValidationMetrics } from "@/hooks/useValidationMetrics";
import AlertOrchestratorDebug from "@/components/admin/AlertOrchestratorDebug";
import AlertOrchestratorAnalytics from "@/components/admin/AlertOrchestratorAnalytics";
import AlertConversionPanel from "@/components/admin/AlertConversionPanel";
import AlertCorrelationPanel from "@/components/admin/AlertCorrelationPanel";
import InterventionAnalyticsPanel from "@/components/admin/InterventionAnalyticsPanel";
import {
  Users,
  Activity,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  RefreshCw,
} from "lucide-react";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function BucketBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

export default function ValidationDashboard() {
  const { data: m, isLoading, isError, refetch, isFetching } =
    useValidationMetrics();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !m) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">
              Falha ao carregar métricas. Tente novamente.
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Recarregar
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const empty = m.approval.sampleSize === 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Painel de Validação</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento Study Engine V3.2 + Approval Prediction
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {empty && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 text-xs text-amber-700 dark:text-amber-300">
            Sem snapshots de aprovação ainda. As métricas aparecem assim que o
            Study Engine começa a registrar decisões.
          </CardContent>
        </Card>
      )}

      {/* Seção 1 — Visão Geral */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Visão Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Ativos 1d" value={m.activeUsers.d1} />
            <Stat label="Ativos 7d" value={m.activeUsers.d7} />
            <Stat label="Ativos 30d" value={m.activeUsers.d30} />
            <Stat
              label="Atividade média (7d)"
              value={`${m.avgActivity.questionsPerUser7d}q`}
              hint={`${m.avgActivity.reviewsPerUser7d} revisões/usuário`}
            />
            <Stat
              label="Missão · taxa início"
              value={`${m.missions.startRatePct}%`}
              hint="usuários ativos com tarefa"
            />
            <Stat
              label="Missão · taxa conclusão"
              value={`${m.missions.completionRatePct}%`}
              hint="tarefas concluídas / total"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção 2 — Approval Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Distribuição do Approval Score
            <Badge variant="outline" className="ml-2 text-[10px]">
              n = {m.approval.sampleSize}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Média" value={m.approval.mean} />
            <Stat label="Mediana" value={m.approval.median} />
            <Stat label="Mín" value={m.approval.min} />
            <Stat label="Máx" value={m.approval.max} />
          </div>
          <div className="space-y-2">
            <BucketBar
              label="🟢 Baixo risco (70–100)"
              pct={m.approval.bucketsPct.low}
              color="bg-emerald-500"
            />
            <BucketBar
              label="🟡 Médio (40–70)"
              pct={m.approval.bucketsPct.medium}
              color="bg-amber-500"
            />
            <BucketBar
              label="🔴 Alto risco (0–40)"
              pct={m.approval.bucketsPct.high}
              color="bg-destructive"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seções 3 + 4 — Tendência e Risco */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Tendência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="↑ Up" value={`${m.trend.upPct}%`} />
              <Stat label="→ Stable" value={`${m.trend.stablePct}%`} />
              <Stat label="↓ Down" value={`${m.trend.downPct}%`} />
            </div>
            <div className="text-xs text-muted-foreground">
              Delta médio: <span className="font-mono">{m.trend.avgDelta > 0 ? "+" : ""}{m.trend.avgDelta}</span> pts
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat
              label="% em risco alto"
              value={`${m.risk.highRiskPct}%`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Saíram (7d)"
                value={m.risk.leftHighRisk7d}
                hint="↗ vitória do motor"
              />
              <Stat
                label="Entraram (7d)"
                value={m.risk.enteredHighRisk7d}
                hint="↘ degradação"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção 5 — Impacto do Motor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" /> Impacto do Motor (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat
              label="🚨 Risco boosts"
              value={m.engineImpact.approvalRiskBoosts}
            />
            <Stat
              label="📉 Trend boosts"
              value={m.engineImpact.approvalDownBoosts}
            />
            <Stat
              label="🟢 Low boosts"
              value={m.engineImpact.approvalLowBoosts}
            />
            <Stat label="Usuários" value={m.engineImpact.totalUsers} />
            <Stat
              label="Boosts/usuário"
              value={m.engineImpact.avgPerUser}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção 6 — Comportamento Real */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Comportamento por Risco (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-destructive">
                🔴 Risco alto · {m.behavior.highRisk.users} usuários
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Q/dia" value={m.behavior.highRisk.qPerDay} />
                <Stat label="R/dia" value={m.behavior.highRisk.rPerDay} />
                <Stat
                  label="Missão %"
                  value={`${m.behavior.highRisk.missionCompletionPct}%`}
                />
              </div>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                🟢 Risco baixo · {m.behavior.lowRisk.users} usuários
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Q/dia" value={m.behavior.lowRisk.qPerDay} />
                <Stat label="R/dia" value={m.behavior.lowRisk.rPerDay} />
                <Stat
                  label="Missão %"
                  value={`${m.behavior.lowRisk.missionCompletionPct}%`}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 7 — Antes vs Depois */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Antes vs Depois (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Usuários c/ histórico"
              value={m.beforeAfter.usersWithHistory}
            />
            <Stat
              label="Evolução média"
              value={`${m.beforeAfter.avgEvolution7d > 0 ? "+" : ""}${m.beforeAfter.avgEvolution7d}`}
              hint="pontos no approval_score"
            />
            <Stat
              label="📈 Melhoraram"
              value={`${m.beforeAfter.improvedPct}%`}
            />
            <Stat
              label="📉 Pioraram"
              value={`${m.beforeAfter.worsenedPct}%`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Intervention Engine — métricas das próximas ações sugeridas */}
      <InterventionAnalyticsPanel />

      {/* Alert Orchestrator — métricas, conversão, correlação e inspeção interna */}
      <AlertOrchestratorAnalytics />
      <AlertConversionPanel />
      <AlertCorrelationPanel />
      <AlertOrchestratorDebug />
    </div>
  );
}
