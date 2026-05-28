/**
 * /admin/semantic-review-center — Painel Oficial de Aprovação Humana da Ontologia
 *
 * Freeze v25 — Enterprise Governance Mode
 *
 * REGRAS ABSOLUTAS (não negociáveis):
 *  - Read-only por padrão (observabilidade + aprovação humana).
 *  - JAMAIS toca: questions_bank.specialty_id, FSRS, Planner, Tutor, TRI, simulados.
 *  - JAMAIS faz: auto-classificação, fuzzy, IA, heurística destrutiva, dual-write.
 *  - Toda escrita futura: via RPC service_role, append-only, em schema `ontology`.
 *  - Frontend NUNCA escreve direto em tabelas críticas.
 *
 * Fonte de dados única: RPC `ontology_observatory_snapshot` (já existente, read-only).
 * Ações são confirmadas via modal e enviadas a RPCs governadas
 * (`ontology_review_action` quando disponível). Sem RPC → toast informativo.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, GitPullRequest, AlertTriangle, Layers, Trash2, Undo2,
  ClipboardList, RefreshCw, Loader2, Lock, FileWarning, Network, History, Copy,
} from "lucide-react";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────
type Snapshot = {
  observed_at: string;
  kill_switch_enabled: boolean;
  ontology_runtime_enabled?: boolean;
  ontology_health: any | null;
  semantic_drift: any[] | null;
  resolution_backlog: Array<{
    resolution_type: string;
    question_count: number;
    rfc_pending: number;
    human_review_pending: number;
    unreviewed: number;
  }>;
  pending_rfc_domains: Array<{
    topic_normalized: string;
    topic_original: string;
    question_count: number;
    first_seen?: string;
    last_seen?: string;
    suggested_resolution_type?: string;
  }>;
  semantic_noise: Array<{ topic_normalized: string; question_count: number }>;
  transversal_topics: Array<{ topic_normalized: string; question_count: number }>;
  cross_domain_candidates: Array<{ topic_normalized: string; question_count: number }>;
};

type ActionKind =
  | "approve_rfc" | "reject_rfc" | "mark_transversal" | "keep_null" | "send_to_noise"
  | "approve_link" | "reject_link" | "mark_noise" | "escalate_rfc" | "multi_axis"
  | "approve_cross_domain" | "reject_cross_domain"
  | "keep_noise" | "promote_noise" | "manual_map";

type PendingAction = {
  kind: ActionKind;
  target: string;       // topic_normalized or question_id
  context?: string;     // descriptive label shown in modal
  meta?: Record<string, any>;
};

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
const ACTION_LABELS: Record<ActionKind, string> = {
  approve_rfc: "Aprovar RFC curricular",
  reject_rfc: "Rejeitar RFC",
  mark_transversal: "Marcar como tema transversal",
  keep_null: "Manter NULL (backlog curricular)",
  send_to_noise: "Enviar para semantic noise",
  approve_link: "Aprovar semantic link",
  reject_link: "Rejeitar semantic link",
  mark_noise: "Marcar como noise",
  escalate_rfc: "Escalar para RFC curricular",
  multi_axis: "Associar multi-eixo (read-only)",
  approve_cross_domain: "Aprovar cross-domain",
  reject_cross_domain: "Rejeitar cross-domain",
  keep_noise: "Manter como noise",
  promote_noise: "Promover noise a RFC",
  manual_map: "Mapear manualmente (abrir RFC)",
};

const RISK_BY_ACTION: Record<ActionKind, "low" | "medium" | "high"> = {
  approve_rfc: "high",
  reject_rfc: "medium",
  mark_transversal: "medium",
  keep_null: "low",
  send_to_noise: "low",
  approve_link: "high",
  reject_link: "low",
  mark_noise: "low",
  escalate_rfc: "medium",
  multi_axis: "high",
  approve_cross_domain: "high",
  reject_cross_domain: "low",
  keep_noise: "low",
  promote_noise: "medium",
  manual_map: "medium",
};

function riskColor(risk: "low" | "medium" | "high"): string {
  if (risk === "high") return "destructive";
  if (risk === "medium") return "default";
  return "secondary";
}

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────
export default function SemanticReviewCenter() {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, refetch, isFetching, error } = useQuery<Snapshot | null>({
    queryKey: ["semantic-review-center"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ontology_observatory_snapshot" as any);
      if (error) throw error;
      return data as Snapshot;
    },
    refetchInterval: 60_000,
  });

  const snap = data;
  const runtimeOff = !snap?.ontology_runtime_enabled;

  async function executeAction(a: PendingAction) {
    setSubmitting(true);
    try {
      // RPC governada de aprovação humana. Se não existir ainda,
      // mantemos a ação como observação registrada no toast (sem dual-write).
      const { error } = await supabase.rpc("ontology_review_action" as any, {
        p_kind: a.kind,
        p_target: a.target,
        p_meta: a.meta ?? {},
      });
      if (error) throw error;
      toast({
        title: "Ação registrada",
        description: `${ACTION_LABELS[a.kind]} — ${a.target}`,
      });
      refetch();
    } catch (e: any) {
      // RPC ainda não disponível → comunicar honestamente (freeze v25)
      const msg = (e?.message || "").toLowerCase();
      const noRpc = msg.includes("does not exist") || msg.includes("not found") || msg.includes("could not find");
      toast({
        title: noRpc ? "Aguardando RPC governada" : "Falha ao registrar ação",
        description: noRpc
          ? `Ação "${ACTION_LABELS[a.kind]}" requer RPC ontology_review_action. Nenhuma alteração foi feita.`
          : e?.message ?? "Erro desconhecido",
        variant: noRpc ? "default" : "destructive",
      });
    } finally {
      setSubmitting(false);
      setPending(null);
      setConfirmText("");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive m-6">
        <CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar painel: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Semantic Review Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mesa operacional de governança curricular — Freeze v25 ·
            Consumer: <code>admin-semantic-review-center</code> · Read-only por padrão · Append-only · Reversível
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Governance banner */}
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <Lock className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-700 dark:text-amber-400">
          Modo Observacional — Freeze v25 ativo
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground space-y-1">
          <div>
            ontology_runtime_enabled = <code>{String(snap?.ontology_runtime_enabled ?? false)}</code> ·
            kill_switch = <code>{String(snap?.kill_switch_enabled ?? false)}</code>
          </div>
          <div>
            Este painel <strong>NÃO</strong> altera <code>questions_bank.specialty_id</code>,
            FSRS, Planner, Tutor, TRI ou simulados. Toda aprovação é append-only em
            <code> ontology.question_semantic_links</code> via RPC governada.
          </div>
        </AlertDescription>
      </Alert>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Backlog total" value={snap?.resolution_backlog?.reduce((a, r) => a + Number(r.question_count || 0), 0) ?? 0} icon={<ClipboardList className="h-4 w-4" />} />
        <KPI label="RFCs pendentes" value={snap?.pending_rfc_domains?.length ?? 0} icon={<GitPullRequest className="h-4 w-4" />} />
        <KPI label="Drift sinais" value={snap?.semantic_drift?.length ?? 0} icon={<AlertTriangle className="h-4 w-4" />} />
        <KPI label="Noise topics" value={snap?.semantic_noise?.length ?? 0} icon={<FileWarning className="h-4 w-4" />} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rfc" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="rfc"><GitPullRequest className="h-4 w-4 mr-1" /> RFC Queue</TabsTrigger>
          <TabsTrigger value="review"><ClipboardList className="h-4 w-4 mr-1" /> Review Queue</TabsTrigger>
          <TabsTrigger value="drift"><AlertTriangle className="h-4 w-4 mr-1" /> Drift</TabsTrigger>
          <TabsTrigger value="cross"><Network className="h-4 w-4 mr-1" /> Cross-Domain</TabsTrigger>
          <TabsTrigger value="noise"><FileWarning className="h-4 w-4 mr-1" /> Noise</TabsTrigger>
          <TabsTrigger value="rollback"><Undo2 className="h-4 w-4 mr-1" /> Rollback</TabsTrigger>
          <TabsTrigger value="timeline"><History className="h-4 w-4 mr-1" /> Governance Timeline</TabsTrigger>
        </TabsList>

        {/* 1. RFC Queue */}
        <TabsContent value="rfc">
          <Section
            title="Pending Curriculum RFC Queue"
            source="ontology.v_pending_curriculum_rfc"
            description="Domínios candidatos a RFC formal. NUNCA altera specialty_id."
          >
            {snap?.pending_rfc_domains?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Resolução sugerida</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snap.pending_rfc_domains.map((r) => (
                    <TableRow key={r.topic_normalized}>
                      <TableCell>
                        <div className="font-medium">{r.topic_original}</div>
                        <code className="text-xs text-muted-foreground">{r.topic_normalized}</code>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{r.question_count}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{r.suggested_resolution_type ?? "rfc_curriculum"}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <ActionBtn kind="approve_rfc"     target={r.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="mark_transversal" target={r.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="send_to_noise"    target={r.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="reject_rfc"       target={r.topic_normalized} onPick={setPending} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Sem RFCs pendentes." />}
          </Section>
        </TabsContent>

        {/* 2. Semantic Review Queue */}
        <TabsContent value="review">
          <Section
            title="Semantic Review Queue"
            source="ontology.pending_semantic_review"
            description="Propostas humanas. Aprovação → INSERT append-only em ontology.question_semantic_links."
          >
            <ReviewQueueTable onPick={setPending} />
          </Section>
        </TabsContent>

        {/* 3. Drift */}
        <TabsContent value="drift">
          <Section
            title="Drift Analysis"
            source="ontology.v_semantic_drift"
            description="Observacional. NUNCA corrige automaticamente."
          >
            {snap?.semantic_drift?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drift type</TableHead>
                    <TableHead>Detalhe</TableHead>
                    <TableHead>Afetados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snap.semantic_drift.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="destructive">{d.drift_type ?? "drift"}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <code>{d.deprecated_node ?? d.ontology_specialty ?? d.version_conflict ?? "—"}</code>
                        {d.legacy_specialty && <> ↔ <code>{d.legacy_specialty}</code></>}
                      </TableCell>
                      <TableCell>{d.affected_questions ?? d.mismatch_count ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Nenhum drift detectado no snapshot." />}
          </Section>
        </TabsContent>

        {/* 4. Cross-Domain */}
        <TabsContent value="cross">
          <Section
            title="Cross-Domain Candidates"
            source="ontology.v_cross_domain_candidates"
            description="Candidatos a múltiplos eixos. Aprovação humana apenas."
          >
            {snap?.cross_domain_candidates?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snap.cross_domain_candidates.map((c) => (
                    <TableRow key={c.topic_normalized}>
                      <TableCell><code className="text-xs">{c.topic_normalized}</code></TableCell>
                      <TableCell><Badge variant="secondary">{c.question_count}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <ActionBtn kind="approve_cross_domain" target={c.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="escalate_rfc"          target={c.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="reject_cross_domain"   target={c.topic_normalized} onPick={setPending} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Sem candidatos cross-domain." />}
          </Section>
        </TabsContent>

        {/* 5. Noise */}
        <TabsContent value="noise">
          <Section
            title="Semantic Noise Center"
            source="ontology.v_semantic_noise"
            description="Tópicos sem sinal pedagógico claro (Geral, Diagnóstico, Tratamento, etc.)."
          >
            {snap?.semantic_noise?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snap.semantic_noise.map((n) => (
                    <TableRow key={n.topic_normalized}>
                      <TableCell><code className="text-xs">{n.topic_normalized}</code></TableCell>
                      <TableCell><Badge variant="outline">{n.question_count}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <ActionBtn kind="keep_noise"    target={n.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="promote_noise" target={n.topic_normalized} onPick={setPending} />
                        <ActionBtn kind="manual_map"    target={n.topic_normalized} onPick={setPending} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Sem noise registrado." />}
          </Section>
        </TabsContent>

        {/* 6. Rollback */}
        <TabsContent value="rollback">
          <Section
            title="Rollback Center"
            source="ontology.ontology_versions + migrations"
            description="Comandos sugeridos apenas. NUNCA executa rollback automaticamente."
          >
            <RollbackHints />
          </Section>
        </TabsContent>

        {/* 7. Governance Timeline */}
        <TabsContent value="timeline">
          <Section
            title="Governance Timeline"
            source="semantic_change_audit + consumer_certifications + ontology_access_log"
            description="Quem aprovou o quê, quando, em qual versão."
          >
            <GovernanceTimeline />
          </Section>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) { setPending(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Confirmação de governança
            </DialogTitle>
            <DialogDescription>
              {pending && (
                <>
                  <div className="mt-2"><strong>Ação:</strong> {ACTION_LABELS[pending.kind]}</div>
                  <div><strong>Alvo:</strong> <code>{pending.target}</code></div>
                  <div className="mt-1">
                    <strong>Risco:</strong>{" "}
                    <Badge variant={riskColor(RISK_BY_ACTION[pending.kind]) as any}>
                      {RISK_BY_ACTION[pending.kind]}
                    </Badge>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Esta ação será registrada via RPC governada <code>ontology_review_action</code>,
              append-only e reversível. <strong>Não</strong> altera runtime legado.
              Digite <strong>APROVAR</strong> para confirmar.
            </AlertDescription>
          </Alert>
          <input
            className="mt-2 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Digite APROVAR"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="default"
              disabled={confirmText !== "APROVAR" || submitting}
              onClick={() => pending && executeAction(pending)}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Subcomponents
// ───────────────────────────────────────────────────────────────
function KPI({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({
  title, source, description, children,
}: { title: string; source: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">
          {description} · Fonte: <code>{source}</code>
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{label}</div>;
}

function ActionBtn({
  kind, target, onPick,
}: { kind: ActionKind; target: string; onPick: (p: PendingAction) => void }) {
  const risk = RISK_BY_ACTION[kind];
  return (
    <Button
      size="sm"
      variant={risk === "high" ? "destructive" : risk === "medium" ? "default" : "outline"}
      onClick={() => onPick({ kind, target })}
      className="text-xs h-7"
    >
      {ACTION_LABELS[kind]}
    </Button>
  );
}

function ReviewQueueTable({ onPick }: { onPick: (p: PendingAction) => void }) {
  // Read-only fetch direto da view (RLS protege). Sem escrita.
  const { data, isLoading } = useQuery({
    queryKey: ["pending-semantic-review-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_semantic_review")
        .select("id, question_id, topic, subtopic, proposed_node, confidence, source, ontology_version, reviewer, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!data?.length) return <Empty label="Fila vazia. Nada para revisar." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Topic</TableHead>
          <TableHead>Proposed node</TableHead>
          <TableHead>Conf.</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell><code className="text-xs">{String(r.question_id).slice(0, 8)}</code></TableCell>
            <TableCell className="text-xs">{r.topic}{r.subtopic ? ` › ${r.subtopic}` : ""}</TableCell>
            <TableCell><Badge variant="outline">{r.proposed_node ?? "—"}</Badge></TableCell>
            <TableCell>{r.confidence != null ? Number(r.confidence).toFixed(2) : "—"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{r.source ?? "—"}</TableCell>
            <TableCell className="text-right space-x-1">
              <ActionBtn kind="approve_link"  target={r.id} onPick={onPick} />
              <ActionBtn kind="multi_axis"    target={r.id} onPick={onPick} />
              <ActionBtn kind="escalate_rfc"  target={r.id} onPick={onPick} />
              <ActionBtn kind="mark_noise"    target={r.id} onPick={onPick} />
              <ActionBtn kind="reject_link"   target={r.id} onPick={onPick} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RollbackHints() {
  const { toast } = useToast();
  const items = [
    { label: "Rollback semantic_resolution_status (Wave 1)", sql: "DELETE FROM ontology.semantic_resolution_status WHERE rollout_stage = 'shadow' AND created_at > now() - interval '7 days';" },
    { label: "Reset feature flag ontology_runtime_enabled", sql: "UPDATE public.feature_flags SET enabled = false WHERE key = 'ontology_runtime_enabled';" },
    { label: "Revogar última versão de ontologia", sql: "UPDATE ontology.ontology_versions SET status = 'deprecated' WHERE id = (SELECT id FROM ontology.ontology_versions ORDER BY created_at DESC LIMIT 1);" },
  ];
  return (
    <div className="space-y-2">
      <Alert>
        <Undo2 className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Comandos sugeridos — copie e execute manualmente após revisão. Nunca automatizado.
        </AlertDescription>
      </Alert>
      {items.map((it) => (
        <div key={it.label} className="flex items-start justify-between gap-2 rounded border border-border p-3">
          <div className="space-y-1 min-w-0">
            <div className="text-sm font-medium">{it.label}</div>
            <pre className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto">{it.sql}</pre>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => { navigator.clipboard.writeText(it.sql); toast({ title: "SQL copiado" }); }}
          >
            <Copy className="h-3 w-3 mr-1" /> Copiar
          </Button>
        </div>
      ))}
    </div>
  );
}

function GovernanceTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ["governance-timeline"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("semantic_change_audit")
        .select("id, actor, action, target, ontology_version, rollout_stage, rollback_available, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!data?.length) return <Empty label="Sem registros de auditoria ainda." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Ator</TableHead>
          <TableHead>Ação</TableHead>
          <TableHead>Alvo</TableHead>
          <TableHead>Versão</TableHead>
          <TableHead>Rollback</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
            <TableCell className="text-xs">{r.actor ?? "—"}</TableCell>
            <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
            <TableCell className="text-xs"><code>{r.target}</code></TableCell>
            <TableCell className="text-xs">{r.ontology_version ?? "—"}</TableCell>
            <TableCell>
              {r.rollback_available
                ? <Badge variant="secondary">disponível</Badge>
                : <Badge variant="destructive">indisponível</Badge>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
