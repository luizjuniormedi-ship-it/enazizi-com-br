import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Loader2 } from "lucide-react";
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
  onRetry: () => void;
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

export default function StudyLoopContainer({
  phase, context, result, loading, error,
  onBeginExecution, onSubmitAnswer, onCompleteReview,
  onContinue, onQuickAction, onRetry, onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Scroll into view when loop starts
  useEffect(() => {
    if (phase !== "idle") {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  // Auto-continue after "complete" — load next mission automatically
  useEffect(() => {
    if (phase === "complete") {
      autoNextTimerRef.current = setTimeout(onClose, 2000);
    }
    return () => {
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    };
  }, [phase, onClose]);

  if (phase === "idle") return null;

  return (
    <div ref={containerRef} className="animate-fade-in">
      <Card className="border-primary/30 overflow-hidden">
        {/* Top accent */}
        <div className="h-1" style={{ background: "var(--gradient-primary)" }} />

        <CardContent className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {PHASE_TITLES[phase]}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Sair do estudo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={onRetry}>
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Intro */}
          {phase === "intro" && context && (
            <StudyLoopIntro context={context} onStart={onBeginExecution} onCancel={onClose} />
          )}

          {/* Execution (question / review) */}
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

          {/* Feedback */}
          {phase === "feedback" && result && (
            <StudyLoopFeedback
              result={result}
              hasNextQuestion={!result.correct && !!result.generatedQuestion && !result.maxReinforcementsReached}
              loading={loading}
              onContinue={onContinue}
              onQuickAction={onQuickAction}
            />
          )}

          {/* Loading next */}
          {phase === "next" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Buscando próxima missão...</p>
            </div>
          )}

          {/* Complete — brief success before auto-continuing */}
          {phase === "complete" && (
            <div className="flex flex-col items-center text-center py-8 gap-3 animate-fade-in">
              <div className="text-4xl">🎯</div>
              <h3 className="text-lg font-bold text-foreground">Etapa concluída!</h3>
              <p className="text-sm text-muted-foreground">Preparando próxima missão...</p>
              <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_forwards]" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
