import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ListPlus, FileQuestion, Layers, ArrowRight, RefreshCw, Video, CheckCircle2, Loader2 } from "lucide-react";
import { useFsrsDueCount } from "@/hooks/useFsrsDueCount";
import { useEducationalMemory } from "@/hooks/useEducationalMemory";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

interface Props {
  /** Tópico atual da sessão para passar como contexto. */
  topic?: string | null;
  /** Especialidade atual (opcional). */
  specialty?: string | null;
  /** Conteúdo atual para estruturação (opcional). */
  content?: string | null;
  /** ID da sessão (opcional). */
  sessionId?: string | null;
  /** Callback opcional para "Adicionar ao Planner" — se omitido, navega para o planner. */
  onAddToPlanner?: () => void;
}

export default function TutorNextStepBlock({ topic, specialty, content, sessionId, onAddToPlanner }: Props) {
  const navigate = useNavigate();
  const { dueByTopic, totalDue } = useFsrsDueCount();
  const { requestLesson } = useEducationalMemory();
  const [isRequesting, setIsRequesting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const dueHere = topic ? dueByTopic(topic) : 0;
  const fsrsPromoted = dueHere > 0 || totalDue >= 3;

  const buildParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (topic) {
      p.set("sc_topic", topic);
      p.set("topic", topic);
    }
    if (specialty) {
      p.set("sc_specialty", specialty);
      p.set("specialty", specialty);
    }
    p.set("source", "tutor_next_step");
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };

  const handleRequestLesson = async () => {
    setIsRequesting(true);
    try {
      await requestLesson({
        title: `Aula Personalizada: ${topic || "Medicina"}`,
        subject: specialty || "Geral",
        topic: topic || "Clínica Médica",
        source_session_id: sessionId || undefined,
        structured_content: { 
          original_prompt: content,
          requested_at: new Date().toISOString()
        }
      });
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Error requesting lesson:", error);
      toast.error("Erro ao solicitar aula personalizada.");
    } finally {
      setIsRequesting(false);
    }
  };

  const goPractice = () => {
    navigate(`/dashboard/banco-questoes?${buildParams({ taskType: "practice", quantity: "5" })}`);
  };

  const goReviewFsrs = () => {
    navigate(`/dashboard/flashcards?${buildParams({ taskType: "review", auto: "1", fsrs: "1" })}`);
  };

  const goPlanner = () => {
    if (onAddToPlanner) {
      onAddToPlanner();
      return;
    }
    navigate(`/dashboard/cronograma?${buildParams({ add: "1" })}`);
  };

  return (
    <>
      <div
        role="region"
        aria-label="Próximos passos sugeridos"
        className="mt-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-background p-3 sm:p-4"
      >
        <div className="flex items-center gap-2 mb-2.5">
          <ArrowRight className="h-4 w-4 text-primary" />
          <p className="text-xs sm:text-sm font-semibold">Próximo passo</p>
          {topic && (
            <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
              · {topic}
            </span>
          )}
          {fsrsPromoted && (
            <span className="ml-auto text-[10px] text-primary font-medium">
              {dueHere > 0
                ? `${dueHere} revisão${dueHere === 1 ? "" : "ões"} deste tema`
                : `${totalDue} revisões pendentes`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-none shadow-lg shadow-amber-600/20"
            disabled={isRequesting}
            onClick={handleRequestLesson}
          >
            {isRequesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
            <span className="text-xs">Solicitar Aula Personalizada</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={fsrsPromoted ? goReviewFsrs : goPractice}
          >
            {fsrsPromoted ? <RefreshCw className="h-3.5 w-3.5" /> : <FileQuestion className="h-3.5 w-3.5" />}
            <span className="text-xs">{fsrsPromoted ? "Reforçar com revisão" : "Praticar 5 questões"}</span>
          </Button>
        </div>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md bg-[#0a0a12] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              Aula solicitada com sucesso
            </DialogTitle>
            <DialogDescription className="text-white/60 pt-2">
              O Tutor IA estruturou sua aula e enviou para curadoria. Assim que o professor publicar o vídeo, ele aparecerá automaticamente na sua biblioteca.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)} className="border-white/10 text-white hover:bg-white/5">
              Continuar estudando
            </Button>
            <Button onClick={() => navigate("/dashboard/videoaulas")} className="bg-primary hover:bg-primary/90">
              Ir para Minhas Aulas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

