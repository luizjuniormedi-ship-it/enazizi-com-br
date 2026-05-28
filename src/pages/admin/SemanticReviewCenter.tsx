/**
 * /admin/semantic-review-center — Painel Oficial de Aprovação Humana da Ontologia
 *
 * Freeze v25 — Enterprise Governance Mode
 *
 * Regras absolutas:
 *  - Único caminho de escrita: RPC `ontology_review_action` (server-side validada).
 *  - Allow-list de 4 ações: approve_semantic_link · reject_semantic_review ·
 *    mark_semantic_noise · escalate_to_rfc.
 *  - Se a RPC não estiver disponível → painel entra em modo READ-ONLY explícito
 *    com botões desabilitados (nada de toast pós-clique fingindo workflow).
 *  - Toda ação exige justificativa (≥10 chars). `escalate_to_rfc` exige RFC ID.
 *  - `approve_semantic_link` exige dupla confirmação adicional.
 *  - Jamais toca: questions_bank.specialty_id, FSRS, Planner, Tutor, TRI, simulados.
 */
import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, GitPullRequest, AlertTriangle, Layers, Undo2,
  ClipboardList, RefreshCw, Loader2, Lock, FileWarning, Network, History, Copy, ShieldAlert,
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
  resolution_backlog: Array<{ resolution_type: string; question_count: number; rfc_pending: number; human_review_pending: number; unreviewed: number }>;
  pending_rfc_domains: Array<{ topic_normalized: string; topic_original: string; question_count: number; suggested_resolution_type?: string }>;
  semantic_noise: Array<{ topic_normalized: string; question_count: number }>;
  transversal_topics: Array<{ topic_normalized: string; question_count: number }>;
  cross_domain_candidates: Array<{ topic_normalized: string; question_count: number }>;
};

/** Allow-list canônica da RPC governada. */
type ActionKind =
  | "approve_semantic_link"
  | "reject_semantic_review"
  | "mark_semantic_noise"
  | "escalate_to_rfc";

const ACTION_LABELS: Record<ActionKind, string> = {
  approve_semantic_link: "Aprovar link semântico",
  reject_semantic_review: "Rejeitar revisão",
  mark_semantic_noise: "Marcar como noise",
  escalate_to_rfc: "Escalar para RFC",
};

const RISK_BY_ACTION: Record<ActionKind, "low" | "medium" | "high"> = {
  approve_semantic_link: "high",      // cria link → dupla confirmação
  reject_semantic_review: "low",
  mark_semantic_noise: "low",
  escalate_to_rfc: "medium",          // exige RFC ID
};

type PendingAction = {
  kind: ActionKind;
  target: string;
  /** Rótulo amigável mostrado no diálogo. */
  contextLabel?: string;
};

type RpcStatus = "probing" | "available" | "unavailable";

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────
export default function SemanticReviewCenter() {
  const { toast } = useToast();
  const [rpcStatus, setRpcStatus] = useState<RpcStatus>("probing");

  // Probe da RPC: chamamos com payload deliberadamente inválido.
  // - Se função existir → erro de validação (justification required / invalid action).
  // - Se função não existir → PGRST202 / "could not find function".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { error } = await supabase.rpc("ontology_review_action" as any, {
        p_kind: "__probe__",
        p_target: "__probe__",
        p_meta: {},
      });
      if (cancelled) return;
      if (!error) {
        // jamais deveria suceder com payload de probe; trate como disponível
        setRpcStatus("available");
        return;
      }
      const msg = (error.message || "").toLowerCase();
      const code = (error as any).code || "";
      const notFound =
        code === "PGRST202" ||
        msg.includes("could not find the function") ||
        msg.includes("does not exist") ||
        msg.includes("not found");
      setRpcStatus(notFound ? "unavailable" : "available");
    })();
    return () => { cancelled = true; };
  }, []);

  const { data, isLoading, refetch, isFetching, error } = useQuery<Snapshot | null>({
    queryKey: ["semantic-review-center"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ontology_observatory_snapshot" as any);
      if (error) throw error;
      return data as Snapshot;
    },
    refetchInterval: 60_000,
  });

  // ── Confirmation dialog state ────────────────────────────────
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [justification, setJustification] = useState("");
  const [rfcId, setRfcId] = useState("");
  const [doubleConfirm, setDoubleConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openDialog(a: PendingAction) {
    setPending(a);
    setJustification("");
    setRfcId("");
    setDoubleConfirm("");
  }
  function closeDialog() {
    setPending(null);
    setJustification("");
    setRfcId("");
    setDoubleConfirm("");
  }

  async function executeAction() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("ontology_review_action" as any, {
        p_kind: pending.kind,
        p_target: pending.target,
        p_meta: {
          justification: justification.trim(),
          ...(rfcId.trim() ? { rfc_id: rfcId.trim() } : {}),
        },
      });
      if (error) throw error;
      toast({
        title: "Ação registrada",
        description: `${ACTION_LABELS[pending.kind]} · audit_id ${(data as any)?.audit_id?.slice?.(0, 8) ?? "—"}`,
      });
      closeDialog();
      refetch();
    } catch (e: any) {
      toast({
        title: "Falha ao registrar ação",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

  const snap = data;
  const readOnly = rpcStatus !== "available";

  // ── Justification validations ───────────────────────────────
  const needsRfc = pending?.kind === "escalate_to_rfc";
  const needsDouble = pending?.kind === "approve_semantic_link";
  const justOk = justification.trim().length >= 10;
  const rfcOk = !needsRfc || rfcId.trim().length > 0;
  const doubleOk = !needsDouble || doubleConfirm === "APROVAR LINK";
  const canSubmit = !!pending && justOk && rfcOk && doubleOk && !submitting;

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
            Consumer: <code>admin-semantic-review-center</code> · Append-only · Auditado server-side
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* RPC status banner */}
      {rpcStatus === "probing" && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Verificando governança server-side…</AlertTitle>
          <AlertDescription className="text-xs">
            Probing <code>ontology_review_action</code>.
          </AlertDescription>
        </Alert>
      )}
      {rpcStatus === "unavailable" && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">
            Modo READ-ONLY — RPC governada indisponível
          </AlertTitle>
          <AlertDescription className="text-xs">
            A função <code>public.ontology_review_action</code> não está deployada.
            Nenhuma aprovação humana pode ser executada até que ela exista.
            Todos os botões de ação estão <strong>desabilitados</strong>.
          </AlertDescription>
        </Alert>
      )}
      {rpcStatus === "available" && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            Modo Governança Ativa — Freeze v25
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground space-y-1">
            <div>
              ontology_runtime_enabled = <code>{String(snap?.ontology_runtime_enabled ?? false)}</code> ·
              kill_switch = <code>{String(snap?.kill_switch_enabled ?? false)}</code>
            </div>
            <div>
              Toda escrita passa por <code>ontology_review_action</code> (SECURITY DEFINER) com
              validação de papel, justificativa ≥10 chars, RFC obrigatório em escalações
              e auditoria append-only. <strong>Zero impacto</strong> em
              <code> questions_bank.specialty_id</code>, FSRS, Planner, Tutor, TRI ou simulados.
            </div>
          </AlertDescription>
        </Alert>
      )}

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

        {/* RFC Queue */}
        <TabsContent value="rfc">
          <Section title="Pending Curriculum RFC Queue" source="ontology.v_pending_curriculum_rfc"
            description="Domínios candidatos a RFC formal. Apenas escalação (NUNCA altera specialty_id).">
            {snap?.pending_rfc_domains?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Sugestão</TableHead>
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
                        <ActionBtn kind="escalate_to_rfc"        target={r.topic_normalized} disabled={readOnly} onPick={openDialog} />
                        <ActionBtn kind="mark_semantic_noise"    target={r.topic_normalized} disabled={readOnly} onPick={openDialog} />
                        <ActionBtn kind="reject_semantic_review" target={r.topic_normalized} disabled={readOnly} onPick={openDialog} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Sem RFCs pendentes." />}
          </Section>
        </TabsContent>

        {/* Review Queue */}
        <TabsContent value="review">
          <Section title="Semantic Review Queue" source="ontology.pending_semantic_review"
            description="Aprovação humana → INSERT append-only em ontology.question_semantic_links via RPC.">
            <ReviewQueueTable readOnly={readOnly} onPick={openDialog} />
          </Section>
        </TabsContent>

        {/* Drift */}
        <TabsContent value="drift">
          <Section title="Drift Analysis" source="ontology.v_semantic_drift"
            description="Observacional. NUNCA corrige automaticamente.">
            {snap?.semantic_drift?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drift</TableHead>
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
            ) : <Empty label="Nenhum drift detectado." />}
          </Section>
        </TabsContent>

        {/* Cross-Domain */}
        <TabsContent value="cross">
          <Section title="Cross-Domain Candidates" source="ontology.v_cross_domain_candidates"
            description="Apenas escalação para RFC ou rejeição.">
            {snap?.cross_domain_candidates?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Freq</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snap.cross_domain_candidates.map((c) => (
                    <TableRow key={c.topic_normalized}>
                      <TableCell><code className="text-xs">{c.topic_normalized}</code></TableCell>
                      <TableCell><Badge variant="secondary">{c.question_count}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <ActionBtn kind="escalate_to_rfc"        target={c.topic_normalized} disabled={readOnly} onPick={openDialog} />
                        <ActionBtn kind="reject_semantic_review" target={c.topic_normalized} disabled={readOnly} onPick={openDialog} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Sem candidatos cross-domain." />}
          </Section>
        </TabsContent>

        {/* Noise */}
        <TabsContent value="noise">
          <Section title="Semantic Noise Center" source="ontology.v_semantic_noise"
            description="Tópicos sem sinal pedagógico claro. Manter, promover (RFC) ou rejeitar.">
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
                        <ActionBtn kind="mark_semantic_noise"    target={n.topic_normalized} disabled={readOnly} onPick={openDialog} />
                        <ActionBtn kind="escalate_to_rfc"        target={n.topic_normalized} disabled={readOnly} onPick={openDialog} />
                        <ActionBtn kind="reject_semantic_review" target={n.topic_normalized} disabled={readOnly} onPick={openDialog} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty label="Sem noise registrado." />}
          </Section>
        </TabsContent>

        {/* Rollback */}
        <TabsContent value="rollback">
          <Section title="Rollback Center" source="ontology.ontology_versions + migrations"
            description="Comandos sugeridos apenas. NUNCA executa rollback automaticamente.">
            <RollbackHints />
          </Section>
        </TabsContent>

        {/* Governance Timeline */}
        <TabsContent value="timeline">
          <Section title="Governance Timeline" source="ontology.semantic_change_audit"
            description="Quem aprovou, o quê, quando, com qual justificativa e em qual versão.">
            <GovernanceTimeline />
          </Section>
        </TabsContent>
      </Tabs>

      {/* ── Confirmation Dialog ───────────────────────────────── */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {pending && ACTION_LABELS[pending.kind]}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm">
                <div><strong>Alvo:</strong> <code className="text-xs">{pending?.target}</code></div>
                <div>
                  <strong>Risco:</strong>{" "}
                  {pending && (
                    <Badge variant={
                      RISK_BY_ACTION[pending.kind] === "high" ? "destructive" :
                      RISK_BY_ACTION[pending.kind] === "medium" ? "default" : "secondary"
                    }>
                      {RISK_BY_ACTION[pending.kind]}
                    </Badge>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Esta ação será registrada via <code>ontology_review_action</code>,
              append-only em <code>ontology.semantic_change_audit</code>.
              {needsDouble && " Como cria link semântico, exige confirmação dupla."}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="just">Justificativa (mín. 10 caracteres) *</Label>
              <Textarea
                id="just"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Ex.: Tema recorrente em emergência, validado por dois revisores; impacto observacional apenas."
                rows={3}
              />
              <div className="text-[11px] text-muted-foreground">
                {justification.trim().length}/10 chars
              </div>
            </div>

            {needsRfc && (
              <div className="space-y-1">
                <Label htmlFor="rfc">RFC ID *</Label>
                <Input
                  id="rfc"
                  value={rfcId}
                  onChange={(e) => setRfcId(e.target.value)}
                  placeholder="RFC-2026-XX-NOME"
                />
              </div>
            )}

            {needsDouble && (
              <div className="space-y-1">
                <Label htmlFor="dbl">Digite <strong>APROVAR LINK</strong> para confirmar criação do vínculo semântico *</Label>
                <Input
                  id="dbl"
                  value={doubleConfirm}
                  onChange={(e) => setDoubleConfirm(e.target.value)}
                  placeholder="APROVAR LINK"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancelar</Button>
            <Button variant="default" disabled={!canSubmit} onClick={executeAction}>
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
  kind, target, disabled, onPick,
}: { kind: ActionKind; target: string; disabled: boolean; onPick: (p: PendingAction) => void }) {
  const risk = RISK_BY_ACTION[kind];
  return (
    <Button
      size="sm"
      variant={risk === "high" ? "destructive" : risk === "medium" ? "default" : "outline"}
      onClick={() => onPick({ kind, target })}
      disabled={disabled}
      className="text-xs h-7"
      title={disabled ? "Modo read-only: RPC governada indisponível" : ACTION_LABELS[kind]}
    >
      {ACTION_LABELS[kind]}
    </Button>
  );
}

function ReviewQueueTable({ readOnly, onPick }: { readOnly: boolean; onPick: (p: PendingAction) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["pending-semantic-review-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_semantic_review")
        .select("id, question_id, topic, subtopic, proposed_node, confidence, source, ontology_version, reviewer, created_at, review_status")
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
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r: any) => {
          const finalized = r.review_status && !["pending", "in_review"].includes(r.review_status);
          return (
            <TableRow key={r.id}>
              <TableCell><code className="text-xs">{String(r.question_id).slice(0, 8)}</code></TableCell>
              <TableCell className="text-xs">{r.topic}{r.subtopic ? ` › ${r.subtopic}` : ""}</TableCell>
              <TableCell><Badge variant="outline">{r.proposed_node ?? "—"}</Badge></TableCell>
              <TableCell>{r.confidence != null ? Number(r.confidence).toFixed(2) : "—"}</TableCell>
              <TableCell>
                <Badge variant={finalized ? "secondary" : "default"}>{r.review_status ?? "pending"}</Badge>
              </TableCell>
              <TableCell className="text-right space-x-1">
                <ActionBtn kind="approve_semantic_link"  target={r.id} disabled={readOnly || finalized} onPick={onPick} />
                <ActionBtn kind="escalate_to_rfc"        target={r.id} disabled={readOnly || finalized} onPick={onPick} />
                <ActionBtn kind="mark_semantic_noise"    target={r.id} disabled={readOnly || finalized} onPick={onPick} />
                <ActionBtn kind="reject_semantic_review" target={r.id} disabled={readOnly || finalized} onPick={onPick} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RollbackHints() {
  const { toast } = useToast();
  const items = [
    { label: "Rollback semantic_resolution_status (Wave 1)", sql: "DELETE FROM ontology.semantic_resolution_status WHERE rollout_stage = 'shadow' AND created_at > now() - interval '7 days';" },
    { label: "Reset feature flag ontology_runtime_enabled",  sql: "UPDATE public.system_settings SET value = jsonb_set(value,'{enabled}','false'::jsonb) WHERE key = 'ontology_runtime_enabled';" },
    { label: "Revogar última versão da ontologia",           sql: "UPDATE ontology.ontology_versions SET status = 'deprecated' WHERE id = (SELECT id FROM ontology.ontology_versions ORDER BY created_at DESC LIMIT 1);" },
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
          <Button size="sm" variant="outline"
            onClick={() => { navigator.clipboard.writeText(it.sql); toast({ title: "SQL copiado" }); }}>
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
        .select("id, actor, action, target, rfc_id, justification, ontology_version, rollout_stage, rollback_available, created_at")
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
          <TableHead>RFC</TableHead>
          <TableHead>Justificativa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
            <TableCell className="text-xs"><code>{String(r.actor).slice(0, 8)}</code></TableCell>
            <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
            <TableCell className="text-xs"><code>{String(r.target).slice(0, 14)}</code></TableCell>
            <TableCell className="text-xs">{r.rfc_id ?? "—"}</TableCell>
            <TableCell className="text-xs max-w-[300px] truncate" title={r.justification}>
              {r.justification}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
