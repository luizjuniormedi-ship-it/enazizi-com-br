import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Activity, AlertTriangle, FlaskConical } from "lucide-react";

interface SummaryRow {
  pipeline_used: "granular" | "legacy";
  banca: string;
  user_profile: string;
  generation_mode: string;
  ab_bucket: string;
  total_runs: number;
  success_runs: number;
  error_runs: number;
  fallback_runs: number;
  avg_duration_ms: number | null;
  fallback_rate_pct: number | null;
  error_rate_pct: number | null;
  avg_batch_error_rate: number | null;
  total_questions_generated: number | null;
  last_run_at: string;
}

interface RunRow {
  id: string;
  created_at: string;
  endpoint: string;
  pipeline_used: "granular" | "legacy";
  banca: string | null;
  user_profile: string | null;
  generation_mode: string | null;
  ab_bucket: string | null;
  requested_count: number | null;
  generated_count: number | null;
  batch_count: number | null;
  batch_error_rate: number | null;
  duration_ms: number | null;
  status: "success" | "fallback" | "error";
  fallback_reason: string | null;
  error_message: string | null;
}

export default function GeneratorTelemetry() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, r] = await Promise.all([
      supabase.from("v_generator_telemetry_summary").select("*"),
      supabase
        .from("granular_generator_runs")
        .select(
          "id, created_at, endpoint, pipeline_used, banca, user_profile, generation_mode, ab_bucket, requested_count, generated_count, batch_count, batch_error_rate, duration_ms, status, fallback_reason, error_message"
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (s.error) toast({ title: "Falha no resumo", description: s.error.message, variant: "destructive" });
    if (r.error) toast({ title: "Falha nos runs", description: r.error.message, variant: "destructive" });
    setSummary((s.data ?? []) as SummaryRow[]);
    setRuns((r.data ?? []) as RunRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Agregações para os cards
  const overall = useMemo(() => {
    const total = summary.reduce((a, r) => a + (r.total_runs || 0), 0);
    const errors = summary.reduce((a, r) => a + (r.error_runs || 0), 0);
    const fallbacks = summary.reduce((a, r) => a + (r.fallback_runs || 0), 0);
    const granular = summary.filter(r => r.pipeline_used === "granular")
      .reduce((a, r) => a + (r.total_runs || 0), 0);
    const legacy = summary.filter(r => r.pipeline_used === "legacy")
      .reduce((a, r) => a + (r.total_runs || 0), 0);
    const weighted = summary.reduce((a, r) => a + (Number(r.avg_duration_ms) || 0) * (r.total_runs || 0), 0);
    return {
      total,
      errors,
      fallbacks,
      granular,
      legacy,
      avgDuration: total > 0 ? Math.round(weighted / total) : 0,
      errorRate: total > 0 ? +(100 * errors / total).toFixed(2) : 0,
      fallbackRate: total > 0 ? +(100 * fallbacks / total).toFixed(2) : 0,
    };
  }, [summary]);

  // A/B comparison
  const ab = useMemo(() => {
    const acc = new Map<string, { total: number; errors: number; durSum: number; questions: number }>();
    for (const r of summary) {
      const k = r.ab_bucket;
      const cur = acc.get(k) ?? { total: 0, errors: 0, durSum: 0, questions: 0 };
      cur.total += r.total_runs || 0;
      cur.errors += r.error_runs || 0;
      cur.durSum += (Number(r.avg_duration_ms) || 0) * (r.total_runs || 0);
      cur.questions += r.total_questions_generated || 0;
      acc.set(k, cur);
    }
    return Array.from(acc.entries()).map(([bucket, v]) => ({
      bucket,
      total: v.total,
      errors: v.errors,
      questions: v.questions,
      avgDuration: v.total > 0 ? Math.round(v.durSum / v.total) : 0,
      errorRate: v.total > 0 ? +(100 * v.errors / v.total).toFixed(2) : 0,
    })).sort((a, b) => a.bucket.localeCompare(b.bucket));
  }, [summary]);

  // Top problemáticos
  const topErrorBancas = useMemo(() => {
    const acc = new Map<string, { total: number; errors: number }>();
    for (const r of summary) {
      const cur = acc.get(r.banca) ?? { total: 0, errors: 0 };
      cur.total += r.total_runs || 0;
      cur.errors += r.error_runs || 0;
      acc.set(r.banca, cur);
    }
    return Array.from(acc.entries())
      .map(([banca, v]) => ({ banca, ...v, rate: v.total > 0 ? (100 * v.errors / v.total) : 0 }))
      .filter(x => x.errors > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [summary]);

  const topErrorProfiles = useMemo(() => {
    const acc = new Map<string, { total: number; errors: number }>();
    for (const r of summary) {
      const cur = acc.get(r.user_profile) ?? { total: 0, errors: 0 };
      cur.total += r.total_runs || 0;
      cur.errors += r.error_runs || 0;
      acc.set(r.user_profile, cur);
    }
    return Array.from(acc.entries())
      .map(([p, v]) => ({ perfil: p, ...v, rate: v.total > 0 ? (100 * v.errors / v.total) : 0 }))
      .filter(x => x.errors > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [summary]);

  const pipelineBadge = (p: "granular" | "legacy") =>
    p === "granular"
      ? <Badge className="bg-primary/15 text-primary hover:bg-primary/20">granular</Badge>
      : <Badge variant="outline">legacy</Badge>;

  const statusBadge = (s: RunRow["status"]) => {
    if (s === "success") return <Badge variant="default">sucesso</Badge>;
    if (s === "fallback") return <Badge variant="secondary">fallback</Badge>;
    return <Badge variant="destructive">erro</Badge>;
  };

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Telemetria do Gerador (últimos 14 dias)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Observabilidade pura — não altera o pipeline. Comparação A/B entre legacy e granular.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Recarregar</span>
        </Button>
      </div>

      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Runs (14d)" value={overall.total} />
        <Stat label="Granular" value={overall.granular} accent="primary" />
        <Stat label="Legacy" value={overall.legacy} />
        <Stat label="Latência média" value={`${overall.avgDuration} ms`} />
        <Stat label="Fallback rate" value={`${overall.fallbackRate}%`} accent={overall.fallbackRate > 20 ? "warning" : undefined} />
        <Stat label="Error rate" value={`${overall.errorRate}%`} accent={overall.errorRate > 5 ? "destructive" : undefined} />
        <Stat label="Erros (#)" value={overall.errors} accent={overall.errors > 0 ? "destructive" : undefined} />
      </div>

      <Tabs defaultValue="ab" className="w-full">
        <TabsList>
          <TabsTrigger value="ab"><FlaskConical className="w-4 h-4 mr-2" />A/B</TabsTrigger>
          <TabsTrigger value="problems"><AlertTriangle className="w-4 h-4 mr-2" />Problemas</TabsTrigger>
          <TabsTrigger value="runs">Runs recentes</TabsTrigger>
        </TabsList>

        {/* A/B */}
        <TabsContent value="ab" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparação A/B (bucket determinístico por user_id)</CardTitle>
              <CardDescription>
                Estrutura pronta para futura ativação de pipeline diferente por bucket.
                Hoje, o pipeline usado depende do feature flag e da prontidão da banca — A/B mede a diferença observada por coorte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">Latência média</TableHead>
                    <TableHead className="text-right">Erro %</TableHead>
                    <TableHead className="text-right">Questões geradas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ab.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                  )}
                  {ab.map(b => (
                    <TableRow key={b.bucket}>
                      <TableCell><Badge variant="outline">{b.bucket}</Badge></TableCell>
                      <TableCell className="text-right">{b.total}</TableCell>
                      <TableCell className="text-right">{b.avgDuration} ms</TableCell>
                      <TableCell className="text-right">{b.errorRate}%</TableCell>
                      <TableCell className="text-right">{b.questions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline × Banca × Modo</CardTitle>
              <CardDescription>Visão agregada (todas as combinações observadas)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Banca</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">ms médio</TableHead>
                      <TableHead className="text-right">Fallback %</TableHead>
                      <TableHead className="text-right">Erro %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                    )}
                    {summary.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{pipelineBadge(r.pipeline_used)}</TableCell>
                        <TableCell className="text-xs">{r.banca}</TableCell>
                        <TableCell className="text-xs">{r.user_profile}</TableCell>
                        <TableCell className="text-xs">{r.generation_mode}</TableCell>
                        <TableCell className="text-right">{r.total_runs}</TableCell>
                        <TableCell className="text-right">{r.avg_duration_ms ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.fallback_rate_pct ?? 0}%</TableCell>
                        <TableCell className="text-right">{r.error_rate_pct ?? 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Problemas */}
        <TabsContent value="problems" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Bancas com mais erros</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banca</TableHead>
                      <TableHead className="text-right">Erros / Total</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topErrorBancas.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem erros registrados 🎉</TableCell></TableRow>
                    )}
                    {topErrorBancas.map(b => (
                      <TableRow key={b.banca}>
                        <TableCell className="text-xs">{b.banca}</TableCell>
                        <TableCell className="text-right text-xs">{b.errors} / {b.total}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-destructive">{b.rate.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Perfis com mais erros</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perfil</TableHead>
                      <TableHead className="text-right">Erros / Total</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topErrorProfiles.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem erros registrados 🎉</TableCell></TableRow>
                    )}
                    {topErrorProfiles.map(p => (
                      <TableRow key={p.perfil}>
                        <TableCell className="text-xs">{p.perfil}</TableCell>
                        <TableCell className="text-right text-xs">{p.errors} / {p.total}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-destructive">{p.rate.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Runs */}
        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Últimos 100 runs</CardTitle>
              <CardDescription>Ordem decrescente por data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Banca</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>A/B</TableHead>
                      <TableHead className="text-right">Pedido / Gerado</TableHead>
                      <TableHead className="text-right">Erro batch</TableHead>
                      <TableHead className="text-right">ms</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum run registrado.</TableCell></TableRow>
                    )}
                    {runs.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{pipelineBadge(r.pipeline_used)}</TableCell>
                        <TableCell className="text-xs">{r.banca ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.user_profile ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.generation_mode ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.ab_bucket ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{r.requested_count ?? "—"} / {r.generated_count ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {r.batch_error_rate != null ? `${(r.batch_error_rate * 100).toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">{r.duration_ms ?? "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label, value, accent,
}: { label: string; value: string | number; accent?: "primary" | "warning" | "destructive" }) {
  const cls =
    accent === "primary" ? "text-primary"
    : accent === "warning" ? "text-amber-600"
    : accent === "destructive" ? "text-destructive"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
