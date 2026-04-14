import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from "lucide-react";
import type { StepResult } from "@/hooks/useStudyLoop";

interface Props {
  result: StepResult;
  hasNextQuestion: boolean;
  loading: boolean;
  onContinue: () => void;
}

export default function StudyLoopFeedback({ result, hasNextQuestion, loading, onContinue }: Props) {
  const correct = result.correct;

  return (
    <div className="flex flex-col items-center text-center space-y-5 py-6 px-4">
      {/* Icon */}
      {correct ? (
        <div className="rounded-full bg-primary/10 p-4">
          <CheckCircle2 className="h-12 w-12 text-primary" />
        </div>
      ) : (
        <div className="rounded-full bg-destructive/10 p-4">
          <XCircle className="h-12 w-12 text-destructive" />
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-bold text-foreground">
        {correct ? "Muito bem! 🎉" : "Não foi dessa vez"}
      </h3>

      {/* Explanation */}
      {result.explanation && (
        <Card className="w-full border-border/50">
          <CardContent className="p-4 text-sm text-foreground text-left leading-relaxed">
            {result.explanation}
          </CardContent>
        </Card>
      )}

      {/* Reinforcement for errors */}
      {!correct && result.reinforcement && (
        <Card className="w-full border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 space-y-2 text-left">
            <p className="text-sm text-foreground">{result.reinforcement.explanation}</p>
            <p className="text-xs text-muted-foreground"><strong>Correção:</strong> {result.reinforcement.correction}</p>
            <p className="text-xs text-muted-foreground italic">💡 {result.reinforcement.tip}</p>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <Button
        size="lg"
        className="w-full max-w-xs h-12 font-semibold gap-2"
        onClick={onContinue}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <ArrowRight className="h-5 w-5" />
            {hasNextQuestion ? "Tentar nova questão" : correct ? "Próxima missão" : "Continuar"}
          </>
        )}
      </Button>
    </div>
  );
}
