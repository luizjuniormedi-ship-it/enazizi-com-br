import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Brain, Sparkles, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { LoopContext, StepResult } from "@/hooks/useStudyLoop";

interface Props {
  context: LoopContext;
  result: StepResult | null;
  loading: boolean;
  onSubmitAnswer: (answer: string) => void;
  onCompleteReview: () => void;
  onQuickAction: (endpoint: string) => void;
}

const QUICK_ACTIONS: Record<string, { label: string; icon: React.ReactNode; endpoint: string }[]> = {
  review: [
    { label: "Explicação profunda", icon: <Brain className="h-3.5 w-3.5" />, endpoint: "explain-deep" },
  ],
  error_review: [
    { label: "Explicação rápida", icon: <Sparkles className="h-3.5 w-3.5" />, endpoint: "explain-simple" },
  ],
  daily_task: [
    { label: "Explicação rápida", icon: <Sparkles className="h-3.5 w-3.5" />, endpoint: "explain-simple" },
  ],
  free_study: [
    { label: "Resumo", icon: <BookOpen className="h-3.5 w-3.5" />, endpoint: "summarize-topic" },
  ],
};

export default function StudyLoopExecution({ context, result, loading, onSubmitAnswer, onCompleteReview, onQuickAction }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const rec = context.recommendation;
  const question = result?.generatedQuestion;
  const isReview = rec.type === "review";
  const actions = QUICK_ACTIONS[rec.type] || [];

  if (loading && !result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando sua missão...</p>
      </div>
    );
  }

  // Review flow (no question)
  if (isReview && result?.summaryContent) {
    return (
      <div className="space-y-4 px-1">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Revisão: {context.theme}
        </h3>

        <Card className="border-border/50">
          <CardContent className="p-4 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{result.summaryContent}</ReactMarkdown>
          </CardContent>
        </Card>

        {result.helperContent && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result.helperContent}</ReactMarkdown>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.endpoint} variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onQuickAction(a.endpoint)} disabled={loading}>
              {a.icon} {a.label}
            </Button>
          ))}
        </div>

        <Button size="lg" className="w-full h-12 font-semibold gap-2" onClick={onCompleteReview} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Concluir revisão
        </Button>
      </div>
    );
  }

  // Reinforcement context (error flow retry)
  const reinforcement = result?.reinforcement;

  // Question flow
  if (question) {
    return (
      <div className="space-y-4 px-1">
        {reinforcement && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 space-y-2">
              <h4 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                <Brain className="h-4 w-4" /> Reforço do erro anterior
              </h4>
              <p className="text-sm text-foreground">{reinforcement.explanation}</p>
              <p className="text-xs text-muted-foreground"><strong>Correção:</strong> {reinforcement.correction}</p>
              <p className="text-xs text-muted-foreground italic">💡 {reinforcement.tip}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Badge variant="outline" className="text-[10px]">
            {question.difficulty === "easy" ? "Fácil" : question.difficulty === "hard" ? "Difícil" : "Intermediário"}
          </Badge>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {question.question}
          </div>
        </div>

        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selectedAnswer === letter;
            return (
              <button
                key={i}
                onClick={() => setSelectedAnswer(letter)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <span className="font-semibold mr-2">{letter}.</span>
                {opt}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.endpoint} variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onQuickAction(a.endpoint)} disabled={loading}>
              {a.icon} {a.label}
            </Button>
          ))}
        </div>

        {result?.helperContent && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result.helperContent}</ReactMarkdown>
            </CardContent>
          </Card>
        )}

        <Button
          size="lg"
          className="w-full h-12 font-semibold"
          disabled={!selectedAnswer || loading}
          onClick={() => {
            if (selectedAnswer) {
              onSubmitAnswer(selectedAnswer);
              setSelectedAnswer(null);
            }
          }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar resposta"}
        </Button>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando conteúdo...</p>
    </div>
  );
}
