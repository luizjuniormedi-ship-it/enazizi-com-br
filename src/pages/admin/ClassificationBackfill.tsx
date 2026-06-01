/**
 * /admin/classification
 * ─────────────────────
 * Backfill incremental e seguro de classificação hierárquica
 * (Sprint 2). Permite executar lotes pequenos manualmente,
 * ver progresso, fila de revisão e amostra de casos ambíguos.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Layers, PlayCircle, AlertTriangle, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";

type TableSource = "questions_bank" | "real_exam_questions";

interface RunResult {
  run_id: string;
  table_source: TableSource;
  batch_size: number;
  dry_run: boolean;
  total_processed: number;
  total_applied: number;
  total_queued_review: number;
  total_skipped: number;
  method_breakdown: Record<string, number>;
  sample_ambiguous: Array<{
    question_id: string;
    topic: string | null;
    subtopic: string | null;
    suggestion?: { reason: string; confidence: number };
    reason?: string;
  }>;
}

function useClassificationProgress() {
  return useQuery({
    queryKey: ["classification-progress"],
    queryFn: async () => {
      const [qb, qbDone, req, reqDone, queue, runs] = await Promise.all([
        supabase.from("questions_bank").select("id", { count: "exact", head: true }),
        supabase.from("questions_bank").select("id", { count: "exact", head: true }).not("specialty_id", "is", null),
        supabase.from("real_exam_questions").select("id", { count: "exact", head: true }),
        supabase.from("real_exam_questions").select("id", { count: "exact", head: true }).not("specialty_id", "is", null),
        supabase.from("question_classification_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("question_classification_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(10),
      ]);
      return {
        qbTotal: qb.count ?? 0,
        qbDone: qbDone.count ?? 0,
        reqTotal: req.count ?? 0,
        reqDone: reqDone.count ?? 0,
        queuePending: queue.count ?? 0,
        recentRuns: runs.data ?? [],
      };
    },
    refetchInterval: 10_000,
  });
}

function useReviewQueue(limit = 20) {
  return useQuery({
    queryKey: ["classification-queue", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_classification_queue")
        .select("*, suggested_specialty:curriculum_specialties!suggested_specialty_id(nome), suggested_topic:curriculum_topics!suggested_topic_id(nome)")
        .eq("status", "pending")
        .order("confidence_score", { ascending: true })
        .limit(limit);
      if (error) throw error;
      const items = data ?? [];

      // Enriquecer com enunciado da questão (statement/options) buscando
      // na tabela correta (questions_bank ou real_exam_questions).
      const byTable: Record<string, string[]> = {};
      for (const it of items) {
        const t = (it as any).table_source as string;
        if (!byTable[t]) byTable[t] = [];
        byTable[t].push((it as any).question_id);
      }
      const stemMap = new Map<string, { statement: string | null; options: any; correct_index: number | null }>();
      for (const [table, ids] of Object.entries(byTable)) {
        if (!ids.length) continue;
        const { data: qs } = await supabase
          .from(table as "questions_bank" | "real_exam_questions")
          .select("id, statement, options, correct_index")
          .in("id", ids);
        for (const q of qs ?? []) {
          stemMap.set(`${table}:${(q as any).id}`, {
            statement: (q as any).statement ?? null,
            options: (q as any).options ?? null,
            correct_index: (q as any).correct_index ?? null,
          });
        }
      }
      return items.map((it: any) => ({
        ...it,
        _question: stemMap.get(`${it.table_source}:${it.question_id}`) ?? null,
      }));
    },
  });
}

export default function ClassificationBackfill() {
  const qc = useQueryClient();
  const [tableSource, setTableSource] = useState<TableSource>("questions_bank");
  const [batchSize, setBatchSize] = useState(100);
  const [dryRun, setDryRun] = useState(true);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);

  const progress = useClassificationProgress();
  const reviewQueue = useReviewQueue();

  const runBatch = useMutation({
    mutationFn: async () => {
      const payload = { table_source: tableSource, batch_size: batchSize, dry_run: dryRun };
      // [obs] log explícito antes de chamar a edge function
      console.info("[classification-backfill] invoke", payload);
      const t0 = performance.now();
      const { data, error } = await supabase.functions.invoke("classify-question-hierarchy", {
        body: payload,
      });
      const elapsed = Math.round(performance.now() - t0);
      if (error) {
        console.error("[classification-backfill] error", { elapsed, error });
        throw new Error(error.message);
      }
      if ((data as any)?.error) {
        console.error("[classification-backfill] server-error", { elapsed, data });
        throw new Error((data as any).error);
      }
      console.info("[classification-backfill] result", { elapsed_ms: elapsed, ...data });
      return data as RunResult;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(
        `${dryRun ? "DRY-RUN" : "Lote real"} OK: ${data.total_applied} aplicáveis, ${data.total_queued_review} fila, ${data.total_skipped} sem match.`,
      );
      qc.invalidateQueries({ queryKey: ["classification-progress"] });
      qc.invalidateQueries({ queryKey: ["classification-queue"] });
    },
    onError: (e: Error) => toast.error(`Falhou: ${e.message}`),
  });

  const approveItem = useMutation({
    mutationFn: async (item: any) => {
      // aplica a sugestão e marca como aprovada
      const upd = await supabase
        .from(item.table_source)
        .update({
          specialty_id: item.suggested_specialty_id,
          topic_id: item.suggested_topic_id,
          subtopic_id: item.suggested_subtopic_id,
          microtopic_id: item.suggested_microtopic_id,
          classification_confidence: item.confidence_score,
          classification_method: "manual",
          classification_reviewed_by_human: true,
          classified_at: new Date().toISOString(),
        })
        .eq("id", item.question_id);
      if (upd.error) throw upd.error;
      const q = await supabase
        .from("question_classification_queue")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", item.id);
      if (q.error) throw q.error;
    },
    onSuccess: () => {
      toast.success("Sugestão aprovada e aplicada.");
      qc.invalidateQueries({ queryKey: ["classification-queue"] });
      qc.invalidateQueries({ queryKey: ["classification-progress"] });
    },
    onError: (e: Error) => toast.error(`Falhou: ${e.message}`),
  });

  const rejectItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("question_classification_queue")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejeitada.");
      qc.invalidateQueries({ queryKey: ["classification-queue"] });
    },
  });

  const qbPct = progress.data
    ? Math.round((progress.data.qbDone / Math.max(progress.data.qbTotal, 1)) * 100)
    : 0;
  const reqPct = progress.data
    ? Math.round((progress.data.reqDone / Math.max(progress.data.reqTotal, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Backfill de Classificação</h1>
          <p className="text-sm text-muted-foreground">
            Sprint 2 — Popula <code>specialty_id / topic_id / subtopic_id</code> com pipeline determinístico → heurístico → IA. Em lotes pequenos, com dry-run e fila de revisão.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">questions_bank</CardTitle>
            <CardDescription>{progress.data?.qbDone ?? 0} / {progress.data?.qbTotal ?? 0}</CardDescription>
          </CardHeader>
          <CardContent><Progress value={qbPct} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">real_exam_questions</CardTitle>
            <CardDescription>{progress.data?.reqDone ?? 0} / {progress.data?.reqTotal ?? 0}</CardDescription>
          </CardHeader>
          <CardContent><Progress value={reqPct} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fila de revisão</CardTitle>
            <CardDescription>{progress.data?.queuePending ?? 0} pendentes</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={progress.data?.queuePending ? "destructive" : "secondary"}>
              {progress.data?.queuePending ? "Requer atenção" : "Sem itens"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {dryRun && (
        <div className="rounded-md border-2 border-destructive bg-destructive/10 p-3 text-sm">
          <strong>⚠️ DRY-RUN ATIVO</strong> — nenhuma linha em <code>questions_bank</code> /
          <code> real_exam_questions</code> será alterada. Apenas o run em
          <code> question_classification_runs</code> é gravado para auditoria.
          Desligue o switch abaixo somente após validar a amostra.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5" /> Executar lote</CardTitle>
          <CardDescription>
            Recomendado: comece com <strong>DRY-RUN</strong> em <code>questions_bank</code>, batch <code>100</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tabela alvo</Label>
              <Select value={tableSource} onValueChange={(v) => setTableSource(v as TableSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="questions_bank">questions_bank</SelectItem>
                  <SelectItem value="real_exam_questions">real_exam_questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanho do lote (10–500)</Label>
              <Input
                type="number"
                min={10}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value || "100", 10))}
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
                <Label className="text-sm">Dry-run (não grava)</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => runBatch.mutate()} disabled={runBatch.isPending}>
              {runBatch.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executando…</>
              ) : (
                <><PlayCircle className="mr-2 h-4 w-4" /> {dryRun ? "Executar DRY-RUN" : "Executar lote real"}</>
              )}
            </Button>
            {dryRun ? (
              <Badge variant="outline" className="border-destructive text-destructive">
                Modo simulação — zero gravação em questões
              </Badge>
            ) : (
              <Badge variant="destructive">⚠️ Gravação real ligada</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="result">
        <TabsList>
          <TabsTrigger value="result">Último resultado</TabsTrigger>
          <TabsTrigger value="queue">Fila de revisão ({progress.data?.queuePending ?? 0})</TabsTrigger>
          <TabsTrigger value="runs">Runs recentes</TabsTrigger>
        </TabsList>

        <TabsContent value="result">
          <Card>
            <CardContent className="pt-6">
              {!lastResult ? (
                <p className="text-sm text-muted-foreground">Execute um lote para ver o resultado aqui.</p>
              ) : (
                <div className="space-y-4">
                  {lastResult.dry_run && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
                      Resultado de <strong>DRY-RUN</strong> (run_id <code>{lastResult.run_id}</code>) — nenhum
                      <code> specialty_id</code> foi gravado nas questões. Os números abaixo são apenas a simulação do que <em>seria</em> aplicado.
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Total processado" value={lastResult.total_processed} icon={<ClipboardList className="h-4 w-4" />} />
                    <Stat label="Por exact_text" value={lastResult.method_breakdown?.exact_text ?? 0} icon={<CheckCircle2 className="h-4 w-4 text-primary" />} />
                    <Stat label="Por heurística" value={lastResult.method_breakdown?.heuristic ?? 0} />
                    <Stat label="Iria p/ fila" value={lastResult.total_queued_review} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
                    <Stat label="Sem match (skip)" value={lastResult.total_skipped} />
                    <Stat label="Aplicáveis (≥0.7)" value={lastResult.total_applied} icon={<CheckCircle2 className="h-4 w-4 text-primary" />} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Breakdown por método (raw):</strong>{" "}
                    {Object.entries(lastResult.method_breakdown).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="mr-1">{k}: {v}</Badge>
                    ))}
                  </div>
                  {lastResult.sample_ambiguous.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Amostra de casos ambíguos</h4>
                      <ScrollArea className="h-64 border rounded p-3">
                        <ul className="space-y-2 text-xs">
                          {lastResult.sample_ambiguous.map((s) => (
                            <li key={s.question_id} className="border-b pb-2">
                              <div><strong>topic:</strong> {s.topic ?? "—"} / <strong>subtopic:</strong> {s.subtopic ?? "—"}</div>
                              <div className="text-muted-foreground">
                                {s.suggestion ? `${s.suggestion.reason} · conf=${s.suggestion.confidence.toFixed(2)}` : s.reason}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <CardContent className="pt-6">
              {reviewQueue.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (reviewQueue.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item pendente.</p>
              ) : (
                <ul className="space-y-3">
                  {reviewQueue.data!.map((item: any) => (
                    <li key={item.id} className="border rounded p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div>
                            <Badge variant="outline">{item.table_source}</Badge>{" "}
                            <Badge variant="secondary">{item.classification_method}</Badge>{" "}
                            <Badge>conf: {Number(item.confidence_score).toFixed(2)}</Badge>
                          </div>

                          {/* Enunciado da questão (essencial para revisar) */}
                          {item._question?.statement ? (
                            <div className="rounded border bg-muted/30 p-2 text-xs space-y-2">
                              <div className="whitespace-pre-wrap leading-relaxed">
                                {item._question.statement}
                              </div>
                              {Array.isArray(item._question.options) && item._question.options.length > 0 && (
                                <ol className="list-[upper-alpha] pl-5 space-y-0.5">
                                  {item._question.options.map((opt: any, idx: number) => (
                                    <li
                                      key={idx}
                                      className={idx === item._question.correct_index ? "font-semibold text-primary" : ""}
                                    >
                                      {typeof opt === "string" ? opt : opt?.text ?? JSON.stringify(opt)}
                                      {idx === item._question.correct_index && " ✓"}
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">
                              Enunciado não encontrado (question_id: {item.question_id})
                            </div>
                          )}

                          <div><strong>Original:</strong> {item.original_topic ?? "—"} / {item.original_subtopic ?? "—"}</div>
                          <div>
                            <strong>Sugestão:</strong>{" "}
                            {item.suggested_specialty?.nome ?? "—"}
                            {item.suggested_topic?.nome ? ` › ${item.suggested_topic.nome}` : ""}
                          </div>
                          <div className="text-muted-foreground text-xs">{item.reason}</div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" onClick={() => approveItem.mutate(item)} disabled={approveItem.isPending}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectItem.mutate(item.id)} disabled={rejectItem.isPending}>
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardContent className="pt-6">
              {(progress.data?.recentRuns?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum run executado.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {progress.data!.recentRuns.map((r: any) => (
                    <li key={r.id} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <span>
                          <Badge variant="outline">{r.table_source}</Badge>{" "}
                          {r.dry_run && <Badge variant="secondary">dry-run</Badge>}{" "}
                          <Badge>{r.status}</Badge>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.started_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-xs mt-1">
                        Processadas {r.total_processed} · Aplicadas {r.total_applied} · Revisão {r.total_queued_review} · Skip {r.total_skipped}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="border rounded p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
