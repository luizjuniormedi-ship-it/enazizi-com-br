import { useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSubmitMnemonicFeedback } from "@/hooks/useSubmitMnemonicFeedback";
import { validateFeedback } from "@/utils/mnemonicValidation";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultId: string;
  requestId?: string;
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5 transition-colors"
          >
            <Star
              className={`h-6 w-6 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MnemonicFeedbackModal({ open, onOpenChange, resultId, requestId }: Props) {
  const [ratingGeneral, setRatingGeneral] = useState(0);
  const [ratingMedical, setRatingMedical] = useState(0);
  const [ratingPedagogical, setRatingPedagogical] = useState(0);
  const [comentario, setComentario] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useSubmitMnemonicFeedback();

  const handleSubmit = () => {
    const validation = validateFeedback({
      rating_general: ratingGeneral,
      rating_medical: ratingMedical,
      rating_pedagogical: ratingPedagogical,
    });
    if (!validation.valid) {
      toast.error("Preencha todas as notas (1 a 5).");
      return;
    }

    mutation.mutate(
      {
        result_id: resultId,
        request_id: requestId,
        rating_general: ratingGeneral,
        rating_medical: ratingMedical,
        rating_pedagogical: ratingPedagogical,
        comentario: comentario.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast.success("Feedback enviado!");
        },
        onError: (err) => {
          toast.error(err.message || "Erro ao enviar feedback.");
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setRatingGeneral(0);
      setRatingMedical(0);
      setRatingPedagogical(0);
      setComentario("");
      setSubmitted(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar mnemônico</DialogTitle>
          <DialogDescription>Sua avaliação ajuda a melhorar a qualidade das gerações.</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-sm text-muted-foreground">Obrigado pelo seu feedback!</p>
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <StarRating label="Nota geral" value={ratingGeneral} onChange={setRatingGeneral} />
            <StarRating label="Precisão médica" value={ratingMedical} onChange={setRatingMedical} />
            <StarRating label="Qualidade pedagógica" value={ratingPedagogical} onChange={setRatingPedagogical} />

            <div className="space-y-1">
              <Label className="text-sm font-medium">Comentário (opcional)</Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Sugestões, críticas ou elogios..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || ratingGeneral === 0 || ratingMedical === 0 || ratingPedagogical === 0}
              className="w-full"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar avaliação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
