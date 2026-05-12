
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

interface Props {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuestionReportDialog({ questionId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!reason) {
      toast.error("Por favor, selecione um motivo.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("question_reports").insert({
        user_id: user.id,
        question_id: questionId,
        reason,
        comment,
      });

      if (error) throw error;

      toast.success("Reporte enviado com sucesso. Obrigado!");
      onOpenChange(false);
      setReason("");
      setComment("");
    } catch (err: any) {
      toast.error("Erro ao enviar reporte: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Reportar Erro Editorial
          </DialogTitle>
          <DialogDescription>
            Encontrou um erro no enunciado, alternativas ou gabarito? Informe-nos para correção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo do reporte</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o problema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wrong_answer">Gabarito incorreto</SelectItem>
                <SelectItem value="statement_error">Erro no enunciado</SelectItem>
                <SelectItem value="image_issue">Problema na imagem</SelectItem>
                <SelectItem value="duplicate">Questão duplicada</SelectItem>
                <SelectItem value="other">Outro problema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Comentário adicional (opcional)</label>
            <Textarea 
              placeholder="Descreva o erro detalhadamente..." 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar Reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
