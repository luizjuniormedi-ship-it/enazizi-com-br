import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MiniQuizBlock as MiniQuizBlockType } from "@/types/tutor";

interface Props {
  block: MiniQuizBlockType;
  /** Callback opcional — Sprint 6 fará writeback adaptativo. */
  onAnswered?: (params: { correct: boolean; selectedIndex: number }) => void;
}

/**
 * MiniQuizBlock — Sprint 4
 * Versão visual/interativa local. Sem writeback adaptativo ainda.
 */
export function MiniQuizBlock({ block, onAnswered }: Props) {
  const { stem, options, correct_index, explanation } = block.payload;
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const correct = answered && selected === correct_index;

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    onAnswered?.({ correct: idx === correct_index, selectedIndex: idx });
  };

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-accent-foreground" />
          Mini Quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-foreground">{stem}</p>
        <div className="space-y-2">
          {options.map((opt, idx) => {
            const isSelected = selected === idx;
            const isCorrectOption = idx === correct_index;
            return (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start text-left whitespace-normal h-auto py-2",
                  answered && isCorrectOption && "border-success bg-success/10",
                  answered && isSelected && !isCorrectOption && "border-destructive bg-destructive/10"
                )}
                onClick={() => handleSelect(idx)}
                disabled={answered}
              >
                <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span>
                <span className="flex-1">{opt}</span>
                {answered && isCorrectOption && (
                  <CheckCircle2 className="ml-2 h-4 w-4 text-success" />
                )}
                {answered && isSelected && !isCorrectOption && (
                  <XCircle className="ml-2 h-4 w-4 text-destructive" />
                )}
              </Button>
            );
          })}
        </div>
        {answered && (
          <div
            className={cn(
              "rounded-md border p-3 text-sm",
              correct
                ? "border-success/30 bg-success/5 text-foreground"
                : "border-destructive/30 bg-destructive/5 text-foreground"
            )}
          >
            <strong>{correct ? "✅ Correto!" : "❌ Não foi dessa vez."}</strong>
            <p className="mt-1 text-muted-foreground">{explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
