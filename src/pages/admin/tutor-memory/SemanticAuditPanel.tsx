/**
 * SemanticAuditPanel — aba para auditar `tutor_memory_search_logs`.
 *
 * Mostra:
 *  - Cards: total buscas, taxa de reuso, score médio, hybrid médio,
 *    tempo médio, top fallback tier.
 *  - Filtros: reused, fallback_tier, score mínimo, intervalo de dias.
 *  - Tabela: query | semantic | hybrid | tier | match | topic | symptoms |
 *    abbrev | duration | created_at.
 *
 * Lê no máximo 500 linhas (limite duro). Funciona com tabela vazia.
 * RLS já garante que só admin enxerga todos os logs.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Repeat,
  Sparkles,
  Timer,
  Layers,
  AlertTriangle,
} from "lucide-react";

const HARD_LIMIT = 500;

interface LogRow {
  id: string;
  user_id: string | null;
  query: string;
  query_normalized: string | null;
  semantic_score: number | null;
  hybrid_score: number | null;
  matched_memory_id: string | null;
  fallback_tier: string | null;
  topic_overlap: boolean | null;
  symptom_overlap_count: number | null;
  abbreviation_overlap_count: number | null;
  duration_ms: number | null;
  reused: boolean | null;
  threshold_used: number | null;
  created_at: string;
}

const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const fmtMs = (v: number | null | undefined) =>
  v == null ? "—" : `${v}ms`;
const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
};

export function SemanticAuditPanel() {
  const [reusedFilter, setReusedFilter] = useState<"all" | "yes" | "no">("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("");
  const [days, setDays] = useState<"7" | "30" | "90">("30");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tutor-memory", "search-logs", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const { data, error } = await supabase
        .from("tutor_memory_search_logs")
        .select(
          "id, user_id, query, query_normalized, semantic_score, hybrid_score, matched_memory_id, fallback_tier, topic_overlap, symptom_overlap_count, abbreviation_overlap_count, duration_ms, reused, threshold_used, created_at",
        )
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(HARD_LIMIT);
      if (error) throw error;
      return (data as unknown as LogRow[]) ?? [];
    },
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const tiers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.fallback_tier && set.add(r.fallback_tier));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (reusedFilter === "yes" && !r.reused) return false;
      if (reusedFilter === "no" && r.reused) return false;
      if (tierFilter !== "all" && r.fallback_tier !== tierFilter) return false;
      const min = parseFloat(minScore);
      if (!Number.isNaN(min)) {
        const s = r.hybrid_score ?? r.semantic_score ?? 0;
        if (s < min) return false;
      }
      return true;
    });
  }, [rows, reusedFilter, tierFilter, minScore]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const reusedCount = filtered.filter((r) => r.reused).length;
    const reuseRate = total > 0 ? reusedCount / total : 0;
    const semScores = filtered
      .map((r) => r.semantic_score)
      .filter((s): s is number => typeof s === "number");
    const hybScores = filtered
      .map((r) => r.hybrid_score)
      .filter((s): s is number => typeof s === "number");
    const durations = filtered
      .map((r) => r.duration_ms)
      .filter((s): s is number => typeof s === "number");
    const avgSem =
      semScores.length > 0
        ? semScores.reduce((a, b) => a + b, 0) / semScores.length
        : null;
    const avgHyb =
      hybScores.length > 0
        ? hybScores.reduce((a, b) => a + b, 0) / hybScores.length
        : null;
    const avgDur =
      durations.length > 0
        ? Math.round(
            durations.reduce((a, b) => a + b, 0) / durations.length,
          )
        : null;

    const tierMap = new Map<string, number>();
    filtered.forEach((r) => {
      if (r.fallback_tier) {
        tierMap.set(r.fallback_tier, (tierMap.get(r.fallback_tier) ?? 0) + 1);
      }
    });
    const topTier =
      [...tierMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    // Top queries sem match
    const noMatchMap = new Map<string, number>();
    filtered
      .filter((r) => !r.reused)
      .forEach((r) => {
        const k = (r.query_normalized ?? r.query ?? "").slice(0, 80);
        if (k) noMatchMap.set(k, (noMatchMap.get(k) ?? 0) + 1);
      });
    const topNoMatch = [...noMatchMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total,
      reuseRate,
      avgSem,
      avgHyb,
      avgDur,
      topTier,
      topNoMatch,
      noMatchCount: filtered.length - reusedCount,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Cards de telemetria */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="Total buscas"
          value={summary.total}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Repeat className="h-4 w-4 text-success" />}
          label="Taxa de reuso"
          value={`${(summary.reuseRate * 100).toFixed(1)}%`}
          loading={isLoading}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Sem match"
          value={summary.noMatchCount}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Semantic médio"
          value={fmtPct(summary.avgSem)}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          label="Hybrid médio"
          value={fmtPct(summary.avgHyb)}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Timer className="h-4 w-4" />}
          label="Tempo médio"
          value={fmtMs(summary.avgDur)}
          loading={isLoading}
        />
      </div>

      {/* Top tier + Top sem match */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" /> Tier mais usado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="font-mono">
              {summary.topTier}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Top queries sem match
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.topNoMatch.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem dados para o período.
              </p>
            ) : (
              <ul className="text-xs space-y-1">
                {summary.topNoMatch.map(([q, n]) => (
                  <li key={q} className="flex items-center justify-between gap-2">
                    <span className="truncate" title={q}>
                      {q}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {n}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Limite: {HARD_LIMIT} logs mais recentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Reuso</label>
            <Select
              value={reusedFilter}
              onValueChange={(v) => setReusedFilter(v as typeof reusedFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Com match</SelectItem>
                <SelectItem value="no">Sem match</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Fallback tier
            </label>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Score mínimo (0-1)
            </label>
            <Input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="ex: 0.6"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={days} onValueChange={(v) => setDays(v as typeof days)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Query</TableHead>
                <TableHead className="text-right">Semantic</TableHead>
                <TableHead className="text-right">Hybrid</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-right">Topic</TableHead>
                <TableHead className="text-right">Symp.</TableHead>
                <TableHead className="text-right">Abrev.</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    Nenhum log para o período/filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell
                      className="text-xs font-medium max-w-[260px] truncate"
                      title={r.query}
                    >
                      {r.query}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {fmtPct(r.semantic_score)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {fmtPct(r.hybrid_score)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {r.fallback_tier ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.reused ? (
                        <Badge variant="default" className="text-[10px]">
                          sim
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          não
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.topic_overlap ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.symptom_overlap_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.abbreviation_overlap_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {fmtMs(r.duration_ms)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(r.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-lg md:text-xl font-semibold mt-1">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
