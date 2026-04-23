/**
 * /admin/classification-health
 * ────────────────────────────
 * Dashboard de observabilidade do classificador hierárquico.
 *
 * Mostra:
 *  - Status global (cobertura specialty/topic/subtopic, fila, runs)
 *  - Evolução de cobertura ao longo do tempo
 *  - Top aliases acionados
 *  - Saúde dos últimos runs (com verdict automático)
 *  - Queue monitor
 *
 * Auto-refresh: 15s via React Query
 */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Activity,
  AlertCircle,
  Database,
  Heart,
  History,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  evaluateClassificationHealth,
  verdictColor,
  verdictLabel,
} from "@/lib/classificationHealth";
import { Link } from "react-router-dom";

const REFRESH_MS = 15_000;

interface HealthRow {
  generated_at: string | null;
  total_questions: number | null;
  with_specialty: number | null;
  with_topic: number | null;
  with_subtopic: number | null;
  pct_specialty: number | null;
  pct_topic: number | null;
  pct_subtopic: number | null;
  queue_pending: number | null;
  total_runs: number | null;
}

interface SnapshotRow {
  id: string;
  run_id: string | null;
  total_questions: number | null;
  pct_specialty: number | null;
  pct_topic: number | null;
  pct_subtopic: number | null;
  queue_pending: number | null;
  deterministic_pct: number | null;
  heuristic_pct: number | null;
  queue_pct: number | null;
  skipped_pct: number | null;
  created_at: string;
}

interface AliasCoverageRow {
  alias_key: string;
  alias_target: string;
  total_matches: number;
  avg_confidence: number | null;
  first_seen: string;
  last_seen: string;
}

interface RunRow {
  id: string;
  table_source: string;
  dry_run: boolean;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_processed: number | null;
  deterministic_pct: number | null;
  heuristic_pct: number | null;
  queue_pct: number | null;
  skipped_pct: number | null;
}

interface QueueRow {
  id: string;
  question_id: string;
  original_topic: string | null;
  original_subtopic: string | null;
  classification_method: string | null;
  confidence_score: number | null;
  reason: string | null;
  status: string;
  created_at: string;
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(2)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

export default function ClassificationHealthDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const queryClient = useQueryClient();

  const ready = !!user && isAdmin && !rolesLoading;

  // 1) Status global (v_classification_health)
  const healthQuery = useQuery({
    queryKey: ["classification-health", "global"],
    enabled: ready,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_classification_health" as never)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as HealthRow | null;
    },
  });

  // 2) Snapshots para evolução
  const snapshotsQuery = useQuery({
    queryKey: ["classification-health", "snapshots"],
    enabled: ready,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classification_health_snapshots")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SnapshotRow[];
    },
  });

  // 3) Top aliases
  const aliasesQuery = useQuery({
    queryKey: ["classification-health", "aliases"],
    enabled: ready,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_alias_coverage" as never)
        .select("*")
        .limit(30);
      if (error) throw error;
      return (data ?? []) as AliasCoverageRow[];
    },
  });

  // 4) Últimos runs
  const runsQuery = useQuery({
    queryKey: ["classification-health", "runs"],
    enabled: ready,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_classification_runs")
        .select(
          "id, table_source, dry_run, status, started_at, finished_at, total_processed, deterministic_pct, heuristic_pct, queue_pct, skipped_pct",
        )
        .order("started_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as RunRow[];
    },
  });

  // 5) Queue monitor
  const queueQuery = useQuery({
    queryKey: ["classification-health", "queue"],
    enabled: ready,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_classification_queue")
        .select(
          "id, question_id, original_topic, original_subtopic, classification_method, confidence_score, reason, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as QueueRow[];
    },
  });

  const chartData = useMemo(() => {
    return (snapshotsQuery.data ?? []).map((s) => ({
      ts: new Date(s.created_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      specialty: s.pct_specialty ?? 0,
      topic: s.pct_topic ?? 0,
      subtopic: s.pct_subtopic ?? 0,
    }));
  }, [snapshotsQuery.data]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["classification-health"] });
  };

  if (rolesLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Esta página é exclusiva para administradores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const health = healthQuery.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Classification Health Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Observabilidade do pipeline classify-question-hierarchy. Auto-refresh a cada 15s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/classification-runner">
              <Activity className="h-4 w-4 mr-2" />
              Runner
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* A. Status global */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="Total questões"
          value={health?.total_questions?.toLocaleString("pt-BR") ?? "—"}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Specialty"
          value={formatPct(health?.pct_specialty)}
          sub={`${health?.with_specialty ?? 0} de ${health?.total_questions ?? 0}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Topic"
          value={formatPct(health?.pct_topic)}
          sub={`${health?.with_topic ?? 0} de ${health?.total_questions ?? 0}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Subtopic"
          value={formatPct(health?.pct_subtopic)}
          sub={`${health?.with_subtopic ?? 0} de ${health?.total_questions ?? 0}`}
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Fila pendente"
          value={(health?.queue_pending ?? 0).toLocaleString("pt-BR")}
        />
        <StatCard
          icon={<History className="h-4 w-4" />}
          label="Total runs"
          value={(health?.total_runs ?? 0).toLocaleString("pt-BR")}
        />
      </div>

      <Tabs defaultValue="evolution" className="space-y-4">
        <TabsList>
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
          <TabsTrigger value="aliases">Top aliases</TabsTrigger>
          <TabsTrigger value="runs">Saúde por run</TabsTrigger>
          <TabsTrigger value="queue">Queue monitor</TabsTrigger>
        </TabsList>

        {/* B. Evolução */}
        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle>Evolução da cobertura</CardTitle>
              <CardDescription>
                % de questões com specialty / topic / subtopic ao longo do tempo
                (últimos 50 snapshots).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {snapshotsQuery.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Ainda não há snapshots. Rode uma classificação no Runner para
                  gerar a primeira foto.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="ts"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        domain={[0, 100]}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="specialty"
                        stroke="hsl(var(--primary))"
                        fill="url(#g1)"
                        name="% Specialty"
                      />
                      <Area
                        type="monotone"
                        dataKey="topic"
                        stroke="hsl(var(--chart-2, 142 71% 45%))"
                        fill="transparent"
                        name="% Topic"
                      />
                      <Area
                        type="monotone"
                        dataKey="subtopic"
                        stroke="hsl(var(--chart-3, 43 96% 56%))"
                        fill="transparent"
                        name="% Subtopic"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* C. Top aliases */}
        <TabsContent value="aliases">
          <Card>
            <CardHeader>
              <CardTitle>Top aliases acionados</CardTitle>
              <CardDescription>
                Aliases curriculares que mais resolvem classificação. Confiança
                média próxima de 0.97 indica match limpo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aliasesQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (aliasesQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum alias acionado ainda. Os eventos são gravados a partir
                  da próxima execução do classificador.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead>Alvo</TableHead>
                      <TableHead className="text-right">Matches</TableHead>
                      <TableHead className="text-right">Confiança</TableHead>
                      <TableHead>Último uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(aliasesQuery.data ?? []).map((row) => (
                      <TableRow key={`${row.alias_key}-${row.alias_target}`}>
                        <TableCell className="font-mono text-xs">
                          {row.alias_key}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.alias_target}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {row.total_matches}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.avg_confidence?.toFixed(3) ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(row.last_seen)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* D. Saúde por run */}
        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Saúde dos últimos runs</CardTitle>
              <CardDescription>
                Verdict automático baseado em determinístico (exact + alias),
                heurística, fila e skipped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runsQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (runsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma run encontrada.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Início</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead className="text-right">Det %</TableHead>
                      <TableHead className="text-right">Heur %</TableHead>
                      <TableHead className="text-right">Queue %</TableHead>
                      <TableHead className="text-right">Skip %</TableHead>
                      <TableHead>Verdict</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(runsQuery.data ?? []).map((run) => {
                      const ev = evaluateClassificationHealth({
                        total_processed: run.total_processed,
                        deterministic_pct: run.deterministic_pct,
                        heuristic_pct: run.heuristic_pct,
                        queue_pct: run.queue_pct,
                        skipped_pct: run.skipped_pct,
                      });
                      return (
                        <TableRow key={run.id}>
                          <TableCell className="text-xs">
                            {formatDate(run.started_at)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {run.table_source}
                          </TableCell>
                          <TableCell>
                            <Badge variant={run.dry_run ? "secondary" : "default"}>
                              {run.dry_run ? "dry" : "real"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPct(run.deterministic_pct)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPct(run.heuristic_pct)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPct(run.queue_pct)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPct(run.skipped_pct)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={verdictColor(ev.verdict)}
                            >
                              {verdictLabel(ev.verdict)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* E. Queue monitor */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Queue monitor</CardTitle>
              <CardDescription>
                Últimos 20 itens na fila de revisão (todos status). Para revisar
                em detalhe, use o Runner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queueQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (queueQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Fila vazia.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Subtopic</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Confiança</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Razão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(queueQuery.data ?? []).map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="text-xs">
                          {q.original_topic ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {q.original_subtopic ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {q.classification_method ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {q.confidence_score?.toFixed(2) ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              q.status === "approved"
                                ? "default"
                                : q.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-md truncate"
                          title={q.reason ?? ""}
                        >
                          {q.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2 text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {sub ? (
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
