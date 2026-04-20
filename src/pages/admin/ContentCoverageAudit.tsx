/**
 * /admin/coverage
 * ───────────────
 * Painel de auditoria de Cobertura Completa do acervo (Fase 1.1).
 * Lê em tempo real curriculum_subtopics + curriculum_weights (com importance) +
 * question_topic_links (Tier 1 strong + Tier 2 medium) e classifica cada
 * subtopic em complete / partial / critical / missing.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useContentCoverageAudit } from "@/hooks/useContentCoverageAudit";
import { statusBadgeVariant, statusLabel, type CoverageStatus, type ImportanceLevel } from "@/lib/coverageRules";
import { AlertTriangle, BookOpen, Layers, ListChecks, ScanSearch, Flame, Link2, FileText, Sparkles, GraduationCap } from "lucide-react";

type ImportanceFilter = "all" | "muito_cobrado" | "cobrado" | "pouco_cobrado" | "raro";

const IMPORTANCE_LABEL: Record<NonNullable<ImportanceLevel>, string> = {
  muito_cobrado: "Muito cobrado",
  cobrado: "Cobrado",
  pouco_cobrado: "Pouco cobrado",
  raro: "Raro",
};

function importanceBadgeVariant(level: ImportanceLevel): "default" | "secondary" | "outline" | "destructive" {
  if (level === "muito_cobrado") return "destructive";
  if (level === "cobrado") return "default";
  if (level === "pouco_cobrado") return "secondary";
  return "outline";
}

export default function ContentCoverageAudit() {
  const { data, isLoading, error } = useContentCoverageAudit();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CoverageStatus | "all">("all");
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>("all");

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (importanceFilter !== "all" && r.importance_level !== importanceFilter) return false;
      if (!q) return true;
      return (
        r.subtopic_nome.toLowerCase().includes(q) ||
        r.topic_nome.toLowerCase().includes(q) ||
        r.specialty_nome.toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter, importanceFilter]);

  // Lista destacada: muito_cobrado/cobrado sem questões
  const highImpZeroQ = useMemo(
    () =>
      data?.rows
        .filter(
          (r) =>
            (r.importance_level === "muito_cobrado" || r.importance_level === "cobrado") &&
            r.questions_count === 0,
        )
        .sort((a, b) => b.max_peso - a.max_peso)
        .slice(0, 30) ?? [],
    [data],
  );

  if (isLoading) {
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

  if (error || !data) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-destructive">
          Erro ao carregar auditoria de cobertura.
        </CardContent></Card>
      </div>
    );
  }

  const { kpis, byDomain, byBanca, criticalGaps } = data;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanSearch className="h-6 w-6 text-primary" />
            Cobertura Completa do Acervo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria de domínios, assuntos e subassuntos cobertos pelo acervo de questões e materiais.
            <span className="ml-1 text-xs">(v1.2 — pedagogia + microtopics)</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{kpis.totalSubtopics} subtópicos</Badge>
          <Badge variant="outline" className="text-xs">
            <Link2 className="h-3 w-3 mr-1" />
            {kpis.totalLinks} links ({kpis.totalStrongLinks} fortes)
          </Badge>
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {kpis.totalMaterials} materiais
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            {kpis.totalFlashcards} flashcards
          </Badge>
          <Badge variant="outline" className="text-xs">
            <GraduationCap className="h-3 w-3 mr-1" />
            {kpis.totalMicrotopics} microtopics
          </Badge>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Layers className="h-5 w-5" />} label="Especialidades" value={kpis.totalSpecialties} />
        <KpiCard icon={<BookOpen className="h-5 w-5" />} label="Assuntos" value={kpis.totalTopics} />
        <KpiCard icon={<ListChecks className="h-5 w-5" />} label="Subassuntos" value={kpis.totalSubtopics} />
        <KpiCard
          icon={<Flame className="h-5 w-5 text-destructive" />}
          label="Alta importância sem Q"
          value={kpis.highImportanceWithoutQuestions}
        />
      </div>

      {/* KPIs pedagógicos Fase 1.2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
          label="Sem material"
          value={kpis.subtopicsWithoutMaterial}
        />
        <KpiCard
          icon={<Sparkles className="h-5 w-5 text-muted-foreground" />}
          label="Sem flashcard"
          value={kpis.subtopicsWithoutFlashcard}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-destructive/70" />}
          label="Tem Q mas sem material"
          value={kpis.subtopicsQuestionsButNoMaterial}
        />
      </div>

      {/* Status global */}
      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição Global</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <StatusBar label="Completo" value={kpis.byStatus.complete} total={kpis.totalSubtopics} variant="default" />
          <StatusBar label="Parcial" value={kpis.byStatus.partial} total={kpis.totalSubtopics} variant="secondary" />
          <StatusBar label="Crítico" value={kpis.byStatus.critical} total={kpis.totalSubtopics} variant="destructive" />
          <StatusBar label="Ausente" value={kpis.byStatus.missing} total={kpis.totalSubtopics} variant="outline" />
        </CardContent>
      </Card>

      <Tabs defaultValue="domains">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="domains">Por Domínio</TabsTrigger>
          <TabsTrigger value="bancas">Por Banca</TabsTrigger>
          <TabsTrigger value="hot">🔥 Muito cobrado sem Q</TabsTrigger>
          <TabsTrigger value="gaps">Lacunas Críticas</TabsTrigger>
          <TabsTrigger value="all">Todos os Subassuntos</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cobertura por Domínio</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2">Especialidade</th>
                      <th className="text-right">Subassuntos</th>
                      <th className="text-right">✓ Completo</th>
                      <th className="text-right">⚠ Parcial</th>
                      <th className="text-right">✕ Crítico</th>
                      <th className="text-right">○ Ausente</th>
                      <th className="text-right">% Completo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDomain.map((d) => (
                      <tr key={d.specialty} className="border-b hover:bg-muted/50">
                        <td className="py-2 font-medium">{d.specialty}</td>
                        <td className="text-right">{d.totalSubtopics}</td>
                        <td className="text-right">{d.complete}</td>
                        <td className="text-right">{d.partial}</td>
                        <td className="text-right text-destructive">{d.critical}</td>
                        <td className="text-right text-muted-foreground">{d.missing}</td>
                        <td className="text-right font-medium">{d.pctComplete}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bancas" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cobertura por Banca</CardTitle></CardHeader>
            <CardContent>
              {byBanca.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma incidência por banca mapeada ainda em <code>curriculum_weights</code>.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2">Banca</th>
                        <th className="text-right">Mapeados</th>
                        <th className="text-right">Com questões</th>
                        <th className="text-right">Lacunas</th>
                        <th className="text-right">% Cobertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byBanca.map((b) => (
                        <tr key={b.banca} className="border-b hover:bg-muted/50">
                          <td className="py-2 font-medium">{b.banca}</td>
                          <td className="text-right">{b.totalMapped}</td>
                          <td className="text-right">{b.totalWithQuestions}</td>
                          <td className="text-right text-destructive">{b.gaps}</td>
                          <td className="text-right font-medium">{b.pctCovered}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nova aba — Fase 1.1 */}
        <TabsContent value="hot" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />
                Top {highImpZeroQ.length} subtópicos muito cobrados SEM questões
              </CardTitle>
            </CardHeader>
            <CardContent>
              {highImpZeroQ.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  🎉 Nenhum subtópico de alta importância está sem questões linkadas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {highImpZeroQ.map((r) => (
                    <li key={r.subtopic_id} className="flex items-start justify-between gap-3 p-3 rounded border bg-card">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{r.subtopic_nome}</div>
                        <div className="text-xs text-muted-foreground">{r.specialty_nome} · {r.topic_nome}</div>
                        <div className="text-xs mt-1 text-muted-foreground">
                          Peso máx: <strong>{r.max_peso}</strong> · Bancas mapeadas: {r.banca_coverage_count}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={importanceBadgeVariant(r.importance_level)} className="text-[10px]">
                          {r.importance_level ? IMPORTANCE_LABEL[r.importance_level] : "—"}
                        </Badge>
                        <Badge variant={statusBadgeVariant(r.status)} className="text-[10px]">
                          {statusLabel(r.status)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Top {criticalGaps.length} Lacunas Críticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {criticalGaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma lacuna crítica detectada.</p>
              ) : (
                <ul className="space-y-2">
                  {criticalGaps.map((r) => (
                    <li key={r.subtopic_id} className="flex items-start justify-between gap-3 p-3 rounded border bg-card">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{r.subtopic_nome}</div>
                        <div className="text-xs text-muted-foreground">{r.specialty_nome} · {r.topic_nome}</div>
                        <div className="text-xs mt-1">{r.reason}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                        {r.importance_level && (
                          <Badge variant={importanceBadgeVariant(r.importance_level)} className="text-[10px]">
                            {IMPORTANCE_LABEL[r.importance_level]}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Buscar subassunto, assunto ou especialidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-1 flex-wrap">
              {(["all", "complete", "partial", "critical", "missing"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-2 py-1 rounded border ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  {s === "all" ? "Todos status" : statusLabel(s as CoverageStatus)}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "muito_cobrado", "cobrado", "pouco_cobrado", "raro"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setImportanceFilter(i)}
                  className={`text-xs px-2 py-1 rounded border ${importanceFilter === i ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  {i === "all" ? "Toda importância" : IMPORTANCE_LABEL[i]}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filteredRows.length} resultado(s)</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b sticky top-0 bg-card">
                    <tr>
                      <th className="text-left py-2 px-3">Subassunto</th>
                      <th className="text-left">Assunto</th>
                      <th className="text-left">Especialidade</th>
                      <th className="text-left">Importância</th>
                      <th className="text-right">Q (forte/total)</th>
                      <th className="text-right">Mat</th>
                      <th className="text-right">Flash</th>
                      <th className="text-right">Score</th>
                      <th className="text-right">Bancas</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr key={r.subtopic_id} className="border-b hover:bg-muted/40">
                        <td className="py-2 px-3 font-medium">{r.subtopic_nome}</td>
                        <td className="text-muted-foreground">{r.topic_nome}</td>
                        <td className="text-muted-foreground">{r.specialty_nome}</td>
                        <td>
                          {r.importance_level ? (
                            <Badge variant={importanceBadgeVariant(r.importance_level)} className="text-[10px]">
                              {IMPORTANCE_LABEL[r.importance_level]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          <span className={r.strong_questions_count > 0 ? "" : "text-muted-foreground"}>
                            {r.strong_questions_count}
                          </span>
                          <span className="text-muted-foreground">/{r.questions_count}</span>
                        </td>
                        <td className={`text-right tabular-nums ${r.materials_count === 0 ? "text-muted-foreground" : ""}`}>{r.materials_count}</td>
                        <td className={`text-right tabular-nums ${r.flashcards_count === 0 ? "text-muted-foreground" : ""}`}>{r.flashcards_count}</td>
                        <td className="text-right tabular-nums font-medium">{r.coverage_score}</td>
                        <td className="text-right">{r.banca_coverage_count}</td>
                        <td><Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function StatusBar({ label, value, total, variant }: { label: string; value: number; total: number; variant: "default" | "secondary" | "destructive" | "outline" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="flex items-center gap-2">
          <Badge variant={variant} className="text-[10px]">{label}</Badge>
          <span className="text-muted-foreground">{value} de {total}</span>
        </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
