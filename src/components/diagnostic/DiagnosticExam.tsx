import { useState, useEffect, useCallback } from "react";
import { Stethoscope, Clock, ArrowRight, Pause, Play, AlertTriangle, CheckCircle2, XCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DiagQuestion {
  statement: string;
  options: string[];
  correct_index: number;
  topic: string;
  explanation: string;
  difficulty?: string;
}

export interface AnswerRecord {
  questionIdx: number;
  selected: number;
  correct: boolean;
  topic: string;
  timeSpent: number;
}

interface DiagnosticExamProps {
  questions: DiagQuestion[];
  onFinish: (answers: AnswerRecord[]) => void;
  onGoToReview: (answers: AnswerRecord[], currentIdx: number) => void;
}

const SECONDS_PER_QUESTION = 60;

const DiagnosticExam = ({ questions, onFinish, onGoToReview }: DiagnosticExamProps) => {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [timer, setTimer] = useState(SECONDS_PER_QUESTION);
  const [paused, setPaused] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Timer countdown
  useEffect(() => {
    if (paused || answered) return;
    if (timer <= 0) {
      // Auto-answer when time runs out
      handleTimeout();
      return;
    }
    const interval = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer, paused, answered]);

  // Reset timer on question change
  useEffect(() => {
    setTimer(SECONDS_PER_QUESTION);
    setQuestionStartTime(Date.now());
  }, [current]);

  const handleTimeout = useCallback(() => {
    const q = questions[current];
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    setAnswered(true);
    setAnswers(prev => [...prev, {
      questionIdx: current,
      selected: -1,
      correct: false,
      topic: q.topic,
      timeSpent,
    }]);
  }, [current, questions, questionStartTime]);

  const handleAnswer = () => {
    if (selected === null) return;
    const q = questions[current];
    const isCorrect = selected === q.correct_index;
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    setAnswered(true);
    setAnswers(prev => [...prev, {
      questionIdx: current,
      selected,
      correct: isCorrect,
      topic: q.topic,
      timeSpent,
    }]);
    import("@/lib/haptics").then(h => isCorrect ? h.hapticSuccess() : h.hapticError());
  };

  const nextQuestion = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      const finalAnswers = answers;
      onGoToReview(finalAnswers, current);
    }
  };

  const q = questions[current];
  if (!q) return null;

  const progressPct = ((current + 1) / questions.length) * 100;
  const timerPct = (timer / SECONDS_PER_QUESTION) * 100;
  const isTimeLow = timer <= 15;
  const correctSoFar = answers.filter(a => a.correct).length;
  const answeredCount = answers.length;

  // Calculate area progress
  const areaMap = new Map<string, { done: number; total: number }>();
  for (const q2 of questions) {
    const entry = areaMap.get(q2.topic) || { done: 0, total: 0 };
    entry.total++;
    areaMap.set(q2.topic, entry);
  }
  for (const a of answers) {
    const entry = areaMap.get(a.topic);
    if (entry) entry.done++;
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">Diagnóstico</span>
          <Badge variant="secondary" className="text-xs">{q.topic}</Badge>
          {q.difficulty && (
            <Badge variant="outline" className="text-xs capitalize">{q.difficulty}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {correctSoFar}/{answeredCount}
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {current + 1}/{questions.length}
          </span>
        </div>
      </div>

      {/* Global progress */}
      <Progress value={progressPct} className="h-1.5" />

      {/* Area progress pills */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from(areaMap.entries()).map(([area, { done, total }]) => (
          <div
            key={area}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border transition-all",
              area === q.topic
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : done === total
                ? "border-green-500/30 bg-green-500/5 text-green-600"
                : "border-border text-muted-foreground"
            )}
          >
            {area.split(" ")[0]} {done}/{total}
          </div>
        ))}
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className={cn(
            "h-2 rounded-full transition-all",
            isTimeLow ? "bg-destructive/20" : "bg-secondary"
          )}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                isTimeLow ? "bg-destructive animate-pulse" : "bg-primary"
              )}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>
        <div className={cn(
          "flex items-center gap-1 text-sm font-mono min-w-[60px] justify-end",
          isTimeLow ? "text-destructive font-bold" : "text-muted-foreground"
        )}>
          <Clock className="h-3.5 w-3.5" />
          {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPaused(!paused)}
          disabled={answered}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Paused overlay */}
      {paused && !answered && (
        <div className="glass-card p-8 text-center">
          <Pause className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-semibold">Pausado</p>
          <p className="text-sm text-muted-foreground mb-4">A questão está oculta enquanto pausado.</p>
          <Button onClick={() => setPaused(false)}>
            <Play className="h-4 w-4 mr-2" /> Continuar
          </Button>
        </div>
      )}

      {/* Question card */}
      {!paused && (
        <div className="glass-card p-6">
          <p className="text-base font-medium mb-6 leading-relaxed">{q.statement}</p>
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isCorrectOpt = i === q.correct_index;
              const isSelectedOpt = i === selected;
              const wasSelected = answered && i === selected;

              return (
                <button
                  key={i}
                  onClick={() => !answered && setSelected(i)}
                  disabled={answered}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border text-sm transition-all flex items-start gap-3 group",
                    answered && isCorrectOpt
                      ? "border-green-500 bg-green-500/10"
                      : answered && wasSelected && !isCorrectOpt
                      ? "border-destructive bg-destructive/10"
                      : isSelectedOpt && !answered
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border transition-all",
                    answered && isCorrectOpt
                      ? "bg-green-500 text-white border-green-500"
                      : answered && wasSelected && !isCorrectOpt
                      ? "bg-destructive text-white border-destructive"
                      : isSelectedOpt && !answered
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border group-hover:border-primary/40"
                  )}>
                    {answered && isCorrectOpt ? <CheckCircle2 className="h-4 w-4" /> :
                     answered && wasSelected && !isCorrectOpt ? <XCircle className="h-4 w-4" /> :
                     letter}
                  </span>
                  <span className="pt-0.5">{opt.replace(/^[A-D]\)\s*/, "")}</span>
                </button>
              );
            })}
          </div>

          {/* Timeout indicator */}
          {answered && selected === -1 && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">Tempo esgotado! A questão foi marcada como incorreta.</p>
            </div>
          )}

          {/* Explanation */}
          {answered && q.explanation && (
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm leading-relaxed"><strong>Explicação:</strong> {q.explanation}</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onGoToReview(answers, current)}
            >
              <ListChecks className="h-4 w-4" /> Revisar respostas
            </Button>

            {!answered ? (
              <Button onClick={handleAnswer} disabled={selected === null}>
                Confirmar
              </Button>
            ) : (
              <Button onClick={nextQuestion} className="gap-1.5">
                {current < questions.length - 1 ? "Próxima" : "Revisar e finalizar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticExam;
