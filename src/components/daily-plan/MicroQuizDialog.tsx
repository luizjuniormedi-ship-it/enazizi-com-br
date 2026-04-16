import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  specialty: string;
  onPass: () => void;
}

const TIMEOUT_MS = 12000;

const MicroQuizDialog = ({ open, onOpenChange, topic, specialty, onPass }: Props) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"idle" | "loading" | "quiz" | "result">("idle");
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setQuestions([]);
      setCurrentQ(0);
      setSelected(null);
      setScore(0);
      setPhase("idle");
      fetchingRef.current = false;
      return;
    }

    if (fetchingRef.current || phase !== "idle") return;
    fetchingRef.current = true;
    setPhase("loading");

    let cancelled = false;

    const fetchQuiz = async () => {
      try {
        const result = await Promise.race([
          supabase.functions.invoke("micro-quiz", { body: { topic, specialty } }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)),
        ]);

        if (cancelled) return;

        const { data, error } = result as any;
        if (error) throw error;

        const parsed: QuizQuestion[] = (data?.questions || []).slice(0, 2).map((q: any) => ({
          question: q.question || "",
          options: (q.options || []).map((o: any) => typeof o === "string" ? o : o.text || ""),
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation || "",
        }));

        if (parsed.length === 0 || !parsed[0].question) {
          onPass();
          onOpenChange(false);
          return;
        }

        setQuestions(parsed);
        setPhase("quiz");
      } catch {
        if (!cancelled) {
          onPass();
          onOpenChange(false);
        }
      }
    };

    fetchQuiz();

    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === questions[currentQ]?.correctIndex;
    if (correct) {
      setScore(s => s + 1);
      import("@/lib/haptics").then(h => h.hapticSuccess());
    } else {
      import("@/lib/haptics").then(h => h.hapticError());
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
    } else {
      setPhase("result");
    }
  };

  const handleFinish = () => {
    onPass();
    onOpenChange(false);
  };

  const q = questions[currentQ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Micro-quiz: {topic}
          </DialogTitle>
          <DialogDescription>Responda para validar sua retenção</DialogDescription>
        </DialogHeader>

        {phase === "loading" && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Gerando questões...</span>
          </div>
        )}

        {phase === "quiz" && q && (
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Questão {currentQ + 1}/{questions.length}</span>
              <span>{score} acerto(s)</span>
            </div>
            <p className="text-sm font-medium">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correctIndex;
                const isSelected = i === selected;
                let cls = "border bg-card hover:bg-accent/50 cursor-pointer";
                if (selected !== null) {
                  if (isCorrect) cls = "border-green-500 bg-green-500/10";
                  else if (isSelected) cls = "border-destructive bg-destructive/10";
                  else cls = "border opacity-50";
                }
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm flex items-center gap-2 transition-all ${cls}`}
                    onClick={() => handleSelect(i)}
                  >
                    {selected !== null && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    {selected !== null && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                    <span className="font-medium mr-1">{String.fromCharCode(65 + i)})</span>
                    {opt}
                  </div>
                );
              })}
            </div>
            {selected !== null && q.explanation && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{q.explanation}</p>
            )}
            {selected !== null && (
              <Button onClick={handleNext} className="w-full" size="sm">
                {currentQ < questions.length - 1 ? "Próxima" : "Ver Resultado"}
              </Button>
            )}
          </div>
        )}

        {phase === "result" && (
          <div className="text-center py-6 space-y-4">
            <div className="text-4xl font-bold text-primary">{score}/{questions.length}</div>
            <p className="text-sm text-muted-foreground">
              {score === questions.length ? "Excelente! Você domina esse tema! 🎉" : "Continue revisando para melhorar! 💪"}
            </p>
            <Button onClick={handleFinish} className="w-full">
              Concluir Revisão
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MicroQuizDialog;
