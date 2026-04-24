/**
 * /admin/tutor-memory
 * ───────────────────
 * Governança da memória pedagógica do Tutor IA.
 *
 * Mostra:
 *  - Cards de resumo (totais, médias, baixa qualidade, reuso)
 *  - Top 20 reutilizadas
 *  - Top 20 baixa qualidade (< 50)
 *  - Distribuição por block_type
 *  - Distribuição por topic/subtopic
 *
 * Filtros: scope, block_type, topic, faixa de qualidade.
 * Mobile-friendly. Funciona com tabela vazia.
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Brain,
  Database,
  RefreshCw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Globe,
  User,
} from "lucide-react";
import { MEMORY_DEGRADED_THRESHOLD } from "@/lib/tutor/tutorMemory";

const PAGE_SIZE = 1000; // limite duro para auditoria.

interface MemoryRow {
  id: string;
  user_id: string | null;
  scope: "global" | "user";
  question_original: string;
  question_normalized: string;
  topic: string | null;
  subtopic: string | null;
  specialty: string | null;
  intent: string | null;
  difficulty_level: string | null;
  block_types: string[] | null;
  quality_score: number;
  reuse_count: number;
  source: string;
  model_used: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  embedding_status?: string | null;
}

const truncate = (s: string | null | undefined, n = 80) => {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
};

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
};

const QualityBadge = ({ score }: { score: number }) => {
  let tone: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (score >= 80) tone = "default";
  else if (score < MEMORY_DEGRADED_THRESHOLD) tone = "destructive";
  else if (score < 70) tone = "outline";
  return <Badge variant={tone}>{Math.round(score)}</Badge>;
};

const ScopeBadge = ({ scope }: { scope: "global" | "user" }) => {
  const Icon = scope === "global" ? Globe : User;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="h-3 w-3" aria-hidden />
      {scope === "global" ? "global" : "pessoal"}
    </Badge>
  );
};

export default function TutorMemoryAdmin() {
  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "user">(
    "all",
  );
  const [blockTypeFilter, setBlockTypeFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [minQuality, setMinQuality] = useState<string>("");
  const [maxQuality, setMaxQuality] = useState<string>("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "tutor-memory", "rows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_knowledge_memory")
        .select(
          "id, user_id, scope, question_original, question_normalized, topic, subtopic, specialty, intent, difficulty_level, block_types, quality_score, reuse_count, source, model_used, created_at, updated_at, last_used_at, embedding_status",
        )
        .order("updated_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      return (data as unknown as MemoryRow[]) ?? [];
    },
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  // ── Filtros aplicados ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
      if (blockTypeFilter !== "all") {
        const types = r.block_types ?? [];
        if (!types.includes(blockTypeFilter)) return false;
      }
      if (topicFilter.trim()) {
        const needle = topicFilter.trim().toLowerCase();
        const hay = `${r.topic ?? ""} ${r.subtopic ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const min = parseFloat(minQuality);
      const max = parseFloat(maxQuality);
      if (!Number.isNaN(min) && r.quality_score < min) return false;
      if (!Number.isNaN(max) && r.quality_score > max) return false;
      return true;
    });
  }, [rows, scopeFilter, blockTypeFilter, topicFilter, minQuality, maxQuality]);

  // ── Resumos (computados no cliente; volume é pequeno por padrão) ─────────
  const summary = useMemo(() => {
    const total = rows.length;
    const totalGlobal = rows.filter((r) => r.scope === "global").length;
    const totalUser = rows.filter((r) => r.scope === "user").length;
    const avgQuality =
      total > 0
        ? rows.reduce((acc, r) => acc + (r.quality_score ?? 0), 0) / total
        : 0;
    const belowThreshold = rows.filter(
      (r) => r.quality_score < MEMORY_DEGRADED_THRESHOLD,
    ).length;
    const aboveStrong = rows.filter((r) => r.quality_score >= 80).length;
    const totalReuse = rows.reduce((acc, r) => acc + (r.reuse_count ?? 0), 0);
    return {
      total,
      totalGlobal,
      totalUser,
      avgQuality,
      belowThreshold,
      aboveStrong,
      totalReuse,
    };
  }, [rows]);

  const topReused = useMemo(
    () =>
      [...filtered]
        .filter((r) => r.reuse_count > 0)
        .sort((a, b) => b.reuse_count - a.reuse_count)
        .slice(0, 20),
    [filtered],
  );

  const lowQuality = useMemo(
    () =>
      [...filtered]
        .filter((r) => r.quality_score < MEMORY_DEGRADED_THRESHOLD)
        .sort((a, b) => a.quality_score - b.quality_score)
        .slice(0, 20),
    [filtered],
  );

  const byBlockType = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      (r.block_types ?? []).forEach((t) => {
        map.set(t, (map.get(t) ?? 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const byTopic = useMemo(() => {
    const map = new Map<
      string,
      { topic: string; subtopic: string; count: number; sumQuality: number }
    >();
    filtered.forEach((r) => {
      const key = `${r.topic ?? "—"}::${r.subtopic ?? "—"}`;
      const cur = map.get(key) ?? {
        topic: r.topic ?? "—",
        subtopic: r.subtopic ?? "—",
        count: 0,
        sumQuality: 0,
      };
      cur.count += 1;
      cur.sumQuality += r.quality_score ?? 0;
      map.set(key, cur);
    });
    return [...map.values()]
      .map((v) => ({
        ...v,
        avgQuality: v.count > 0 ? v.sumQuality / v.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [filtered]);

  const allBlockTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => (r.block_types ?? []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [rows]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Memória Pedagógica do Tutor
          </h1>
          <p className="text-sm text-muted-foreground">
            Governança da camada de reuso adaptativo. Memórias abaixo de{" "}
            {MEMORY_DEGRADED_THRESHOLD} pontos não são reutilizadas
            automaticamente.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </header>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Database className="h-4 w-4" />}
          label="Total"
          value={summary.total}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Globe className="h-4 w-4" />}
          label="Globais"
          value={summary.totalGlobal}
          loading={isLoading}
        />
        <SummaryCard
          icon={<User className="h-4 w-4" />}
          label="Pessoais"
          value={summary.totalUser}
          loading={isLoading}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Reutilizações"
          value={summary.totalReuse}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Qualidade média"
          value={Math.round(summary.avgQuality)}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Sparkles className="h-4 w-4 text-success" />}
          label="≥ 80 (boas)"
          value={summary.aboveStrong}
          loading={isLoading}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label={`< ${MEMORY_DEGRADED_THRESHOLD} (degradadas)`}
          value={summary.belowThreshold}
          loading={isLoading}
        />
        <SummaryCard
          icon={<Brain className="h-4 w-4" />}
          label="Filtradas"
          value={filtered.length}
          loading={isLoading}
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Refinam todas as tabelas e distribuições abaixo. Cards de resumo
            usam a base completa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Escopo</label>
            <Select
              value={scopeFilter}
              onValueChange={(v) => setScopeFilter(v as typeof scopeFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="user">Pessoal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Block type</label>
            <Select value={blockTypeFilter} onValueChange={setBlockTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {allBlockTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Topic/subtopic</label>
            <Input
              value={topicFilter}
              placeholder="ex: cardiologia"
              onChange={(e) => setTopicFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Qualidade mín.</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minQuality}
              onChange={(e) => setMinQuality(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Qualidade máx.</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={maxQuality}
              onChange={(e) => setMaxQuality(e.target.value)}
              placeholder="100"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="top">
        <TabsList className="w-full md:w-auto flex-wrap h-auto">
          <TabsTrigger value="top">Top reutilizadas</TabsTrigger>
          <TabsTrigger value="low">Baixa qualidade</TabsTrigger>
          <TabsTrigger value="blocks">Por tipo de bloco</TabsTrigger>
          <TabsTrigger value="topics">Por topic/subtopic</TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <MemoryTable
            rows={topReused}
            emptyLabel="Nenhuma memória reutilizada ainda."
            loading={isLoading}
          />
        </TabsContent>

        <TabsContent value="low">
          <MemoryTable
            rows={lowQuality}
            emptyLabel={`Nenhuma memória abaixo de ${MEMORY_DEGRADED_THRESHOLD} pontos.`}
            loading={isLoading}
            actionsCol
          />
        </TabsContent>

        <TabsContent value="blocks">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de bloco</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : byBlockType.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        Nenhum bloco registrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    byBlockType.map((b) => (
                      <TableRow key={b.type}>
                        <TableCell className="font-mono text-xs">
                          {b.type}
                        </TableCell>
                        <TableCell className="text-right">{b.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Subtopic</TableHead>
                    <TableHead className="text-right">Memórias</TableHead>
                    <TableHead className="text-right">Qualidade méd.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : byTopic.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        Sem dados para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    byTopic.map((t) => (
                      <TableRow key={`${t.topic}::${t.subtopic}`}>
                        <TableCell className="text-xs">{t.topic}</TableCell>
                        <TableCell className="text-xs">{t.subtopic}</TableCell>
                        <TableCell className="text-right">{t.count}</TableCell>
                        <TableCell className="text-right">
                          <QualityBadge score={t.avgQuality} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
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
          <p className="text-xl md:text-2xl font-semibold mt-1">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MemoryTable({
  rows,
  emptyLabel,
  loading,
  actionsCol,
}: {
  rows: MemoryRow[];
  emptyLabel: string;
  loading?: boolean;
  actionsCol?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">Pergunta</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Subtopic</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead className="text-right">Quality</TableHead>
              <TableHead className="text-right">Reuso</TableHead>
              <TableHead>Tipos</TableHead>
              <TableHead>Atualizada</TableHead>
              {actionsCol && <TableHead>Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={actionsCol ? 9 : 8}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={actionsCol ? 9 : 8}
                  className="text-center text-sm text-muted-foreground py-6"
                >
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell
                    className="text-xs font-medium"
                    title={r.question_original}
                  >
                    {truncate(r.question_original, 90)}
                  </TableCell>
                  <TableCell className="text-xs">{r.topic ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.subtopic ?? "—"}</TableCell>
                  <TableCell>
                    <ScopeBadge scope={r.scope} />
                  </TableCell>
                  <TableCell className="text-right">
                    <QualityBadge score={r.quality_score} />
                  </TableCell>
                  <TableCell className="text-right">{r.reuse_count}</TableCell>
                  <TableCell className="text-xs">
                    {(r.block_types ?? []).slice(0, 3).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="mr-1 mb-1 font-mono text-[10px]"
                      >
                        {t}
                      </Badge>
                    ))}
                    {(r.block_types?.length ?? 0) > 3 && (
                      <span className="text-muted-foreground">
                        +{(r.block_types?.length ?? 0) - 3}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(r.updated_at)}
                  </TableCell>
                  {actionsCol && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled
                        title="Disponível em sprint futura"
                      >
                        Regerar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
