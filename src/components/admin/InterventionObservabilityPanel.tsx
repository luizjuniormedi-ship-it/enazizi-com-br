/**
 * InterventionObservabilityPanel — Fase 7
 * ────────────────────────────────────────
 * Painel admin read-only que mostra a saúde do Intervention Engine em
 * produção real, com janelas (1d/7d/14d/30d) e alertas automáticos.
 *
 * Não muta engine, não recalibra pesos. Apenas observa.
 */
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Info,
  MousePointerClick,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  useInterventionObservability,
  type ObservabilityWindow,
} from "@/hooks/useInterventionObservability";

const TYPE_LABEL: Record<string, string> = {
  "min-mission": "🚨 Missão destrava",
  fsrs: "📚 Revisões FSRS",
  recovery: "⚠️ Recuperação",
  coverage: "📊 Cobertura",
  default: "✨ Continue",
};

const REASON_LABEL: Record<string, string> = {
  mandatory: "🔒 Mandatory",
  base: "⚖️ Base",
  adaptive: "📈 Adaptive",
  penalty: "🛑 Penalty",
  profile: "👤 Profile",
  mixed: "🔀 Mixed",
  unknown: "❔ Unknown",
};

const SIGNAL_LABEL: Record<string, string> = {
  "profile-driven": "👤 Profile-driven",
  "penalty-driven": "🛑 Penalty-driven",
  "mandatory-driven": "🔒 Mandatory-driven",
  "neutral-driven": "⚪ Neutral-driven",
};

function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}
function formatRate(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function alertVariant(level: "warn" | "critical" | "info") {
  if (level === "critical")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (level === "warn")
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-primary/5 text-primary border-primary/30";
}

export default function InterventionObservabilityPanel() {
  const [windowSel, setWindowSel] = useState<ObservabilityWindow>("7d");
  const { data, isLoading, error } = useInterventionObservability(windowSel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <Activity className="h-5 w-5 text-primary" />
          Intervention Observability (Fase 7)
          <Badge variant="outline" className="ml-auto text-xs">
            read-only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs
          value={windowSel}
          onValueChange={(v) => setWindowSel(v as ObservabilityWindow)}
        >
          <TabsList className="grid grid-cols-4 w-full sm:w-fit">
            <TabsTrigger value="1d">24h</TabsTrigger>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="14d">14d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando métricas…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro: {error}</p>
        ) : !data || data.totalExposed === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda sem exposições neste período. Os dados aparecem quando os
            usuários começarem a interagir.
          </p>
        ) : (
          <>
            {/* ─── Alertas ─── */}
            {data.alerts.length > 0 && (
              <div className="space-y-2">
                {data.alerts.map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${alertVariant(a.level)}`}
                  >
                    {a.level === "critical" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : a.level === "warn" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
            {data.alerts.length === 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Nenhum alerta detectado nesta janela.</span>
              </div>
            )}

            {/* ─── KPIs globais ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Kpi icon={<Eye className="h-4 w-4" />} label="Exposed" value={data.totalExposed.toString()} />
              <Kpi icon={<MousePointerClick className="h-4 w-4" />} label="Clicked" value={data.totalClicked.toString()} />
              <Kpi icon={<Target className="h-4 w-4" />} label="Resolved" value={data.totalResolved.toString()} />
              <Kpi icon={<TrendingUp className="h-4 w-4" />} label="CTR global" value={formatRate(data.ctrGlobal)} />
              <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Conv. global" value={formatRate(data.conversionGlobal)} />
            </div>

            {/* ─── Tabela por tipo ─── */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Distribuição por tipo</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Exposed</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Resolved</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byType.map((r) => (
                      <TableRow key={r.type}>
                        <TableCell className="font-medium">
                          {TYPE_LABEL[r.type] ?? r.type}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.exposed}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.clicked}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.resolved}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRate(r.ctr)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRate(r.conversionRate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Badge
                            variant="outline"
                            className={
                              r.sharePct >= 45
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : ""
                            }
                          >
                            {formatPct(r.sharePct)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ─── Winning reason + Profile signal ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-semibold mb-2">Por motivo da vitória</h4>
                {data.byWinningReason.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aguardando eventos com `wonBy` (telemetria nova).
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {data.byWinningReason.map((r) => (
                      <div key={r.reason} className="flex items-center gap-2 text-sm">
                        <span className="w-32 shrink-0 text-muted-foreground">
                          {REASON_LABEL[r.reason] ?? r.reason}
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, r.pct)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-20 text-right">
                          {r.count} ({formatPct(r.pct)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-semibold mb-2">Por sinal de perfil</h4>
                <div className="space-y-1.5">
                  {data.byProfileSignal.map((s) => (
                    <div key={s.group} className="flex items-center gap-2 text-sm">
                      <span className="w-36 shrink-0 text-muted-foreground">
                        {SIGNAL_LABEL[s.group] ?? s.group}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/70"
                          style={{ width: `${Math.min(100, s.pct)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-20 text-right">
                        {s.count} ({formatPct(s.pct)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Integrity & health ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                  <Shield className="h-3.5 w-3.5" /> Mandatory integrity
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatPct(data.mandatoryIntegrity.integrityPct, 1)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.mandatoryIntegrity.mandatoryWins}/{data.mandatoryIntegrity.casesWithMandatory} cenários
                  {data.mandatoryIntegrity.violations > 0 && (
                    <span className="text-destructive ml-1">
                      · {data.mandatoryIntegrity.violations} violação(ões)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Penalty health
                </div>
                <div className="text-sm space-y-0.5">
                  <div>
                    Ativas: <span className="font-semibold">{data.penaltyStats.activePenalties}</span>
                  </div>
                  <div>
                    Exposições c/ penalty: <span className="font-semibold">{data.penaltyStats.appliedExposures}</span>
                  </div>
                  <div>
                    Resets por clique: <span className="font-semibold">{data.penaltyStats.resetClicks}</span>
                  </div>
                  {data.penaltyStats.mostPenalizedType && (
                    <div className="text-xs text-muted-foreground">
                      mais penalizado: {TYPE_LABEL[data.penaltyStats.mostPenalizedType] ?? data.penaltyStats.mostPenalizedType}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                  <Target className="h-3.5 w-3.5" /> Profile health
                </div>
                <div className="text-sm space-y-0.5">
                  <div>
                    profileDelta ≠ 0: <span className="font-semibold">{data.profileStats.nonZeroProfileDelta}</span>
                  </div>
                  <div>
                    profileDelta &gt; 0: <span className="font-semibold">{data.profileStats.positiveProfileDelta}</span>
                  </div>
                  <div>
                    strong-individual: <span className="font-semibold">{data.profileStats.strongIndividualHits}</span>
                  </div>
                  {data.profileStats.topPromotedTypes.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      top promovidos:{" "}
                      {data.profileStats.topPromotedTypes
                        .map((t) => `${TYPE_LABEL[t.type] ?? t.type} (${t.count})`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
