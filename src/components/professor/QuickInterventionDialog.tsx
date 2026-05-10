/**
 * QuickInterventionDialog
 * Diálogo de "Atribuir Recovery em 1 clique" para aluno em risco.
 * Cria study_assignment real via action `create_study_assignment` (já existente).
 * Pré-preenche título/especialidade/tópicos com base no aluno selecionado.
 * Sem mocks. Sem inventar dados.
 */
import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Target, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName?: string;
  suggestedSpecialty?: string;
  suggestedTopics?: string;
  callAPI: (body: Record<string, unknown>) => Promise<any>;
  onSuccess?: () => void;
}

export default function QuickInterventionDialog({
  open,
  onClose,
  studentId,
  studentName,
  suggestedSpecialty,
  suggestedTopics,
  callAPI,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [topics, setTopics] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const sp = suggestedSpecialty || "";
    setSpecialty(sp);
    setTopics(suggestedTopics || "");
    setTitle(
      sp
        ? `Recovery dirigido — ${sp}`
        : "Recovery dirigido"
    );
  }, [open, suggestedSpecialty, suggestedTopics]);

  const handleSubmit = async () => {
    if (!studentId) return;
    if (!title.trim() || !specialty.trim() || !topics.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Título, especialidade e tópicos são necessários.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await callAPI({
        action: "create_study_assignment",
        title: title.trim(),
        specialty: specialty.trim(),
        topics_to_cover: topics.trim(),
        student_ids: [studentId],
      });
      toast({
        title: "Recovery atribuído",
        description: `${studentName || "Aluno"} foi notificado.`,
      });
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao atribuir",
        description: e?.message || "Não foi possível criar a tarefa.",
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
            <Target className="h-4 w-4 text-primary" />
            Atribuir Recovery
          </DialogTitle>
          <DialogDescription>
            Cria uma tarefa de estudo dirigida para{" "}
            <strong>{studentName || "este aluno"}</strong>. O aluno será notificado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qi-title" className="text-xs uppercase tracking-wider">Título</Label>
            <Input
              id="qi-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recovery dirigido — Cardiologia"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qi-spec" className="text-xs uppercase tracking-wider">Especialidade</Label>
            <Input
              id="qi-spec"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Cardiologia"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qi-topics" className="text-xs uppercase tracking-wider">Tópicos a cobrir</Label>
            <Textarea
              id="qi-topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Insuficiência cardíaca, Arritmias, Síndromes coronarianas..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Target className="h-3 w-3 mr-1.5" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
