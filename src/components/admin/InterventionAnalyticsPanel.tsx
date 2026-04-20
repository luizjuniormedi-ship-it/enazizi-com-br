/**
 * InterventionAnalyticsPanel — Métricas do Intervention Engine
 * ────────────────────────────────────────────────────────────
 * Painel admin (read-only) que mostra desempenho das próximas ações
 * sugeridas pelo `useInterventionEngine`. Lê `alert_events`
 * (source = "intervention") e agrega via `useInterventionAnalytics`.
 *
 * Não altera o Intervention Engine, telemetria ou Alert Orchestrator.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  RefreshCw,
  Trophy,
  AlertTriangle,
  Target,
  Activity,
} from "lucide-react";
import {
  useInterventionAnalytics,
  type InterventionMetrics,
} from "@/hooks/useInterventionAnalytics";

const TYPE_LABEL: Record<string, string> = {
  "min-mission": "🚨 Missão destrava",
  fsrs: "📚 Revisões FSRS",
  recovery: "📉 Recuperação",
  coverage: "🔥 Cobertura",
  default: "🟢 Default",
  unknown: "❔ Desconhecido",
};

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function MetricStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Bar({
  pct,
  color,
}: {
  pct: number; // 0..1
  color: string;
}) {
  return (
    <div className="h-2 bg-muted rounded overflow-hidden w-full">
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
      />
    </div>
  );
}

function HighlightCard({
  title,
  metric,
  tone,
  icon: Icon,
  metricKey,
}: {
  title: string;
  metric: InterventionMetrics | null;
  tone: "good" | "bad" | "info";
  icon: React.ComponentType<{ className?: string }>;
  metricKey: "ctr" | "conversionRate";
}) {
  const toneClasses =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "bad"
        ? "border-destructive/30 bg-destructive/5"
        : "border-primary/30 bg-primary/5";
  const iconColor =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "text-primary";
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${toneClasses}`}>
      <div className="text-xs font-semibold flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        {title}
      </div>
      {metric ? (
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {TYPE_LABEL[metric.type] ?? metric.type}
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtPct(metric[metricKey])}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {metric.exposed} exposições · {metric.clicked} cliques
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">
          Sem amostra suficiente
        </div>
      )}
    </div>
  );
}

export default function InterventionAnalyticsPanel() {
  const [windowDays, setWindowDays] = useState(7);
  const { data, isLoading, isError, refetch, isFetching } =
    useInterventionAnalytics(windowDays);

  const empty = !data || data.byType.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Intervention Engine — Métricas
            <Badge variant="outline" className="ml-1 text-[10px]">
              {windowDays}d
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={windowDays === d ? "default" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setWindowDays(d)}
              >
                {d}d
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-6 text-center">
            Carregando métricas…
          </div>
        ) : isError ? (
          <div className="text-xs text-destructive py-6 text-center">
            Falha ao carregar métricas. Tente novamente.
          </div>
        ) : empty ? (
          <div className="text-xs text-muted-foreground py-6 text-center italic">
            Nenhuma intervenção registrada ainda neste período.
          </div>
        ) : (
          <>
            {/* Seção 1 — KPIs globais */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricStat
                label="Exposições"
                value={data.global.totalExposed}
                icon={Activity}
              />
              <MetricStat
                label="Cliques"
                value={data.global.totalClicked}
                icon={Target}
              />
              <MetricStat
                label="Conversões"
                value={data.global.totalResolved}
                hint="resolved"
              />
              <MetricStat
                label="CTR global"
                value={fmtPct(data.global.globalCtr)}
              />
              <MetricStat
                label="Conversão global"
                value={fmtPct(data.global.globalConversion)}
              />
            </div>

            {/* Seção 3 — Destaques (vem antes da tabela para leitura rápida) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <HighlightCard
                title="🔥 Melhor performer (CTR)"
                metric={data.global.bestByCtr}
                tone="good"
                icon={Trophy}
                metricKey="ctr"
              />
              <HighlightCard
                title="⚠️ Pior performer (CTR)"
                metric={data.global.worstByCtr}
                tone="bad"
                icon={AlertTriangle}
                metricKey="ctr"
              />
              <HighlightCard
                title="🧠 Maior conversão"
                metric={data.global.bestByConversion}
                tone="info"
                icon={Sparkles}
                metricKey="conversionRate"
              />
            </div>

            {/* Seção 2 — Tabela por tipo */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Exposições</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byType.map((m) => {
                    const lowSample = m.exposed < 5;
                    return (
                      <TableRow key={m.type}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{TYPE_LABEL[m.type] ?? m.type}</span>
                            {lowSample && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0"
                              >
                                low n
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.exposed}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.clicked}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtPct(m.ctr)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtPct(m.conversionRate)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Seção 4 — Ranking visual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  CTR por tipo
                </div>
                <div className="space-y-2">
                  {data.byType.map((m) => (
                    <div key={`ctr-${m.type}`} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">
                          {TYPE_LABEL[m.type] ?? m.type}
                        </span>
                        <span className="font-mono tabular-nums">
                          {fmtPct(m.ctr)}
                        </span>
                      </div>
                      <Bar pct={m.ctr} color="bg-primary" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Conversão por tipo
                </div>
                <div className="space-y-2">
                  {data.byType.map((m) => (
                    <div key={`conv-${m.type}`} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">
                          {TYPE_LABEL[m.type] ?? m.type}
                        </span>
                        <span className="font-mono tabular-nums">
                          {fmtPct(m.conversionRate)}
                        </span>
                      </div>
                      <Bar pct={m.conversionRate} color="bg-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
