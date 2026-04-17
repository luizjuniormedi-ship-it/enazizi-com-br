import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Brain, CheckCircle2, Cpu, GitBranch, Loader2, RefreshCw, Target, TrendingUp } from "lucide-react";

const fmt = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(digits);

const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${(Number(n) * 100).toFixed(1)}%`;

const sinceDays = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

export default function AdminOrchestratorInsights() {
  const [showDebug, setShowDebug] = useState(false);

  // -------- BLOCK 1: DECISIONS --------
  const decisionsQuery = useQuery({
    queryKey: ["orchestrator-insights", "decisions"],
    queryFn: async () => {
      const [d7, d30, latest] = await Promise.all([
        supabase
          .from("assistant_decisions")
          .select("id", { count: "exact", head: true })
          .eq("source_module", "study-orchestrator")
          .gte("created_at", sinceDays(7)),
        supabase
          .from("assistant_decisions")
          .select("id", { count: "exact", head: true })
          .eq("source_module", "study-orchestrator")
          .gte("created_at", sinceDays(30)),
        supabase
          .from("assistant_decisions")
          .select("id, created_at, decision_output, confidence_score, justification")
          .eq("source_module", "study-orchestrator")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const rows = latest.data ?? [];
      const groups: Record<string, number> = {};
      const routes: Record<string, number> = {};
      const modes: Record<string, number> = {};
      for (const r of rows) {
        const out: any = r.decision_output ?? {};
        const action = out.nextAction ?? "unknown";
        const route = out.targetModule ?? out.route ?? "—";
        const mode = out.executionMode ?? "navigate";
        groups[action] = (groups[action] ?? 0) + 1;
        routes[route] = (routes[route] ?? 0) + 1;
        modes[mode] = (modes[mode] ?? 0) + 1;
      }
      return {
        count7d: d7.count ?? 0,
        count30d: d30.count ?? 0,
        rows,
        byAction: Object.entries(groups).sort((a, b) => b[1] - a[1]),
        byRoute: Object.entries(routes).sort((a, b) => b[1] - a[1]),
        byMode: Object.entries(modes).sort((a, b) => b[1] - a[1]),
      };
    },
    staleTime: 60_000,
  });

  // -------- BLOCK 2: EXECUTIONS (study_complete) --------
  const completesQuery = useQuery({
    queryKey: ["orchestrator-insights", "completes"],
    queryFn: async () => {
      const since = sinceDays(7);
      const [total, recent] = await Promise.all([
        supabase
          .from("assistant_decisions")
          .select("id", { count: "exact", head: true })
          .eq("decision_type", "study_complete")
          .gte("created_at", since),
        supabase
          .from("assistant_decisions")
          .select("id, created_at, input_snapshot, source_module")
          .eq("decision_type", "study_complete")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      const rows = recent.data ?? [];
      let withDid = 0;
      const bySource: Record<string, number> = {};
      for (const r of rows) {
        const meta: any = (r.input_snapshot as any)?.metadata ?? {};
        if (meta.decisionId) withDid++;
        const src = meta.originModule ?? r.source_module ?? "—";
        bySource[src] = (bySource[src] ?? 0) + 1;
      }
      return {
        total7d: total.count ?? 0,
        rows,
        withDid,
        pctWithDid: rows.length ? withDid / rows.length : 0,
        bySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]),
      };
    },
    staleTime: 60_000,
  });

  // -------- BLOCK 3: OUTCOMES --------
  const outcomesQuery = useQuery({
    queryKey: ["orchestrator-insights", "outcomes"],
    queryFn: async () => {
      const [total, total7d, rowsResp] = await Promise.all([
        supabase.from("orchestrator_outcomes").select("id", { count: "exact", head: true }),
        supabase
          .from("orchestrator_outcomes")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sinceDays(7)),
        supabase
          .from("orchestrator_outcomes")
          .select(
            "id, created_at, decision_id, modality, phase, outcome, improvement_delta, error_reduction, time_to_follow_seconds, next_action, topic"
          )
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      const rows = rowsResp.data ?? [];
      const byMod: Record<string, { total: number; imp: number[]; err: number[] }> = {};
      const byPhase: Record<string, number> = {};
      let success = 0;
      let failure = 0;
      let timeAcc = 0;
      let timeN = 0;
      for (const r of rows) {
        const m = r.modality ?? "—";
        if (!byMod[m]) byMod[m] = { total: 0, imp: [], err: [] };
        byMod[m].total++;
        if (r.improvement_delta != null) byMod[m].imp.push(Number(r.improvement_delta));
        if (r.error_reduction != null) byMod[m].err.push(Number(r.error_reduction));
        const p = r.phase ?? "—";
        byPhase[p] = (byPhase[p] ?? 0) + 1;
        if (r.outcome === "success") success++;
        if (r.outcome === "failure") failure++;
        if (r.time_to_follow_seconds != null) {
          timeAcc += r.time_to_follow_seconds;
          timeN++;
        }
      }
      const avgArr = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
      const modalityStats = Object.entries(byMod)
        .map(([k, v]) => ({
          modality: k,
          total: v.total,
          avgImprovement: avgArr(v.imp),
          avgErrorReduction: avgArr(v.err),
        }))
        .sort((a, b) => b.total - a.total);
      return {
        total: total.count ?? 0,
        total7d: total7d.count ?? 0,
        rows,
        success,
        failure,
        successRate: success + failure > 0 ? success / (success + failure) : null,
        avgTimeToFollow: timeN ? timeAcc / timeN : null,
        modalityStats,
        byPhase: Object.entries(byPhase).sort((a, b) => b[1] - a[1]),
      };
    },
    staleTime: 60_000,
  });

  // -------- BLOCK 4: LEARNING (rule weights) --------
  const weightsQuery = useQuery({
    queryKey: ["orchestrator-insights", "weights"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orchestrator_rule_weights")
        .select("*")
        .order("current_weight", { ascending: false });
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const loading =
    decisionsQuery.isLoading ||
    completesQuery.isLoading ||
    outcomesQuery.isLoading ||
    weightsQuery.isLoading;

  const refetchAll = () => {
    decisionsQuery.refetch();
    completesQuery.refetch();
    outcomesQuery.refetch();
    weightsQuery.refetch();
  };

  // -------- HEALTH CHECK --------
  const totalDec7d = decisionsQuery.data?.count7d ?? 0;
  const totalCmp7d = completesQuery.data?.total7d ?? 0;
  const totalOut7d = outcomesQuery.data?.total7d ?? 0;
  const conversion = totalDec7d > 0 ? totalOut7d / totalDec7d : 0;
  const pctNoDid = completesQuery.data
    ? 1 - (completesQuery.data.pctWithDid ?? 0)
    : 0;

  let healthStatus: "green" | "yellow" | "red" = "green";
  let healthMsg = "Ciclo adaptativo funcionando";
  if (totalOut7d === 0 || pctNoDid > 0.8) {
    healthStatus = "red";
    healthMsg =
      totalOut7d === 0
        ? "Nenhum outcome nos últimos 7 dias"
        : "Mais de 80% dos study_complete sem decisionId";
  } else if (conversion < 0.1) {
    healthStatus = "yellow";
    healthMsg = "Baixa conversão decisão → outcome";
  }

  const best = (outcomesQuery.data?.modalityStats ?? [])
    .filter((m) => m.avgImprovement != null)
    .sort((a, b) => (b.avgImprovement ?? 0) - (a.avgImprovement ?? 0))[0];
  const worst = (outcomesQuery.data?.modalityStats ?? [])
    .filter((m) => m.avgImprovement != null)
    .sort((a, b) => (a.avgImprovement ?? 0) - (b.avgImprovement ?? 0))[0];

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Orchestrator Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel técnico do ciclo decisão → execução → outcome → aprendizado
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {/* HEALTH CHECK */}
      <Card
        className={
          healthStatus === "red"
            ? "border-destructive/50"
            : healthStatus === "yellow"
            ? "border-yellow-500/50"
            : "border-green-500/50"
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Health Check do Ciclo
            </CardTitle>
            <Badge
              variant={
                healthStatus === "red"
                  ? "destructive"
                  : healthStatus === "yellow"
                  ? "secondary"
                  : "default"
              }
            >
              {healthStatus === "red" ? "🔴" : healthStatus === "yellow" ? "🟡" : "🟢"} {healthMsg}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Decisões (7d)" value={totalDec7d} icon={<Cpu className="h-4 w-4" />} />
            <Kpi label="Study Complete (7d)" value={totalCmp7d} icon={<CheckCircle2 className="h-4 w-4" />} />
            <Kpi label="Outcomes (7d)" value={totalOut7d} icon={<Target className="h-4 w-4" />} />
            <Kpi
              label="Conversão"
              value={fmtPct(conversion)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="decisions">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="decisions">Decisões</TabsTrigger>
          <TabsTrigger value="executions">Execução</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="learning">Aprendizado</TabsTrigger>
        </TabsList>

        {/* TAB 1: DECISIONS */}
        <TabsContent value="decisions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total decisões</CardDescription>
                <CardTitle className="text-2xl">{decisionsQuery.data?.count30d ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">últimos 30 dias</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Janela 7d</CardDescription>
                <CardTitle className="text-2xl">{decisionsQuery.data?.count7d ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">últimos 7 dias</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Confiança média</CardDescription>
                <CardTitle className="text-2xl">
                  {fmt(
                    (decisionsQuery.data?.rows ?? [])
                      .map((r: any) => Number(r.confidence_score) || 0)
                      .reduce((a, b, _i, arr) => a + b / (arr.length || 1), 0)
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">amostra: 50 últimas</CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BreakdownCard title="Por nextAction" entries={decisionsQuery.data?.byAction ?? []} />
            <BreakdownCard title="Por targetModule" entries={decisionsQuery.data?.byRoute ?? []} />
            <BreakdownCard title="Por executionMode" entries={decisionsQuery.data?.byMode ?? []} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas decisões</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead className="text-right">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(decisionsQuery.data?.rows ?? []).slice(0, 20).map((r: any) => {
                    const o = r.decision_output ?? {};
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell><Badge variant="outline">{o.nextAction ?? "—"}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{o.targetModule ?? "—"}</TableCell>
                        <TableCell className="text-xs">{o.executionMode ?? "—"}</TableCell>
                        <TableCell className="text-xs">{o.payload?.topic ?? o.topic ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.confidence_score)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(decisionsQuery.data?.rows ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: EXECUTIONS */}
        <TabsContent value="executions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Study Complete (7d)</CardDescription>
                <CardTitle className="text-2xl">{completesQuery.data?.total7d ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>% com decisionId</CardDescription>
                <CardTitle className="text-2xl">{fmtPct(completesQuery.data?.pctWithDid ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {completesQuery.data?.withDid ?? 0} de {completesQuery.data?.rows.length ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Origens distintas</CardDescription>
                <CardTitle className="text-2xl">{completesQuery.data?.bySource.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <BreakdownCard title="Por origem (originModule)" entries={completesQuery.data?.bySource ?? []} />

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas execuções</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>decisionId</TableHead>
                    <TableHead>origin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(completesQuery.data?.rows ?? []).slice(0, 25).map((r: any) => {
                    const meta = r.input_snapshot?.metadata ?? {};
                    const did = meta.decisionId;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{r.input_snapshot?.actionType ?? "—"}</TableCell>
                        <TableCell>
                          {did ? (
                            <Badge variant="default" className="font-mono text-[10px]">{String(did).slice(0, 8)}…</Badge>
                          ) : (
                            <Badge variant="destructive">missing</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{meta.originModule ?? r.source_module ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(completesQuery.data?.rows ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: OUTCOMES */}
        <TabsContent value="outcomes" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total outcomes" value={outcomesQuery.data?.total ?? 0} />
            <Kpi label="Outcomes (7d)" value={outcomesQuery.data?.total7d ?? 0} />
            <Kpi label="Taxa de sucesso" value={fmtPct(outcomesQuery.data?.successRate)} />
            <Kpi
              label="Tempo médio até execução"
              value={
                outcomesQuery.data?.avgTimeToFollow != null
                  ? `${Math.round(outcomesQuery.data.avgTimeToFollow)}s`
                  : "—"
              }
            />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Por modalidade</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalidade</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Δ Improvement</TableHead>
                    <TableHead className="text-right">Δ Error reduction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(outcomesQuery.data?.modalityStats ?? []).map((m) => (
                    <TableRow key={m.modality}>
                      <TableCell><Badge variant="outline">{m.modality}</Badge></TableCell>
                      <TableCell className="text-right">{m.total}</TableCell>
                      <TableCell className="text-right">{fmt(m.avgImprovement, 3)}</TableCell>
                      <TableCell className="text-right">{fmt(m.avgErrorReduction, 3)}</TableCell>
                    </TableRow>
                  ))}
                  {(outcomesQuery.data?.modalityStats ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem outcomes registrados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <BreakdownCard title="Por phase" entries={outcomesQuery.data?.byPhase ?? []} />

          <Card>
            <CardHeader><CardTitle className="text-base">Últimos outcomes</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Modality</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Δ Imp.</TableHead>
                    <TableHead className="text-right">Δ Err.</TableHead>
                    <TableHead className="text-right">Δt (s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(outcomesQuery.data?.rows ?? []).slice(0, 25).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{r.modality ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.phase ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.outcome === "success" ? "default" : r.outcome === "failure" ? "destructive" : "secondary"}>
                          {r.outcome ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{fmt(r.improvement_delta, 3)}</TableCell>
                      <TableCell className="text-right text-xs">{fmt(r.error_reduction, 3)}</TableCell>
                      <TableCell className="text-right text-xs">{r.time_to_follow_seconds ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(outcomesQuery.data?.rows ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem outcomes</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: LEARNING */}
        <TabsContent value="learning" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>🥇 Melhor modalidade</CardDescription>
                <CardTitle className="text-xl">{best?.modality ?? "—"}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Δ improvement médio: {fmt(best?.avgImprovement, 3)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>📉 Pior modalidade</CardDescription>
                <CardTitle className="text-xl">{worst?.modality ?? "—"}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Δ improvement médio: {fmt(worst?.avgImprovement, 3)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Pesos atuais das regras (F6)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Regra</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Peso atual</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">Cooldown</TableHead>
                    <TableHead className="text-right">Sucesso</TableHead>
                    <TableHead className="text-right">Falha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(weightsQuery.data ?? []).map((w: any) => {
                    const delta = Number(w.current_weight) - Number(w.baseline_weight);
                    return (
                      <TableRow key={w.rule_id}>
                        <TableCell className="text-xs">
                          <div className="font-medium">{w.rule_name}</div>
                          <div className="text-muted-foreground font-mono">{w.rule_id}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{w.category ?? "core"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmt(w.current_weight)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(w.baseline_weight)}</TableCell>
                        <TableCell className={`text-right ${delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : ""}`}>
                          {delta > 0 ? "+" : ""}{fmt(delta)}
                        </TableCell>
                        <TableCell className="text-right text-xs">{w.cooldown_minutes ?? 0}m</TableCell>
                        <TableCell className="text-right text-xs text-green-600">{w.success_count}</TableCell>
                        <TableCell className="text-right text-xs text-destructive">{w.failure_count}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(weightsQuery.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sem regras cadastradas</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DEBUG */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">🧪 Debug — últimas 10 decisões completas</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowDebug((v) => !v)}>
              {showDebug ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </CardHeader>
        {showDebug && (
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {(decisionsQuery.data?.rows ?? []).slice(0, 10).map((r: any) => (
                <details key={r.id} className="border rounded-md p-3 text-xs">
                  <summary className="cursor-pointer font-medium">
                    {new Date(r.created_at).toLocaleString("pt-BR")} ·{" "}
                    {r.decision_output?.nextAction ?? "—"} → {r.decision_output?.targetModule ?? "—"}
                  </summary>
                  <pre className="mt-2 overflow-x-auto bg-muted/30 rounded p-2 text-[10px]">
                    {JSON.stringify(
                      {
                        decision_output: r.decision_output,
                        rulesTrace: r.decision_output?.rulesTrace,
                        adaptiveState: r.decision_output?.adaptiveState,
                        justification: r.justification,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function BreakdownCard({ title, entries }: { title: string; entries: [string, number][] }) {
  const total = entries.reduce((a, b) => a + b[1], 0) || 1;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.length === 0 && <div className="text-xs text-muted-foreground">Sem dados</div>}
          {entries.slice(0, 8).map(([k, v]) => (
            <div key={k} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono truncate max-w-[70%]">{k}</span>
                <span className="text-muted-foreground">{v} ({((v / total) * 100).toFixed(0)}%)</span>
              </div>
              <div className="h-1.5 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(v / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
