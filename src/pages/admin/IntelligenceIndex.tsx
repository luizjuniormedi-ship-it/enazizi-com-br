/**
 * /admin/intelligence-index
 * ─────────────────────────
 * SPRINT INTEL-1 — FASE 3
 *
 * Painel administrativo READ-ONLY do ENAMED Intelligence Index.
 * Sem integração com Planner / Missão / Tutor / FSRS / TRI / Cron / Triggers.
 * Apenas leitura de `enamed_intelligence_index` + join com `curriculum_specialties`.
 * Acesso: admin / professor (controlado por AdminLayout/AdminRoute no App.tsx).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, FileJson, ShieldAlert, Activity, RefreshCw, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  specialty_id: string;
  subspecialty_id: string | null;
  exam_key: string;
  question_count: number;
  historical_frequency: number | null;
  student_error_rate: number | null;
  fsrs_risk: number | null;
  priority_score: number | null;
  confidence_level: string | null;
  sample_size: number | null;
  computed_at: string;
  computation_version: string | null;
  specialty_name?: string;
};

type SortKey = "priority_score" | "historical_frequency" | "question_count";

const CONFIDENCE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  experimental: "outline",
  low: "secondary",
  medium: "default",
  high: "default",
};

export default function IntelligenceIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [minPriority, setMinPriority] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority_score");
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<null | {
    count: number;
    min: number | null;
    avg: number | null;
    max: number | null;
    nulls: number;
  }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [idxRes, specRes] = await Promise.all([
        supabase
          .from("enamed_intelligence_index")
          .select("*")
          .order("priority_score", { ascending: false }),
        supabase.from("curriculum_specialties").select("id, nome"),
      ]);
      if (idxRes.error) throw idxRes.error;
      if (specRes.error) throw specRes.error;
      const specMap = new Map<string, string>(
        (specRes.data ?? []).map((s: any) => [s.id, s.nome]),
      );
      const merged = (idxRes.data ?? []).map((r: any) => ({
        ...r,
        specialty_name: specMap.get(r.specialty_id) ?? r.specialty_id,
      }));
      setRows(merged as Row[]);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar índice");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAudit = useCallback(async () => {
    setAuditing(true);
    try {
      const { data, error: e } = await supabase
        .from("enamed_intelligence_index")
        .select("priority_score");
      if (e) throw e;
      const scores = (data ?? []).map((r: any) => r.priority_score);
      const valid = scores.filter((s) => s != null) as number[];
      const nulls = scores.length - valid.length;
      setAudit({
        count: scores.length,
        min: valid.length ? Math.min(...valid) : null,
        max: valid.length ? Math.max(...valid) : null,
        avg: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null,
        nulls,
      });
      toast.success("Auditoria concluída");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na auditoria");
    } finally {
      setAuditing(false);
    }
  }, []);

  const specialties = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.specialty_id, r.specialty_name ?? r.specialty_id));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const confidences = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.confidence_level && set.add(r.confidence_level));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (specialtyFilter !== "all") r = r.filter((x) => x.specialty_id === specialtyFilter);
    if (confidenceFilter !== "all") r = r.filter((x) => x.confidence_level === confidenceFilter);
    const minP = parseFloat(minPriority);
    if (!isNaN(minP)) r = r.filter((x) => (x.priority_score ?? -Infinity) >= minP);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => (x.specialty_name ?? "").toLowerCase().includes(q));
    }
    r.sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity));
    return r;
  }, [rows, specialtyFilter, confidenceFilter, minPriority, search, sortKey]);

  const stats = useMemo(() => {
    const scores = rows.map((r) => r.priority_score).filter((s) => s != null) as number[];
    const distribution: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.confidence_level ?? "unknown";
      distribution[k] = (distribution[k] ?? 0) + 1;
    });
    return {
      total: rows.length,
      specialties: new Set(rows.map((r) => r.specialty_id)).size,
      avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      min: scores.length ? Math.min(...scores) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      version: rows[0]?.computation_version ?? "—",
      distribution,
    };
  }, [rows]);

  const exportCSV = () => {
    const headers = [
      "specialty", "subspecialty_id", "question_count", "historical_frequency",
      "priority_score", "confidence_level", "sample_size", "computed_at",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      lines.push([
        JSON.stringify(r.specialty_name ?? ""),
        r.subspecialty_id ?? "",
        r.question_count,
        r.historical_frequency ?? "",
        r.priority_score ?? "",
        r.confidence_level ?? "",
        r.sample_size ?? "",
        r.computed_at,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intelligence-index-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intelligence-index-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">ENAMED Intelligence Index</h1>
          <p className="text-muted-foreground mt-1">
            Painel administrativo read-only · Sprint Intel-1 / Fase 3
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>VERSÃO EXPERIMENTAL</AlertTitle>
        <AlertDescription className="space-y-1 mt-2">
          <div><strong>Computation Version:</strong> {stats.version}</div>
          <div><strong>Student Error Rate:</strong> não disponível</div>
          <div><strong>FSRS Risk:</strong> não disponível</div>
          <div><strong>Fonte atual:</strong> Historical Frequency Only</div>
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Especialidades" value={stats.specialties} />
        <StatCard label="Registros" value={stats.total} />
        <StatCard label="Score Médio" value={stats.avg.toFixed(2)} />
        <StatCard label="Score Máx" value={stats.max.toFixed(2)} />
        <StatCard label="Score Mín" value={stats.min.toFixed(2)} />
        <StatCard label="Versão" value={stats.version} small />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Confidence</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 space-y-1">
            {Object.entries(stats.distribution).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <Badge variant={CONFIDENCE_VARIANT[k] ?? "outline"} className="text-[10px]">{k}</Badge>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Auditoria Integrada
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={runAudit} disabled={auditing} size="sm">
                {auditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Auditar Índice
              </Button>
              <Button onClick={exportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button onClick={exportJSON} variant="outline" size="sm">
                <FileJson className="h-4 w-4 mr-2" /> JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        {audit && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              <Metric label="COUNT(*)" value={audit.count} />
              <Metric label="MIN" value={audit.min?.toFixed(2) ?? "—"} />
              <Metric label="AVG" value={audit.avg?.toFixed(4) ?? "—"} />
              <Metric label="MAX" value={audit.max?.toFixed(2) ?? "—"} />
              <Metric label="NULLs" value={audit.nulls} />
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros & Ordenação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            placeholder="Buscar especialidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger><SelectValue placeholder="Especialidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas especialidades</SelectItem>
              {specialties.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger><SelectValue placeholder="Confidence" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas confidences</SelectItem>
              {confidences.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            placeholder="Priority Score mínimo"
            value={minPriority}
            onChange={(e) => setMinPriority(e.target.value)}
          />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority_score">Ordenar: Priority Score ↓</SelectItem>
              <SelectItem value="historical_frequency">Ordenar: Historical Freq ↓</SelectItem>
              <SelectItem value="question_count">Ordenar: Question Count ↓</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Índice ({filtered.length} de {rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Subespecialidade</TableHead>
                    <TableHead className="text-right">Question Count</TableHead>
                    <TableHead className="text-right">Historical Freq</TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => setSortKey("priority_score")} className="inline-flex items-center gap-1">
                        Priority Score <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Sample Size</TableHead>
                    <TableHead>Computed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.specialty_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.subspecialty_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.question_count}</TableCell>
                      <TableCell className="text-right font-mono">
                        {r.historical_frequency?.toFixed(4) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.priority_score?.toFixed(2) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={CONFIDENCE_VARIANT[r.confidence_level ?? ""] ?? "outline"}>
                          {r.confidence_level ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.sample_size ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.computed_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum registro com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={small ? "text-sm font-mono break-all" : "text-2xl font-bold"}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}
