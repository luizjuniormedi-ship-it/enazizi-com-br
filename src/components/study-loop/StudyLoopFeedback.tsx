import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ArrowRight, Loader2, BookOpen, Brain, Sparkles } from "lucide-react";
import type { StepResult } from "@/hooks/useStudyLoop";

interface Props {
  result: StepResult;
  hasNextQuestion: boolean;
  loading: boolean;
  onContinue: () => void;
  onQuickAction: (endpoint: string) => void;
}

export default function StudyLoopFeedback({ result, hasNextQuestion, loading, onContinue, onQuickAction }: Props) {
  const correct = result.correct;
  const maxReached = result.maxReinforcementsReached;

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
        {correct ? "Muito bem! 🎉" : maxReached ? "Vamos revisar esse tema" : "Não foi dessa vez"}
      </h3>

      {/* Completion badges */}
      {result.completionBadges && result.completionBadges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {result.completionBadges.map((badge, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {badge}
            </Badge>
          ))}
        </div>
      )}

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

      {/* Elegant exit — max reinforcements reached */}
      {maxReached && (
        <Card className="w-full border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3 text-left">
            <p className="text-sm text-foreground font-medium">
              Parece que esse tema precisa de mais atenção. Que tal uma abordagem diferente?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onQuickAction("summarize-topic")}>
                <BookOpen className="h-3.5 w-3.5" /> Resumo do tema
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onQuickAction("explain-deep")}>
                <Brain className="h-3.5 w-3.5" /> Explicação profunda
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onQuickAction("explain-simple")}>
                <Sparkles className="h-3.5 w-3.5" /> Explicação simples
              </Button>
            </div>
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
