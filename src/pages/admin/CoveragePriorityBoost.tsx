/**
 * /admin/coverage-boost
 * ─────────────────────
 * Coverage → Study Engine Bridge (Fase 1.4)
 * Mostra observabilidade da camada de boost: quantos subtopics estão recebendo
 * boost, distribuição por nível/especialidade, top-20 com maior boost, principais
 * motivos. Read-only — apenas leitura sobre a auditoria já existente.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCoveragePriorityMap } from "@/hooks/useCoveragePriorityMap";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import {
  appliedBoostFromScore,
  boostBadgeVariant,
  boostLevelLabel,
  type CoverageBoostLevel,
} from "@/lib/coveragePriorityBoost";
import { statusBadgeVariant, statusLabel } from "@/lib/coverageRules";
import { useContentCoverageAudit } from "@/hooks/useContentCoverageAudit";
import { useStructuralCoverageHealth, badgeVariant as healthVariant, badgeLabel as healthLabel } from "@/hooks/useStructuralCoverageHealth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Zap, AlertTriangle, BookOpen, FlaskConical, ListChecks, Link2, Type, HelpCircle, Database, RefreshCw } from "lucide-react";

interface MatchStats {
  subtopic_id: number;
  topic_id: number;
  name: number;
  none: number;
  touched: number;
  timestamp: number;
}

const LEVEL_ORDER: CoverageBoostLevel[] = ["critical", "high", "medium", "low", "none"];

export default function CoveragePriorityBoostPanel() {
  const { entries, stats, loading } = useCoveragePriorityMap();
  const { data: audit } = useContentCoverageAudit();
  const { data: health, refetch: refetchHealth, isFetching: healthLoading } = useStructuralCoverageHealth();
  const { isEnabled } = useFeatureFlags();
  const flagEnabled = isEnabled("coverage_priority_boost_enabled");
  const [search, setSearch] = useState("");
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [running, setRunning] = useState(false);

  const runBackfill = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-temas-estudados-ids");
      if (error) throw error;
      const r = (data as any)?.report;
      if (r) {
        toast.success(
          `Backfill concluído: +${r.filledBySubtopicExact + r.filledBySubtopicViaTema} subtopic, +${r.filledByTopicViaTema} topic. ${r.remainingUnmatched} sem match.`
        );
      } else {
        toast.success("Backfill executado.");
      }
      await refetchHealth();
    } catch (e: any) {
      toast.error(`Falha no backfill: ${e?.message ?? "erro desconhecido"}`);
    } finally {
      setRunning(false);
    }
  };

  // Lê stats de match expostas pelo Study Engine (Fase 1.5).
  // Atualiza a cada 2s — leve e read-only. Nunca lança.
  useEffect(() => {
    const tick = () => {
      try {
        const s = (globalThis as any).__coverageBoostMatchStats;
        if (s && typeof s === "object") setMatchStats(s as MatchStats);
      } catch { /* noop */ }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  // Junta entry de boost com row da auditoria (para mostrar status/contagens)
  const enriched = useMemo(() => {
    if (!audit?.rows) return [];
    const auditById = new Map(audit.rows.map((r) => [r.subtopic_id, r]));
    return entries
      .map((e) => ({ entry: e, row: auditById.get(e.subtopicId) }))
      .filter((x) => !!x.row);
  }, [entries, audit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      ({ entry }) =>
        entry.subtopicName.toLowerCase().includes(q) ||
        entry.specialtyName.toLowerCase().includes(q) ||
        entry.topicName.toLowerCase().includes(q),
    );
  }, [enriched, search]);

  const top20 = useMemo(
    () => [...enriched].sort((a, b) => b.entry.boostScore - a.entry.boostScore).slice(0, 20),
    [enriched],
  );

  const highImpStillCritical = useMemo(
    () =>
      enriched.filter(
        ({ row, entry }) =>
          row?.importance_level === "muito_cobrado" &&
          (row?.status === "critical" || row?.status === "missing") &&
          entry.boostScore > 0,
      ).length,
    [enriched],
  );

  const boostByMaterialGap = useMemo(
    () => enriched.filter(({ entry }) => entry.boostBreakdown.pedagogyGapBoost > 0).length,
    [enriched],
  );
  const boostByQuestionGap = useMemo(
    () => enriched.filter(({ entry }) => entry.boostBreakdown.questionGapBoost > 0).length,
    [enriched],
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Coverage → Study Engine Bridge
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Observabilidade da camada que prioriza assuntos muito cobrados e mal cobertos.
          </p>
        </div>
        <Badge variant={flagEnabled ? "default" : "outline"}>
          Flag: {flagEnabled ? "ON" : "OFF"}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Subtopics com boost</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalBoosted}</div>
            <p className="text-xs text-muted-foreground mt-1">de {entries.length} totais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Muito cobrado + crítico</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{highImpStillCritical}</div>
            <p className="text-xs text-muted-foreground mt-1">prioridade máxima</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" />Boost por falta de material</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{boostByMaterialGap}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" />Boost por falta de questões</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{boostByQuestionGap}</div>
          </CardContent>
        </Card>
      </div>

      {/* Match Method Stats (Fase 1.5) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Resolução do boost por método (Fase 1.5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matchStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-primary/5">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">por subtopic_id</span>
                </div>
                <Badge variant="default">{matchStats.subtopic_id}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <span className="text-sm">por topic_id</span>
                </div>
                <Badge variant="secondary">{matchStats.topic_id}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">por nome (legado)</span>
                </div>
                <Badge variant="outline">{matchStats.name}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">sem match</span>
                </div>
                <Badge variant="outline">{matchStats.none}</Badge>
              </div>
              <div className="md:col-span-4 text-xs text-muted-foreground pt-1">
                Total de recs com boost aplicado: <span className="font-semibold">{matchStats.touched}</span>.
                Quanto maior a fração estrutural (subtopic_id + topic_id), menor a dependência de matching textual.
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aguardando primeira execução do Study Engine após o login para coletar estatísticas de match…
            </p>
          )}
        </CardContent>
      </Card>

      {/* Distribuição por nível */}
      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição por nível de boost</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {LEVEL_ORDER.map((lvl) => (
              <div key={lvl} className="flex items-center gap-2 px-3 py-2 rounded-md border">
                <Badge variant={boostBadgeVariant(lvl)}>{boostLevelLabel(lvl)}</Badge>
                <span className="text-sm font-semibold">{stats.byLevel[lvl] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 20 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20 — maior boost calculado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-2">Subtopic</th>
                  <th className="text-left py-2 px-2">Especialidade</th>
                  <th className="text-left py-2 px-2">Importância</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Q</th>
                  <th className="text-right py-2 px-2">Mat</th>
                  <th className="text-right py-2 px-2">Flash</th>
                  <th className="text-right py-2 px-2">Bancas</th>
                  <th className="text-right py-2 px-2">Score</th>
                  <th className="text-right py-2 px-2">Aplicado</th>
                  <th className="text-left py-2 px-2">Nível</th>
                  <th className="text-left py-2 px-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {top20.map(({ entry, row }) => (
                  <tr key={entry.subtopicId} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-medium">{entry.subtopicName}</td>
                    <td className="py-2 px-2 text-muted-foreground">{entry.specialtyName}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-xs">{row?.importance_level ?? "—"}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      {row && <Badge variant={statusBadgeVariant(row.status)} className="text-xs">{statusLabel(row.status)}</Badge>}
                    </td>
                    <td className="py-2 px-2 text-right">{row?.questions_count ?? 0}</td>
                    <td className="py-2 px-2 text-right">{row?.materials_count ?? 0}</td>
                    <td className="py-2 px-2 text-right">{row?.flashcards_count ?? 0}</td>
                    <td className="py-2 px-2 text-right">{row?.banca_coverage_count ?? 0}</td>
                    <td className="py-2 px-2 text-right font-semibold">{entry.boostScore}</td>
                    <td className="py-2 px-2 text-right text-primary">+{appliedBoostFromScore(entry.boostScore)}</td>
                    <td className="py-2 px-2">
                      <Badge variant={boostBadgeVariant(entry.boostLevel)} className="text-xs">{boostLevelLabel(entry.boostLevel)}</Badge>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground max-w-[260px] truncate" title={entry.boostReason}>{entry.boostReason}</td>
                  </tr>
                ))}
                {top20.length === 0 && (
                  <tr><td colSpan={12} className="py-6 text-center text-muted-foreground">Nenhum subtopic recebendo boost no momento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Por especialidade */}
      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição por especialidade</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {stats.bySpecialty.slice(0, 18).map((s) => (
              <div key={s.specialty} className="flex justify-between items-center px-3 py-2 rounded-md border">
                <span className="text-sm truncate">{s.specialty}</span>
                <Badge variant="secondary">{s.total}</Badge>
              </div>
            ))}
            {stats.bySpecialty.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados de boost agregados.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top motivos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Principais motivos de boost</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {stats.topReasons.map((r) => (
              <li key={r.reason} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{r.reason}</span>
                <Badge variant="secondary">{r.count}</Badge>
              </li>
            ))}
            {stats.topReasons.length === 0 && (
              <p className="text-muted-foreground">Sem motivos agregados.</p>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Tabela completa filtrável */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <CardTitle className="text-base">Todos os subtopics com boost</CardTitle>
            <Input
              placeholder="Buscar por subtopic, tópico ou especialidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground sticky top-0 bg-background">
                <tr>
                  <th className="text-left py-2 px-2">Subtopic</th>
                  <th className="text-left py-2 px-2">Especialidade</th>
                  <th className="text-right py-2 px-2">Score</th>
                  <th className="text-right py-2 px-2">+Aplicado</th>
                  <th className="text-left py-2 px-2">Nível</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .filter(({ entry }) => entry.boostScore > 0)
                  .sort((a, b) => b.entry.boostScore - a.entry.boostScore)
                  .slice(0, 200)
                  .map(({ entry }) => (
                    <tr key={entry.subtopicId} className="border-b hover:bg-muted/40">
                      <td className="py-1.5 px-2">{entry.subtopicName}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{entry.specialtyName}</td>
                      <td className="py-1.5 px-2 text-right font-semibold">{entry.boostScore}</td>
                      <td className="py-1.5 px-2 text-right text-primary">+{appliedBoostFromScore(entry.boostScore)}</td>
                      <td className="py-1.5 px-2">
                        <Badge variant={boostBadgeVariant(entry.boostLevel)} className="text-xs">{boostLevelLabel(entry.boostLevel)}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
