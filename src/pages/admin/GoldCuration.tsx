// Sprint Gold-1 — Painel de Curadoria Gold
// Rota: /admin/gold-curation
// 3 abas: Funil | Classificadas | Órfãs / Skipped
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Crown, XCircle, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

type GoldStatus = "pendente" | "aprovado" | "ouro" | "rejeitado" | "precisa_revisao";

const STATUS_LABEL: Record<GoldStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  ouro: "Ouro",
  rejeitado: "Rejeitado",
  precisa_revisao: "Precisa revisão",
};

const STATUS_VARIANT: Record<GoldStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "secondary",
  aprovado: "default",
  ouro: "default",
  rejeitado: "destructive",
  precisa_revisao: "outline",
};

interface FunnelStats {
  total_bank: number;
  nao_processadas: number;
  classificadas: number;
  skipped: number;
  metadados: number;
  pendente: number;
  aprovado: number;
  ouro: number;
  rejeitado: number;
  precisa_revisao: number;
  with_score: number;
  null_em_gold: number;
}

interface GoldRow {
  meta_id: string;
  question_id: string;
  gold_status: GoldStatus;
  quality_score: number | null;
  quality_score_method: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  classification_method: string | null;
  classification_reason: string | null;
  statement: string | null;
  topic: string | null;
  source: string | null;
  source_type: string | null;
  specialty_id: string | null;
}

export default function GoldCuration() {
  const [tab, setTab] = useState<"funnel" | "classified" | "orphans">("funnel");
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [runningHeuristic, setRunningHeuristic] = useState(false);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      // Funil em questions_bank
      const { count: total_bank } = await supabase.from("questions_bank").select("id", { count: "exact", head: true });
      const { count: nao_processadas } = await supabase.from("questions_bank").select("id", { count: "exact", head: true }).is("classification_method", null);
      const { count: skipped } = await supabase.from("questions_bank").select("id", { count: "exact", head: true }).eq("classification_method", "skipped");
      const classificadas = (total_bank ?? 0) - (nao_processadas ?? 0) - (skipped ?? 0);

      // Metadados
      const { count: metadados } = await supabase.from("gold_questions_metadata").select("id", { count: "exact", head: true });
      const { count: with_score } = await supabase.from("gold_questions_metadata").select("id", { count: "exact", head: true }).not("quality_score", "is", null);

      const statusCounts: Record<GoldStatus, number> = {
        pendente: 0, aprovado: 0, ouro: 0, rejeitado: 0, precisa_revisao: 0,
      };
      for (const s of Object.keys(statusCounts) as GoldStatus[]) {
        const { count } = await supabase.from("gold_questions_metadata").select("id", { count: "exact", head: true }).eq("gold_status", s);
        statusCounts[s] = count ?? 0;
      }

      // Auditoria: nenhuma NULL pode estar em Gold (cliente: amostra)
      let null_em_gold = 0;
      const { data: sample } = await supabase
        .from("gold_questions_metadata")
        .select("question_id")
        .eq("question_source", "questions_bank")
        .limit(1000);
      if (sample && sample.length > 0) {
        const ids = sample.map((s: any) => s.question_id);
        const { count } = await supabase
          .from("questions_bank")
          .select("id", { count: "exact", head: true })
          .in("id", ids)
          .is("classification_method", null);
        null_em_gold = count ?? 0;
      }

      setStats({
        total_bank: total_bank ?? 0,
        nao_processadas: nao_processadas ?? 0,
        classificadas,
        skipped: skipped ?? 0,
        metadados: metadados ?? 0,
        with_score: with_score ?? 0,
        null_em_gold,
        ...statusCounts,
      });
    } catch (e: any) {
      toast.error("Erro ao carregar funil: " + e.message);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const runHeuristic = async () => {
    setRunningHeuristic(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-gold-heuristic-score", {
        body: { limit: 500, recompute: false },
      });
      if (error) throw error;
      toast.success(`Heurística: ${data?.processed ?? 0} processadas (${data?.failed ?? 0} falhas)`);
      await loadStats();
    } catch (e: any) {
      toast.error("Heurística falhou: " + e.message);
    } finally {
      setRunningHeuristic(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gold Curation</h1>
          <p className="text-muted-foreground">
            Curadoria de qualidade. Apenas questões já classificadas ou skipped — as não processadas continuam em{" "}
            <code className="text-xs">/admin/classification</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadStats} disabled={loadingStats}>
            {loadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Atualizar</span>
          </Button>
          <Button onClick={runHeuristic} disabled={runningHeuristic}>
            {runningHeuristic ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Rodar heurística (lote 500)
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="funnel">Dashboard do Funil</TabsTrigger>
          <TabsTrigger value="classified">Classificadas</TabsTrigger>
          <TabsTrigger value="orphans">Órfãs / Skipped</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4">
          <FunnelDashboard stats={stats} loading={loadingStats} />
        </TabsContent>

        <TabsContent value="classified">
          <QuestionsTable mode="classified" onChange={loadStats} />
        </TabsContent>

        <TabsContent value="orphans">
          <QuestionsTable mode="orphans" onChange={loadStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FunnelDashboard({ stats, loading }: { stats: FunnelStats | null; loading: boolean }) {
  if (loading || !stats) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando funil…</div>;
  }
  const cards = [
    { label: "Total questions_bank", value: stats.total_bank },
    { label: "Não processadas (NULL)", value: stats.nao_processadas, hint: "Vão para /admin/classification" },
    { label: "Classificadas", value: stats.classificadas },
    { label: "Skipped (órfãs)", value: stats.skipped },
    { label: "Metadados Gold criados", value: stats.metadados },
    { label: "Com quality_score", value: stats.with_score },
    { label: "Pendente", value: stats.pendente },
    { label: "Aprovado", value: stats.aprovado },
    { label: "Ouro", value: stats.ouro },
    { label: "Rejeitado", value: stats.rejeitado },
    { label: "Precisa revisão", value: stats.precisa_revisao },
  ];
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-2xl">{c.value.toLocaleString("pt-BR")}</CardTitle>
            </CardHeader>
            {c.hint && <CardContent className="text-xs text-muted-foreground">{c.hint}</CardContent>}
          </Card>
        ))}
      </div>
      {stats.null_em_gold > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Inconsistência detectada
            </CardTitle>
            <CardDescription>
              {stats.null_em_gold} registro(s) com classification_method NULL apareceram no Gold Curation. Não deveriam estar aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  );
}

function QuestionsTable({ mode, onChange }: { mode: "classified" | "orphans"; onChange: () => void }) {
  const [rows, setRows] = useState<GoldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | GoldStatus>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [selected, setSelected] = useState<GoldRow | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const load = async () => {
    setLoading(true);
    try {
      // 1) Pré-filtra question_ids elegíveis (classification_method / reason) em questions_bank
      const CLASSIFIED_METHODS = ["alias_exact", "exact_text", "heuristic", "ai", "manual"];
      let qb = supabase.from("questions_bank").select("id").limit(2000);
      if (mode === "classified") {
        qb = qb.in("classification_method", CLASSIFIED_METHODS);
      } else {
        qb = qb.eq("classification_method", "skipped");
        if (reasonFilter !== "all") qb = qb.eq("classification_reason", reasonFilter);
      }
      const { data: bankIds, error: bankErr } = await qb;
      if (bankErr) throw bankErr;
      const idSet = (bankIds ?? []).map((r: any) => r.id);
      if (idSet.length === 0) { setRows([]); return; }

      // 2) Busca metadados desses IDs
      let mq: any = supabase
        .from("gold_questions_metadata")
        .select("id, question_id, gold_status, quality_score, quality_score_method, review_notes, reviewed_at")
        .eq("question_source", "questions_bank")
        .in("question_id", idSet)
        .order("quality_score", { ascending: false, nullsFirst: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (statusFilter !== "all") mq = mq.eq("gold_status", statusFilter);
      const { data: metas, error: metaErr } = await mq;
      if (metaErr) throw metaErr;

      // 3) Busca dados das questões correspondentes
      const metaIds = (metas ?? []).map((m: any) => m.question_id);
      const { data: qs, error: qsErr } = await supabase
        .from("questions_bank")
        .select("id, statement, topic, source, source_type, specialty_id, classification_method, classification_reason")
        .in("id", metaIds.length ? metaIds : ["00000000-0000-0000-0000-000000000000"]);
      if (qsErr) throw qsErr;
      const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));

      const mapped: GoldRow[] = (metas ?? []).map((m: any) => {
        const q: any = qMap.get(m.question_id) ?? {};
        return {
          meta_id: m.id,
          question_id: m.question_id,
          gold_status: m.gold_status,
          quality_score: m.quality_score,
          quality_score_method: m.quality_score_method,
          review_notes: m.review_notes,
          reviewed_at: m.reviewed_at,
          classification_method: q.classification_method ?? null,
          classification_reason: q.classification_reason ?? null,
          statement: q.statement ?? null,
          topic: q.topic ?? null,
          source: q.source ?? null,
          source_type: q.source_type ?? null,
          specialty_id: q.specialty_id ?? null,
        };
      });
      setRows(mapped);
    } catch (e: any) {
      toast.error("Erro ao carregar questões: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mode, statusFilter, reasonFilter, page]);

  const updateStatus = async (meta_id: string, newStatus: GoldStatus, notes?: string) => {
    const userRes = await supabase.auth.getUser();
    const uid = userRes.data.user?.id;
    const payload: any = { gold_status: newStatus };
    if (notes !== undefined) payload.review_notes = notes;
    if (uid) payload.reviewed_by = uid;

    const { error } = await supabase
      .from("gold_questions_metadata")
      .update(payload)
      .eq("id", meta_id);
    if (error) { toast.error("Falha: " + error.message); return; }
    toast.success(`Status: ${STATUS_LABEL[newStatus]}`);
    setSelected(null);
    await load();
    onChange();
  };

  const reasons = ["all", "no_specialty_match", "no_topic", "low_confidence", "curriculum_gap"];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <CardTitle>{mode === "classified" ? "Questões classificadas" : "Órfãs / Skipped"}</CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => { setPage(0); setStatusFilter(v as any); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as GoldStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === "orphans" && (
              <Select value={reasonFilter} onValueChange={(v) => { setPage(0); setReasonFilter(v); }}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Motivo skip" /></SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => <SelectItem key={r} value={r}>{r === "all" ? "Todos motivos" : r}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">Nenhum registro com esses filtros.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Tópico</TableHead>
                <TableHead className="max-w-md">Enunciado</TableHead>
                {mode === "orphans" && <TableHead>Motivo</TableHead>}
                {mode === "classified" && <TableHead>Método</TableHead>}
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.meta_id}>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.gold_status]}>{STATUS_LABEL[r.gold_status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.quality_score !== null ? (
                      <span className={r.quality_score >= 80 ? "text-green-600 font-medium" : r.quality_score >= 50 ? "" : "text-muted-foreground"}>
                        {Math.round(r.quality_score)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{r.topic ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate text-xs" title={r.statement ?? ""}>
                    {(r.statement ?? "").slice(0, 120)}{(r.statement?.length ?? 0) > 120 ? "…" : ""}
                  </TableCell>
                  {mode === "orphans" && <TableCell><Badge variant="outline" className="text-xs">{r.classification_reason ?? "—"}</Badge></TableCell>}
                  {mode === "classified" && <TableCell><Badge variant="outline" className="text-xs">{r.classification_method}</Badge></TableCell>}
                  <TableCell className="text-xs">{r.source ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Curar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex justify-between items-center mt-4">
          <div className="text-xs text-muted-foreground">Página {page + 1} · {rows.length} resultados</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={rows.length < pageSize} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      </CardContent>

      <CurationDialog row={selected} onClose={() => setSelected(null)} onSave={updateStatus} mode={mode} />
    </Card>
  );
}

function CurationDialog({
  row, onClose, onSave, mode,
}: {
  row: GoldRow | null;
  onClose: () => void;
  onSave: (meta_id: string, status: GoldStatus, notes?: string) => Promise<void>;
  mode: "classified" | "orphans";
}) {
  const [notes, setNotes] = useState("");
  useEffect(() => { setNotes(row?.review_notes ?? ""); }, [row]);

  if (!row) return null;

  const actions: { label: string; status: GoldStatus; icon: any; variant: any }[] =
    mode === "classified"
      ? [
          { label: "Aprovar", status: "aprovado", icon: CheckCircle2, variant: "default" },
          { label: "Ouro", status: "ouro", icon: Crown, variant: "default" },
          { label: "Precisa revisão", status: "precisa_revisao", icon: AlertTriangle, variant: "outline" },
          { label: "Rejeitar", status: "rejeitado", icon: XCircle, variant: "destructive" },
        ]
      : [
          { label: "Marcar revisão (Alias V2)", status: "precisa_revisao", icon: AlertTriangle, variant: "outline" },
          { label: "Aprovar mesmo assim", status: "aprovado", icon: CheckCircle2, variant: "default" },
          { label: "Rejeitar", status: "rejeitado", icon: XCircle, variant: "destructive" },
        ];

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Curadoria de questão</DialogTitle>
          <DialogDescription className="space-y-1">
            <div><strong>Tópico:</strong> {row.topic ?? "—"}</div>
            <div><strong>Source:</strong> {row.source ?? "—"} ({row.source_type ?? "—"})</div>
            <div><strong>Método:</strong> {row.classification_method}{row.classification_reason ? ` · ${row.classification_reason}` : ""}</div>
            <div><strong>Score atual:</strong> {row.quality_score ?? "—"} ({row.quality_score_method ?? "—"})</div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Enunciado</label>
            <div className="text-sm bg-muted/50 p-3 rounded mt-1 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {row.statement ?? "(sem enunciado)"}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notas de curadoria</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Motivo da decisão, aliases sugeridos, etc." />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {actions.map((a) => (
            <Button key={a.status} variant={a.variant} onClick={() => onSave(row.meta_id, a.status, notes)}>
              <a.icon className="h-4 w-4 mr-2" /> {a.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
