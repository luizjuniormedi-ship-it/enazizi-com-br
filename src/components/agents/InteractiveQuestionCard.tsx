import { useState, useMemo } from "react";
import { dispatchPedagogicalEvent } from "@/lib/events";
import MedicalTermHighlighter from "@/components/medical/MedicalTermHighlighter";
import { CheckCircle2, XCircle, BookOpen, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cleanLatex } from "@/lib/cleanLatex";

export interface InteractiveQuestion {
  statement: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic?: string;
  reference?: string;
}

interface Props {
  question: InteractiveQuestion;
  index: number;
}

const LETTERS = ["A", "B", "C", "D", "E"];

const InteractiveQuestionCard = ({ question, index }: Props) => {
  const [selected, setSelected] = useState<number | null>(null);
  const { user } = useAuth();
  const { addXp } = useGamification();
  const navigate = useNavigate();
  const answered = selected !== null;
  const isCorrect = selected === question.correctIndex;

  // Clean LaTeX residues from statement and options
  const cleanedStatement = useMemo(() => cleanLatex(question.statement), [question.statement]);
  const cleanedOptions = useMemo(() => question.options.map(o => cleanLatex(o)), [question.options]);
  const cleanedExplanation = useMemo(() => cleanLatex(question.explanation), [question.explanation]);

  const handleSelect = async (optionIndex: number) => {
    setSelected(optionIndex);
    const correct = optionIndex === question.correctIndex;

    // Emit standardized pedagogical event
    dispatchPedagogicalEvent('question_answered', {
      questionId: `q_${index}`,
      correct,
      timeMs: 0, 
      topic: question.topic
    });

    if (!user) return;

    // Award XP
    await addXp(correct ? XP_REWARDS.question_correct : XP_REWARDS.question_answered);

    // Log wrong answer to error_bank
    if (!correct) {
      await logErrorToBank({
        userId: user.id,
        tema: question.topic || "Geral",
        tipoQuestao: "objetiva",
        conteudo: question.statement?.slice(0, 500),
        motivoErro: `Marcou "${LETTERS[optionIndex]}: ${question.options[optionIndex]}" — Correta: "${LETTERS[question.correctIndex]}: ${question.options[question.correctIndex]}"`,
        categoriaErro: "conceito",
      });
    }
  };

  const handleStudyWithTutor = () => {
    navigate("/dashboard/mentor", {
      state: {
        initialMessage: `Errei uma questão sobre "${question.topic || "Medicina"}". O enunciado era: "${question.statement.slice(0, 200)}". A resposta correta era "${LETTERS[question.correctIndex]}: ${question.options[question.correctIndex]}". Me explique este tema seguindo o protocolo ENAZIZI.`,
        fromErrorBank: true,
      },
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Topic badge */}
      {question.topic && (
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {question.topic}
        </span>
      )}

      {/* Question number + statement */}
      <p className="text-sm font-medium leading-relaxed">
        <span className="text-primary font-bold mr-1.5">Questão {index + 1}.</span>
        <MedicalTermHighlighter text={cleanedStatement} />
      </p>

      {/* Options */}
      <div className="space-y-2">
        {cleanedOptions.map((opt, oi) => {
          const isThis = selected === oi;
          const isRight = oi === question.correctIndex;

          let style = "border-border bg-secondary/50 hover:bg-secondary cursor-pointer";
          if (answered) {
            if (isRight) style = "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400";
            else if (isThis && !isRight) style = "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400";
            else style = "border-border bg-muted/30 opacity-60";
          }

          return (
            <button
              key={oi}
              disabled={answered}
              onClick={() => handleSelect(oi)}
              className={cn(
                "w-full text-left flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-all",
                style,
              )}
            >
              <span className={cn(
                "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border",
                answered && isRight
                  ? "border-green-500 bg-green-500 text-white"
                  : answered && isThis && !isRight
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-current opacity-70",
              )}>
                {answered && isRight ? <CheckCircle2 className="h-4 w-4" /> : answered && isThis && !isRight ? <XCircle className="h-4 w-4" /> : LETTERS[oi]}
              </span>
              <span className="pt-0.5 leading-relaxed">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback after answering */}
      {answered && (
        <div className={cn(
          "rounded-lg p-3 text-sm space-y-2 animate-fade-in",
          isCorrect ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30",
        )}>
          <div className="flex items-center gap-2 font-semibold">
            {isCorrect ? (
              <><CheckCircle2 className="h-4 w-4 text-green-500" /> Você acertou! 🎉</>
            ) : (
              <><XCircle className="h-4 w-4 text-red-500" /> Resposta incorreta. A correta é <span className="text-primary">{LETTERS[question.correctIndex]}</span>.</>
            )}
          </div>
          {question.explanation && (
            <div className="text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground flex items-center gap-1 mb-1">
                <BookOpen className="h-3.5 w-3.5" /> Explicação:
              </span>
              <MedicalTermHighlighter text={cleanedExplanation} />
            </div>
          )}
          {question.reference && (
            <p className="text-xs text-muted-foreground italic">📚 {question.reference}</p>
          )}
          {!isCorrect && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 mt-1 text-xs"
              onClick={handleStudyWithTutor}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Estudar com Tutor IA
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractiveQuestionCard;
