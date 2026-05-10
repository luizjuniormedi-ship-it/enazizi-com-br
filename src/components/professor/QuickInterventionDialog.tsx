/**
 * QuickInterventionDialog v2
 * Diálogo universal de intervenção pedagógica do professor.
 * Suporta múltiplos tipos: recovery, fsrs_review, adaptive_simulado, reduce_load, mentoria, monitor.
 * - Gera request_id (UUID) por intervenção.
 * - Persiste via action `assign_intervention` (governance_logs + assistant_decisions).
 * - Nunca quebra UI: erros viram toast destrutivo, mas estado permanece consistente.
 * - Sem mocks. Sem inventar dados.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Target, Loader2, Brain, BookOpen, GaugeCircle, MessageCircle, Eye } from "lucide-react";

export type InterventionType =
  | "recovery"
  | "fsrs_review"
  | "adaptive_simulado"
  | "reduce_load"
  | "mentoria"
  | "monitor";

const TYPE_META: Record<
  InterventionType,
  { label: string; icon: React.ReactNode; severity: "low" | "medium" | "high" | "critical"; defaultJust: string }
> = {
  recovery:           { label: "Recovery dirigido",      icon: <Target className="h-4 w-4 text-primary" />,        severity: "high",     defaultJust: "Recovery em especialidade fraca." },
  fsrs_review:        { label: "Revisão FSRS",            icon: <Brain className="h-4 w-4 text-primary" />,         severity: "high",     defaultJust: "Lapses elevados / retenção baixa." },
  adaptive_simulado:  { label: "Simulado adaptativo",     icon: <BookOpen className="h-4 w-4 text-primary" />,      severity: "medium",   defaultJust: "Queda de desempenho recente." },
  reduce_load:        { label: "Reduzir carga",           icon: <GaugeCircle className="h-4 w-4 text-amber-400" />, severity: "critical", defaultJust: "Sobrecarga / sinais de burnout." },
  mentoria:           { label: "Abrir mentoria",          icon: <MessageCircle className="h-4 w-4 text-primary" />, severity: "high",     defaultJust: "Inatividade / acompanhamento próximo." },
  monitor:            { label: "Monitorar",               icon: <Eye className="h-4 w-4 text-white/60" />,          severity: "low",      defaultJust: "Sem sinais críticos no momento." },
};

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName?: string;
  interventionType?: InterventionType;
  suggestedSpecialty?: string;
  suggestedTopics?: string;
  suggestedJustification?: string;
  callAPI: (body: Record<string, unknown>) => Promise<any>;
  onSuccess?: (result: { request_id: string; governance_log_id: string | null; decision_id: string | null }) => void;
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function QuickInterventionDialog({
  open,
  onClose,
  studentId,
  studentName,
  interventionType = "recovery",
  suggestedSpecialty,
  suggestedTopics,
  suggestedJustification,
  callAPI,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const meta = TYPE_META[interventionType];
  const [title, setTitle] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [topics, setTopics] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestId = useMemo(() => uuid(), [open, studentId, interventionType]);

  useEffect(() => {
    if (!open) return;
    const sp = suggestedSpecialty || "";
    setSpecialty(sp);
    setTopics(suggestedTopics || "");
    setJustification(suggestedJustification || meta.defaultJust);
    setTitle(
      interventionType === "recovery" && sp
        ? `Recovery dirigido — ${sp}`
        : meta.label
    );
  }, [open, interventionType, suggestedSpecialty, suggestedTopics, suggestedJustification, meta.defaultJust, meta.label]);

  const needsTopics = interventionType === "recovery";
  const needsMessage = interventionType === "mentoria";

  const handleSubmit = async () => {
    if (!studentId) return;
    if (needsTopics && (!specialty.trim() || !topics.trim())) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Especialidade e tópicos são necessários para Recovery.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (interventionType === "recovery") {
        payload.title = title.trim() || meta.label;
        payload.specialty = specialty.trim();
        payload.topics_to_cover = topics.trim();
      } else if (interventionType === "mentoria") {
        payload.message = topics.trim() || undefined;
      } else if (interventionType === "fsrs_review" || interventionType === "adaptive_simulado") {
        if (specialty.trim()) payload.specialty = specialty.trim();
      } else if (interventionType === "reduce_load") {
        payload.reduce_factor = 0.5;
      }

      const res = await callAPI({
        action: "assign_intervention",
        intervention_type: interventionType,
        target_user_id: studentId,
        severity: meta.severity,
        justification: justification.trim() || meta.defaultJust,
        request_id: requestId,
        payload,
      });

      toast({
        title: meta.label + " registrado",
        description: `${studentName || "Aluno"} · req ${requestId.slice(0, 8)}`,
      });
      onSuccess?.({
        request_id: res?.request_id || requestId,
        governance_log_id: res?.governance_log_id ?? null,
        decision_id: res?.decision_id ?? null,
      });
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao registrar intervenção",
        description: e?.message || "A ação foi tentada mas não pôde ser persistida.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {meta.icon}
            {meta.label}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            Para <strong>{studentName || "este aluno"}</strong>.
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              severity {meta.severity}
            </Badge>
            <span className="text-[10px] font-mono text-white/40">req {requestId.slice(0, 8)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {needsTopics && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="qi-title" className="text-xs uppercase tracking-wider">Título</Label>
                <Input id="qi-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recovery dirigido — Cardiologia" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qi-spec" className="text-xs uppercase tracking-wider">Especialidade</Label>
                <Input id="qi-spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Cardiologia" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qi-topics" className="text-xs uppercase tracking-wider">Tópicos a cobrir</Label>
                <Textarea id="qi-topics" value={topics} onChange={(e) => setTopics(e.target.value)} rows={3} placeholder="Insuficiência cardíaca, Arritmias..." />
              </div>
            </>
          )}

          {(interventionType === "fsrs_review" || interventionType === "adaptive_simulado") && (
            <div className="space-y-1.5">
              <Label htmlFor="qi-spec2" className="text-xs uppercase tracking-wider">
                Especialidade (opcional)
              </Label>
              <Input id="qi-spec2" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex: Cardiologia" />
            </div>
          )}

          {needsMessage && (
            <div className="space-y-1.5">
              <Label htmlFor="qi-msg" className="text-xs uppercase tracking-wider">Mensagem ao aluno (opcional)</Label>
              <Textarea id="qi-msg" value={topics} onChange={(e) => setTopics(e.target.value)} rows={3} placeholder="Vamos conversar sobre seu plano de estudos..." />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qi-just" className="text-xs uppercase tracking-wider">Justificativa</Label>
            <Textarea id="qi-just" value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="qi-submit">
            {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
            Registrar intervenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
