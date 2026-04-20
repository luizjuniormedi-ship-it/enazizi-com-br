import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ListPlus, FileQuestion, Layers, ArrowRight } from "lucide-react";

interface Props {
  /** Tópico atual da sessão para passar como contexto. */
  topic?: string | null;
  /** Especialidade atual (opcional). */
  specialty?: string | null;
  /** Callback opcional para "Adicionar ao Planner" — se omitido, navega para o planner. */
  onAddToPlanner?: () => void;
}

/**
 * Bloco fixo de próximos passos exibido no rodapé da conversa do Tutor.
 * Não interfere no fluxo do chat: apenas oferece 3 atalhos de continuidade.
 *
 * Aparece somente após o usuário ter conversado (mensagens > 1).
 */
export default function TutorNextStepBlock({ topic, specialty, onAddToPlanner }: Props) {
  const navigate = useNavigate();

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

  const goPractice = () => {
    navigate(`/dashboard/banco-questoes?${buildParams({ taskType: "practice", quantity: "5" })}`);
  };

  const goFlashcards = () => {
    navigate(`/dashboard/flashcards?${buildParams({ taskType: "review", auto: "1" })}`);
  };

  const goPlanner = () => {
    if (onAddToPlanner) {
      onAddToPlanner();
      return;
    }
    navigate(`/dashboard/cronograma?${buildParams({ add: "1" })}`);
  };

  return (
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
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 justify-start sm:justify-center"
          onClick={goPractice}
        >
          <FileQuestion className="h-3.5 w-3.5" />
          <span className="text-xs">Praticar 5 questões</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 justify-start sm:justify-center"
          onClick={goPlanner}
        >
          <ListPlus className="h-3.5 w-3.5" />
          <span className="text-xs">Adicionar ao Planner</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 justify-start sm:justify-center"
          onClick={goFlashcards}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="text-xs">Gerar flashcards</span>
        </Button>
      </div>
    </div>
  );
}
