import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from "recharts";
import {
  Loader2, TrendingUp, Users, AlertCircle, Download, RefreshCw,
  Smartphone, MessageSquare, Activity, Target, Brain, HeartPulse,
} from "lucide-react";
import { TelemetryHealthCheck } from "./TelemetryHealthCheck";
import { ScientificAuditDashboard } from "@/components/admin/audit/ScientificAuditDashboard";
import { toast } from "sonner";

type Severity = "low" | "medium" | "high" | "critical";

interface Alert {
  severity: Severity;
  title: string;
  metric: string;
  current_value: number;
  threshold: number;
  recommendation: string;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  low: "border-blue-500/40 bg-blue-500/5",
  medium: "border-yellow-500/40 bg-yellow-500/5",
  high: "border-orange-500/40 bg-orange-500/5",
  critical: "border-red-500/40 bg-red-500/5",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico",
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, rows: any[]) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")].concat(
    rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TelemetryAdmin = () => {
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any>(null);
  const [tutorQ, setTutorQ] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [baseline, setBaseline] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [optReport, setOptReport] = useState<any>(null);

  async function loadAll() {
    setRefreshing(true);
    const [f, c, t, h, b, a, r, o] = await Promise.all([
      supabase.rpc("admin_telemetry_funnel", { _days: days }),
      supabase.rpc("admin_telemetry_cohorts", { _days: days }),
      supabase.rpc("admin_telemetry_tutor_quality", { _days: days }),
      supabase.rpc("admin_telemetry_heatmap", { _days: days }),
      supabase.rpc("admin_telemetry_baseline"),
      supabase.rpc("admin_telemetry_alerts", { _days: days }),
      supabase.from("telemetry_events")
        .select("*").order("timestamp", { ascending: false }).limit(15),
      supabase.rpc("admin_telemetry_optimization_report", { _days: days }),
    ]);

    const funnelRows = (f.data ?? []).map((row: any, i: number) => ({
      name: row.stage,
      value: Number(row.value),
      fill: ["hsl(var(--primary))", "hsl(var(--primary)/0.85)", "hsl(var(--primary)/0.7)", "hsl(var(--primary)/0.55)", "hsl(var(--primary)/0.4)"][i] ?? "hsl(var(--primary))",
    }));

    setFunnel(funnelRows);
    setCohorts(c.data ?? {});
    setTutorQ(t.data ?? {});
    setHeatmap((h.data ?? []) as any[]);
    setBaseline(b.data ?? {});
    setAlerts((a.data as unknown as Alert[]) ?? []);
    setRecent(r.data ?? []);
    setOptReport(o.data ?? {});
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [days]);

  const baselineStatus = baseline?.status as string | undefined;
  const statusColor = baselineStatus === "PRONTO" ? "bg-green-500/15 text-green-600 border-green-500/30"
    : baselineStatus === "EM COLETA" ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/30"
    : "bg-muted text-muted-foreground";

  async function handleExport(kind: "raw" | "funnel" | "cohorts" | "alerts" | "tutor" | "pedagogy" | "health") {
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "raw") {
      const { data } = await supabase.rpc("admin_telemetry_export", { _days: days, _limit: 10000 });
      downloadCSV(`telemetria_eventos_${stamp}.csv`, data ?? []);
    } else if (kind === "funnel") {
      downloadCSV(`telemetria_funil_${stamp}.csv`, funnel.map(r => ({ stage: r.name, value: r.value })));
    } else if (kind === "cohorts") {
      const rows = (cohorts?.by_device ?? []) as any[];
      downloadCSV(`telemetria_coortes_${stamp}.csv`, rows);
    } else if (kind === "alerts") {
      downloadCSV(`telemetria_alertas_${stamp}.csv`, alerts);
    } else if (kind === "tutor") {
      const { data: aiRes } = await supabase.rpc('admin_telemetry_v2_ai_quality', { _days: days });
      downloadCSV(`telemetria_tutor_v2_${stamp}.csv`, [aiRes ?? {}]);
    } else if (kind === "pedagogy") {
      const { data: pedRes } = await supabase.rpc('admin_telemetry_v2_pedagogy', { _days: days });
      downloadCSV(`telemetria_pedagogica_${stamp}.csv`, [pedRes ?? {}]);
    } else if (kind === "health") {
      downloadCSV(`telemetria_health_${stamp}.csv`, [baseline ?? {}]);
    }
  }

  const heatmapTop = useMemo(() => heatmap.slice(0, 25), [heatmap]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telemetria Pedagógica</h1>
          <p className="text-muted-foreground">Inteligência operacional baseada em comportamento real do aluno.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("raw")}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </header>

      {/* Baseline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Baseline real</CardTitle>
            <CardDescription>Status da coleta para decisões orientadas a dados</CardDescription>
          </div>
          {baselineStatus && (
            <Badge variant="outline" className={`text-xs ${statusColor}`}>{baselineStatus}</Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
            <Stat label="Dias coletados" value={baseline?.days_collected ?? 0} />
            <Stat label="Eventos" value={baseline?.total_events ?? 0} />
            <Stat label="Usuários únicos" value={baseline?.unique_users ?? 0} />
            <Stat label="Sessões" value={baseline?.sessions_started ?? 0} />
            <Stat label="1ª questão" value={baseline?.first_questions ?? 0} />
            <Stat label="Retenção D1" value={`${baseline?.retention_d1 ?? 0}%`} />
            <Stat label="Retenção D7" value={`${baseline?.retention_d7 ?? 0}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Alertas de funil</CardTitle>
            <CardDescription>Sinais automáticos de fricção e abandono</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => handleExport("alerts")}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum alerta crítico no período. ✅</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map((a, i) => (
                <div 
                  key={i} 
                  className={`border rounded-lg p-4 cursor-pointer hover:opacity-80 transition-opacity ${SEVERITY_STYLES[a.severity]}`}
                  onClick={() => {
                    // Logic to find or create an incident based on alert
                    // For now, redirect to a filtered incident list or search
                    toast.info("Abrindo detalhes do incidente...");
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <Badge variant="outline" className="text-[10px]">{SEVERITY_LABEL[a.severity]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    <span className="font-mono">{a.metric}</span>: {a.current_value} (limite: {a.threshold})
                  </p>
                  <p className="text-xs">{a.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs principais */}
      <Tabs defaultValue="lec" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-8">
          <TabsTrigger value="lec"><Activity className="h-4 w-4 mr-1" /> LEC Certification</TabsTrigger>
          <TabsTrigger value="health"><HeartPulse className="h-4 w-4 mr-1" /> Saúde</TabsTrigger>
          <TabsTrigger value="optimization"><TrendingUp className="h-4 w-4 mr-1" /> Otimização</TabsTrigger>
          <TabsTrigger value="funnel"><Target className="h-4 w-4 mr-1" /> Funil</TabsTrigger>
          <TabsTrigger value="cohorts"><Users className="h-4 w-4 mr-1" /> Coortes</TabsTrigger>
          <TabsTrigger value="tutor"><Brain className="h-4 w-4 mr-1" /> Tutor IA</TabsTrigger>
          <TabsTrigger value="heatmap"><Activity className="h-4 w-4 mr-1" /> Heatmap</TabsTrigger>
          <TabsTrigger value="recent"><MessageSquare className="h-4 w-4 mr-1" /> Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="lec" className="mt-4">
          <ScientificAuditDashboard />
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <TelemetryHealthCheck />
        </TabsContent>

        <TabsContent value="optimization" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Erros 500 / Timeout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {optReport?.error_rates?.total_500 ?? 0} / {optReport?.error_rates?.total_timeout ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total erros: {optReport?.error_rates?.total_errors ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Runtime Errors (JS)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {optReport?.error_rates?.total_runtime ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Reference/TypeErrors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Custo IA Est.</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${optReport?.ai_metrics?.total_cost ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cache: {optReport?.ai_metrics?.cache_hit_rate ?? 0}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tutor TTFT / Blocked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {optReport?.tutor_ttft ?? 0}ms / {optReport?.blocked_duplicates ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Time to first token / Duplicates</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 Rotas mais Lentas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(optReport?.loading_times ?? []).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs truncate max-w-[250px]">{r.route}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground text-xs">{r.samples} samples</span>
                        <span className={`font-bold ${r.avg_load_ms > 2000 ? 'text-red-500' : 'text-green-500'}`}>
                          {r.avg_load_ms}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Edge Functions (Latency)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(optReport?.edge_function_performance ?? []).map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{f.function_name}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground text-xs">{f.calls} calls</span>
                        <span className="font-bold">{f.avg_duration_ms}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Funil pedagógico</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => handleExport("funnel")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="h-[320px]">
              {funnel.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sem dados no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={funnel} isAnimationActive>
                      <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                      <LabelList position="center" fill="hsl(var(--primary-foreground))" stroke="none" dataKey="value" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Por dispositivo</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleExport("cohorts")}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohorts?.by_device ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="device" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" />
                    <Bar dataKey="study_started" fill="hsl(var(--primary)/0.6)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Novos vs recorrentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="Novos" value={cohorts?.new_vs_recurrent?.novos ?? 0} />
                  <Stat label="Recorrentes" value={cohorts?.new_vs_recurrent?.recorrentes ?? 0} />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Janela de "novos" = primeiro evento dentro dos últimos {days} dia(s).
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Top rotas por engajamento</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2">Rota</th>
                      <th className="text-right py-2">Eventos</th>
                      <th className="text-right py-2">Sessões</th>
                      <th className="text-right py-2">Rage clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cohorts?.by_route ?? []).map((r: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{r.route}</td>
                        <td className="text-right">{r.events}</td>
                        <td className="text-right">{r.sessions}</td>
                        <td className="text-right">
                          {r.rage_clicks > 0
                            ? <Badge variant="outline" className="text-[10px] border-orange-500/40">{r.rage_clicks}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutor" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4" /> Qualidade do Tutor IA</CardTitle>
                <CardDescription>Engajamento, reuso de memória e sinal de utilidade</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleExport("tutor")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Tutor aberto" value={tutorQ?.opened ?? 0} />
                <Stat label="Mensagens enviadas" value={tutorQ?.message_sent ?? 0} />
                <Stat label="Respostas recebidas" value={tutorQ?.response_received ?? 0} />
                <Stat label="Tempo médio" value={`${tutorQ?.avg_response_ms ?? 0} ms`} />
                <Stat label="Taxa de reuso (memória)" value={`${tutorQ?.memory_reuse_rate ?? 0}%`} />
                <Stat label="Taxa de regeneração" value={`${tutorQ?.regeneration_rate ?? 0}%`} />
                <Stat label="Útil" value={`${tutorQ?.helpful_rate ?? 0}%`} />
                <Stat label="Abandono pós-resposta" value={tutorQ?.abandon_after_response ?? 0} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Heatmap comportamental (top 25)</CardTitle>
              <CardDescription>Eventos agregados por rota</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2">Rota</th>
                      <th className="text-left py-2">Evento</th>
                      <th className="text-right py-2">Cliques</th>
                      <th className="text-right py-2">Rage</th>
                      <th className="text-right py-2">Sessões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapTop.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs truncate max-w-[200px]">{r.route}</td>
                        <td className="font-mono text-xs">{r.event_name}</td>
                        <td className="text-right">{r.click_count}</td>
                        <td className="text-right">
                          {r.rage_click_count > 0
                            ? <Badge variant="outline" className="text-[10px] border-red-500/40">{r.rage_click_count}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="text-right">{r.sessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Eventos recentes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recent.map((e: any) => (
                  <div key={e.id} className="flex justify-between items-center border-b pb-2 text-sm last:border-0">
                    <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{e.event_name}</span>
                    <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">{e.route}</span>
                    <span className="text-muted-foreground text-xs">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-2xl font-semibold tracking-tight">{value}</span>
  </div>
);

export default TelemetryAdmin;
