import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudyLoopIntro from "./StudyLoopIntro";
import StudyLoopExecution from "./StudyLoopExecution";
import StudyLoopFeedback from "./StudyLoopFeedback";
import type { LoopPhase, LoopContext, StepResult } from "@/hooks/useStudyLoop";

interface Props {
  phase: LoopPhase;
  context: LoopContext | null;
  result: StepResult | null;
  loading: boolean;
  error: string | null;
  onBeginExecution: () => void;
  onSubmitAnswer: (answer: string) => void;
  onCompleteReview: () => void;
  onContinue: () => void;
  onQuickAction: (endpoint: string) => void;
  onClose: () => void;
}

const PHASE_TITLES: Record<LoopPhase, string> = {
  idle: "",
  intro: "Preparar missão",
  running: "Missão em andamento",
  feedback: "Resultado",
  next: "Carregando...",
  complete: "Missão concluída",
};

export default function StudyLoopPanel({
  phase, context, result, loading, error,
  onBeginExecution, onSubmitAnswer, onCompleteReview,
  onContinue, onQuickAction, onClose,
}: Props) {
  const open = phase !== "idle";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="h-[92vh] sm:h-[88vh] rounded-t-2xl overflow-y-auto p-4 sm:p-6"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">{PHASE_TITLES[phase]}</SheetTitle>
        </SheetHeader>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={onBeginExecution}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Phase content */}
        {phase === "intro" && context && (
          <StudyLoopIntro context={context} onStart={onBeginExecution} onCancel={onClose} />
        )}

        {phase === "running" && context && (
          <StudyLoopExecution
            context={context}
            result={result}
            loading={loading}
            onSubmitAnswer={onSubmitAnswer}
            onCompleteReview={onCompleteReview}
            onQuickAction={onQuickAction}
          />
        )}

        {phase === "feedback" && result && (
          <StudyLoopFeedback
            result={result}
            hasNextQuestion={!result.correct && !!result.generatedQuestion}
            loading={loading}
            onContinue={onContinue}
          />
        )}

        {phase === "next" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Buscando próxima missão...</p>
          </div>
        )}

        {phase === "complete" && (
          <div className="flex flex-col items-center text-center py-12 gap-4">
            <div className="text-5xl">🎯</div>
            <h3 className="text-lg font-bold text-foreground">Etapa concluída!</h3>
            <p className="text-sm text-muted-foreground">Sua missão foi atualizada.</p>
            <Button size="lg" className="mt-2" onClick={onClose}>
              Ver nova missão
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
