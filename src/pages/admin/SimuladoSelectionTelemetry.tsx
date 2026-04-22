import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Database, Sparkles, Image, AlertTriangle, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Overview {
  total_runs: number;
  avg_textual: number;
  avg_structural: number;
  avg_image: number;
  avg_ai: number;
  avg_fallback: number;
  granular_eligible_pct: number;
  top_fallback_reasons: Array<{ reason: string; count: number }>;
  by_banca: Array<{ banca: string; runs: number; avg_textual: number; avg_ai: number }>;
  by_mode: Array<{ mode: string; runs: number; avg_final: number }>;
}

interface Run {
  id: string;
  created_at: string;
  mode: string | null;
  banca: string | null;
  user_profile: string | null;
  requested_count: number | null;
  final_count: number | null;
  source_pool_textual: number;
  source_pool_structural: number;
  source_image_pipeline: number;
  source_ai_generated: number;
  source_fallback: number;
  granular_eligible: boolean;
  granular_fallback_reason: string | null;
  duration_ms: number | null;
}

interface Readiness {
  total_questions: number;
  with_specialty_id: number;
  with_topic_id: number;
  with_subtopic_id: number;
  pct_specialty: number;
  pct_topic: number;
  pct_subtopic: number;
}

const REASON_COLORS: Record<string, string> = {
  flag_off: "bg-muted text-muted-foreground",
  no_banca_provided: "bg-muted text-muted-foreground",
  banca_nao_pronta: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  questions_not_classified: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  coverage_insufficient: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  empty_distribution: "bg-red-500/15 text-red-700 dark:text-red-400",
  guard_error: "bg-red-500/20 text-red-700 dark:text-red-400",
  no_attempt: "bg-muted text-muted-foreground",
};

export default function SimuladoSelectionTelemetry() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ovRes, runsRes, rdRes] = await Promise.all([
        supabase.rpc("get_simulado_selection_overview", { _days: days }),
        supabase
          .from("simulado_selection_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.rpc("granular_classification_readiness"),
      ]);
      if (ovRes.data && Array.isArray(ovRes.data) && ovRes.data.length > 0) {
        setOverview(ovRes.data[0] as unknown as Overview);
      } else if (ovRes.data && !Array.isArray(ovRes.data)) {
        setOverview(ovRes.data as unknown as Overview);
      }
      if (runsRes.data) setRuns(runsRes.data as unknown as Run[]);
      if (rdRes.data && Array.isArray(rdRes.data) && rdRes.data.length > 0) {
        setReadiness(rdRes.data[0] as unknown as Readiness);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telemetria de Seleção de Provas</h1>
          <p className="text-muted-foreground">
            Composição real (textual / estrutural / IA / fallback) das provas geradas
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="px-3 py-2 rounded-md border bg-background text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Últimas 24h</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Prontidão de classificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Prontidão de classificação do banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {readiness ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Questões totais" value={readiness.total_questions.toLocaleString()} />
              <Stat
                label="Com specialty_id"
                value={`${readiness.pct_specialty}%`}
                hint={`${readiness.with_specialty_id} / ${readiness.total_questions}`}
                tone={readiness.pct_specialty >= 70 ? "ok" : readiness.pct_specialty >= 30 ? "warn" : "bad"}
              />
              <Stat
                label="Com topic_id"
                value={`${readiness.pct_topic}%`}
                hint={`${readiness.with_topic_id} / ${readiness.total_questions}`}
                tone={readiness.pct_topic >= 50 ? "ok" : readiness.pct_topic >= 20 ? "warn" : "bad"}
              />
              <Stat
                label="Com subtopic_id"
                value={`${readiness.pct_subtopic}%`}
                hint={`${readiness.with_subtopic_id} / ${readiness.total_questions}`}
                tone={readiness.pct_subtopic >= 30 ? "ok" : readiness.pct_subtopic >= 10 ? "warn" : "bad"}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Thresholds do guard granular: specialty ≥ 70% • topic ≥ 50% • subtopic ≥ 30%.
            Abaixo disso → fallback automático com razão{" "}
            <code className="text-xs">questions_not_classified</code>.
          </p>
        </CardContent>
      </Card>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview ({overview?.total_runs ?? 0} execuções)</CardTitle>
        </CardHeader>
        <CardContent>
          {overview ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <Stat label="Média textual (pool)" value={overview.avg_textual.toString()} icon={<Database className="h-4 w-4" />} />
                <Stat label="Média estrutural" value={overview.avg_structural.toString()} icon={<Database className="h-4 w-4" />} />
                <Stat label="Média imagem" value={overview.avg_image.toString()} icon={<Image className="h-4 w-4" />} />
                <Stat label="Média IA" value={overview.avg_ai.toString()} icon={<Sparkles className="h-4 w-4" />} />
                <Stat label="Média fallback" value={overview.avg_fallback.toString()} icon={<AlertTriangle className="h-4 w-4" />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Top razões de fallback</h3>
                  {overview.top_fallback_reasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum fallback registrado.</p>
                  ) : (
                    <ul className="space-y-1">
                      {overview.top_fallback_reasons.map((r) => (
                        <li key={r.reason} className="flex justify-between text-sm">
                          <Badge className={REASON_COLORS[r.reason] ?? ""}>{r.reason}</Badge>
                          <span className="text-muted-foreground">{r.count}×</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-sm">Por banca</h3>
                  {overview.by_banca.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {overview.by_banca.map((b) => (
                        <li key={b.banca} className="flex justify-between">
                          <span>{b.banca}</span>
                          <span className="text-muted-foreground">
                            {b.runs} runs · IA {b.avg_ai} · Pool {b.avg_textual}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          )}
        </CardContent>
      </Card>

      {/* Runs recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Execuções recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && runs.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Banca</TableHead>
                    <TableHead className="text-right">Pedidas</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                    <TableHead className="text-right">Pool</TableHead>
                    <TableHead className="text-right">Imagem</TableHead>
                    <TableHead className="text-right">IA</TableHead>
                    <TableHead>Granular?</TableHead>
                    <TableHead>Razão fallback</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/admin/simulado-selection/${r.id}`)}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{r.mode ?? "—"}</TableCell>
                      <TableCell>{r.banca ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.requested_count ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{r.final_count ?? 0}</TableCell>
                      <TableCell className="text-right">{r.source_pool_textual}</TableCell>
                      <TableCell className="text-right">{r.source_image_pipeline}</TableCell>
                      <TableCell className="text-right">{r.source_ai_generated}</TableCell>
                      <TableCell>
                        {r.granular_eligible ? (
                          <Badge variant="default">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.granular_fallback_reason ? (
                          <Badge className={REASON_COLORS[r.granular_fallback_reason] ?? ""}>
                            {r.granular_fallback_reason}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.duration_ms ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label, value, hint, icon, tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "ok"
      ? "text-green-600 dark:text-green-400"
      : tone === "warn"
      ? "text-yellow-600 dark:text-yellow-400"
      : tone === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
