/**
 * AlertOrchestratorAnalytics — painel admin de métricas e fadiga
 * ───────────────────────────────────────────────────────────────
 * Consome `useAlertAnalytics` (tabela `alert_events`) e mostra:
 *   - KPIs globais (exposições, cliques, dismisses, supressões, CTR)
 *   - Fadiga: sources com fatigueScore >= 70
 *   - Tabela detalhada por source (CTR, dismiss rate, supressão, prioridade)
 *
 * Trata empty state, loading e erro. Read-only.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  AlertOctagon,
  Eye,
  MousePointerClick,
  XCircle,
  ShieldOff,
  RefreshCw,
} from "lucide-react";
import {
  useAlertAnalytics,
  type AlertSourceMetrics,
} from "@/hooks/useAlertAnalytics";

const PRIORITY_VARIANT: Record<
  string,
  "default" | "destructive" | "secondary" | "outline"
> = {
  critical: "destructive",
  important: "default",
  contextual: "secondary",
  informational: "outline",
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function FatigueBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge variant="destructive">{score} • alta</Badge>;
  if (score >= 40) return <Badge variant="default">{score} • média</Badge>;
  if (score >= 15) return <Badge variant="secondary">{score} • leve</Badge>;
  return <Badge variant="outline">{score}</Badge>;
}

function SourceRow({ m }: { m: AlertSourceMetrics }) {
  return (
    <tr className="border-t">
      <td className="p-2 font-mono text-xs">{m.source}</td>
      <td className="p-2">
        {m.dominantPriority ? (
          <Badge variant={PRIORITY_VARIANT[m.dominantPriority]}>
            {m.dominantPriority}
          </Badge>
        ) : (
          "—"
        )}
      </td>
      <td className="p-2 text-xs text-muted-foreground">
        {m.dominantLayer ?? "—"}
      </td>
      <td className="p-2 text-right tabular-nums">{m.exposed}</td>
      <td className="p-2 text-right tabular-nums">{m.clicked}</td>
      <td className="p-2 text-right tabular-nums">{m.dismissed}</td>
      <td className="p-2 text-right tabular-nums">{m.suppressed}</td>
      <td className="p-2 text-right tabular-nums">{pct(m.ctr)}</td>
      <td className="p-2 text-right tabular-nums">{pct(m.dismissRate)}</td>
      <td className="p-2 text-right tabular-nums">
        {pct(m.suppressionRate)}
      </td>
      <td className="p-2">
        <FatigueBadge score={m.fatigueScore} />
      </td>
    </tr>
  );
}

export default function AlertOrchestratorAnalytics() {
  const [windowDays, setWindowDays] = useState(7);
  const analytics = useAlertAnalytics({ windowDays });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Alert Orchestrator — métricas & fadiga
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={String(windowDays)}
              onValueChange={(v) => setWindowDays(Number(v))}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={analytics.refresh}
              disabled={analytics.loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  analytics.loading ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs globais */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi
            icon={Eye}
            label="Exposições"
            value={analytics.totalExposed}
          />
          <Kpi
            icon={MousePointerClick}
            label="Cliques"
            value={analytics.totalClicked}
          />
          <Kpi icon={XCircle} label="Dismisses" value={analytics.totalDismissed} />
          <Kpi
            icon={ShieldOff}
            label="Supressões"
            value={analytics.totalSuppressed}
          />
          <Kpi
            icon={BarChart3}
            label="CTR global"
            value={pct(analytics.globalCtr)}
          />
        </div>

        {analytics.error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            Erro ao carregar telemetria: {analytics.error}
          </div>
        )}

        {/* Sinais de fadiga */}
        {analytics.fatigueAlerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertOctagon className="h-4 w-4 text-destructive" />
              Sinais de fadiga ({analytics.fatigueAlerts.length})
            </div>
            <div className="space-y-1.5">
              {analytics.fatigueAlerts.map((m) => (
                <div
                  key={m.source}
                  className="flex items-center justify-between text-xs bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-mono">{m.source}</span>
                    <span className="text-muted-foreground">
                      {m.exposed} exposições • CTR {pct(m.ctr)} • dismiss{" "}
                      {pct(m.dismissRate)}
                    </span>
                  </div>
                  <FatigueBadge score={m.fatigueScore} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela por source */}
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Source</th>
                <th className="p-2">Prioridade dom.</th>
                <th className="p-2">Camada dom.</th>
                <th className="p-2 text-right">Exposed</th>
                <th className="p-2 text-right">Clicks</th>
                <th className="p-2 text-right">Dismiss</th>
                <th className="p-2 text-right">Suppr.</th>
                <th className="p-2 text-right">CTR</th>
                <th className="p-2 text-right">Dismiss%</th>
                <th className="p-2 text-right">Suppr.%</th>
                <th className="p-2">Fadiga</th>
              </tr>
            </thead>
            <tbody>
              {analytics.loading && analytics.bySource.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Carregando…
                  </td>
                </tr>
              )}
              {!analytics.loading && analytics.bySource.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Nenhum evento registrado nesta janela.
                  </td>
                </tr>
              )}
              {analytics.bySource.map((m) => (
                <SourceRow key={m.source} m={m} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Janela:</strong> últimos {analytics.windowDays} dias •{" "}
          <strong>Total de eventos:</strong> {analytics.totalEvents} •{" "}
          <strong>Fadiga ≥ 70:</strong> exposição alta (≥20) com CTR &lt; 5%, ou
          dismiss rate ≥ 60%, ou supressão ≥ 50%.
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border rounded-md p-2.5 bg-card">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
