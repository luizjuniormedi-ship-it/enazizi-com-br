import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowRight, ArrowLeft, Flag, Bookmark, GraduationCap, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import type { SimuladoMode } from "./SimuladoSetup";
import ImageQuestionViewer from "./ImageQuestion";
import { isImageUrlClinical } from "@/lib/multimodalSafetyGate";

export interface SimQuestion {
  statement: string;
  options: string[];
  correct: number;
  topic: string;
  explanation?: string;
  bankId?: string;
  source?: string;
  image_url?: string;
  image_type?: string;
  _isImageQuestion?: boolean;
  _imageQuestionId?: string;
  _editorialGrade?: string;
  _questionMode?: string;
}

interface SimuladoExamProps {
  questions: SimQuestion[];
  timeSeconds: number;
  onFinish: (answers: Record<number, number>, flagged: number[]) => void;
  onAutoSaveState: () => { current: number; selectedAnswers: Record<number, number>; timeLeft: number };
  onStateChange?: (state: { current: number; selectedAnswers: Record<number, number>; timeLeft: number; flaggedQuestions: number[]; revealedQuestions: number[] }) => void;
  initialState?: { current?: number; selectedAnswers?: Record<number, number>; timeLeft?: number; flaggedQuestions?: number[]; revealedQuestions?: number[] };
  mode: SimuladoMode;
}

const SimuladoExam = ({ questions, timeSeconds, onFinish, initialState, mode, onStateChange }: SimuladoExamProps) => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(initialState?.current ?? 0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(initialState?.selectedAnswers ?? {});
  const [timeLeft, setTimeLeft] = useState(initialState?.timeLeft ?? timeSeconds);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set(initialState?.flaggedQuestions ?? []));
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set(initialState?.revealedQuestions ?? []));
  const timerRef = useRef<NodeJS.Timeout>();

  // Refs to avoid stale closures in timer
  const selectedAnswersRef = useRef(selectedAnswers);
  const flaggedQuestionsRef = useRef(flaggedQuestions);
  const onFinishRef = useRef(onFinish);
  const finishedRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);
  useEffect(() => { flaggedQuestionsRef.current = flaggedQuestions; }, [flaggedQuestions]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Report state changes to parent for auto-save
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => {
    onStateChangeRef.current?.({
      current,
      selectedAnswers,
      timeLeft,
      flaggedQuestions: Array.from(flaggedQuestions),
      revealedQuestions: Array.from(revealedQuestions),
    });
  }, [current, selectedAnswers, timeLeft, flaggedQuestions, revealedQuestions]);

  const isStudyMode = mode === "estudo";

  // Timer - only in prova mode
  useEffect(() => {
    if (isStudyMode || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinishRef.current(selectedAnswersRef.current, Array.from(flaggedQuestionsRef.current));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isStudyMode]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const selectAnswer = (questionIdx: number, optionIdx: number) => {
    if (isStudyMode && revealedQuestions.has(questionIdx)) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIdx]: optionIdx }));
    if (isStudyMode) {
      setRevealedQuestions(prev => new Set(prev).add(questionIdx));
    }
  };

  const toggleFlag = (idx: number) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    onFinishRef.current(selectedAnswersRef.current, Array.from(flaggedQuestionsRef.current));
  }, []);

  const handleStudyWithTutor = (q: SimQuestion) => {
    navigate("/dashboard/mentor", {
      state: {
        initialMessage: `Errei uma questão sobre "${q.topic}". O enunciado era: "${q.statement.slice(0, 200)}". A resposta correta era "${q.options[q.correct]}". Me explique este tema em detalhes seguindo o protocolo ENAZIZI.`,
        fromErrorBank: true,
      },
    });
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;
  const timeWarning = !isStudyMode && timeLeft < 300;
  const q = questions[current];

  const correctCount = isStudyMode
    ? Object.entries(selectedAnswers).filter(([i]) => selectedAnswers[Number(i)] === questions[Number(i)]?.correct).length
    : 0;
  const wrongCount = isStudyMode ? answeredCount - correctCount : 0;

  if (!q) return null;

  const isRevealed = isStudyMode && revealedQuestions.has(current);
  const userAnswer = selectedAnswers[current];

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto pb-12">
      {/* Header — Cockpit Look */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-xl py-3 px-1 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
            {current + 1}
          </div>
          <span className="text-[13px] font-black uppercase tracking-tight text-muted-foreground/80">Questão {current + 1} de {questions.length}</span>
        </div>
        
        {isStudyMode ? (
          <div className="flex items-center gap-4 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            <div className="flex items-center gap-1.5 text-green-500 font-black text-xs uppercase tracking-tight">
              <CheckCircle2 className="h-4 w-4" />
              <span>{correctCount} ACERTOS</span>
            </div>
            <div className="flex items-center gap-1.5 text-destructive font-black text-xs uppercase tracking-tight">
              <XCircle className="h-4 w-4" />
              <span>{wrongCount} ERROS</span>
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 font-mono font-black text-sm ${timeWarning ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
            <Clock className="h-4 w-4" /> 
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Progress — Slim & Cinematic */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500 ease-out shadow-glow-sm" 
          style={{ width: `${(answeredCount / questions.length) * 100}%` }} 
        />
      </div>

      {/* Question Card — Cockpit 2.0 */}
      <div className="rounded-3xl border-0 bg-card/40 backdrop-blur-md p-6 sm:p-8 shadow-sm relative overflow-hidden group" data-testid="question-card">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-black text-[10px] uppercase tracking-widest px-2.5 h-6 rounded-lg">
              {String(q.topic || "").replace(/\s*\(.*$/, "").trim() || q.topic}
            </Badge>
            {!isRevealed && userAnswer === undefined && (
              <Badge variant="outline" className="bg-amber-500/5 border-amber-500/20 text-amber-600 font-black text-[10px] uppercase tracking-widest px-2.5 h-6 rounded-lg">
                PENDENTE
              </Badge>
            )}
          </div>
          <button
            onClick={() => toggleFlag(current)}
            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${flaggedQuestions.has(current) ? "text-yellow-500 bg-yellow-500/15 ring-1 ring-yellow-500/30" : "text-muted-foreground hover:bg-white/5"}`}
            title="Marcar para revisão"
          >
            <Bookmark className={`h-5 w-5 ${flaggedQuestions.has(current) ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Imagem médica se disponível (ignora placeholders) */}
        {q.image_url && q._questionMode !== "text_only" && isImageUrlClinical(q.image_url) && (
          <div className="relative mb-8 rounded-2xl overflow-hidden border border-white/10 shadow-lg group/img">
            <ImageQuestionViewer
              imageUrl={q.image_url}
              imageType={q.image_type}
              altText={`Imagem clínica - ${q.topic}`}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <p className="text-white text-[11px] font-black uppercase tracking-widest">Visualização Clínica Expandida</p>
            </div>
          </div>
        )}

        <div className="relative">
          <p className="text-[17px] sm:text-[19px] font-bold leading-relaxed text-foreground/90 mb-8 selection:bg-primary selection:text-primary-foreground">
            {q.statement}
          </p>
          
          <div className="space-y-3.5">
            {q.options.map((opt, i) => {
              let optionClass = "border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary/30";
              let labelClass = "bg-white/10 text-muted-foreground font-black";
              
              if (isRevealed) {
                if (i === q.correct) {
                  optionClass = "border-green-500/40 bg-green-500/10 ring-1 ring-green-500/20";
                  labelClass = "bg-green-500 text-white shadow-glow-sm";
                } else if (i === userAnswer) {
                  optionClass = "border-destructive/40 bg-destructive/10 ring-1 ring-destructive/20";
                  labelClass = "bg-destructive text-white";
                } else {
                  optionClass = "border-transparent bg-white/5 opacity-40 grayscale";
                  labelClass = "bg-white/5 text-muted-foreground/50";
                }
              } else if (userAnswer === i) {
                optionClass = "border-primary/50 bg-primary/10 ring-1 ring-primary/20 shadow-glow-sm";
                labelClass = "bg-primary text-white";
              }

              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(current, i)}
                  disabled={isRevealed}
                  className={`relative w-full text-left p-4.5 rounded-2xl border transition-all duration-300 ${optionClass} ${isRevealed ? "cursor-default" : "active:scale-[0.99]"}`}
                  data-testid="answer-option"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 text-xs transition-colors duration-300 ${labelClass}`}>
                      {isRevealed && i === q.correct ? <CheckCircle2 className="h-4 w-4" /> : 
                       isRevealed && i === userAnswer ? <XCircle className="h-4 w-4" /> : 
                       String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-[15px] font-medium leading-normal pt-0.5">
                      {opt.replace(/^[A-Da-d]\)\s*/, '')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Study mode: explanation after answer */}
        {isRevealed && (
          <div className="mt-8 pt-8 border-t border-white/5 space-y-4 animate-fade-in relative">
            <div aria-hidden className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            {q.explanation && (
              <div className="p-5 rounded-2xl bg-primary/[0.03] border border-primary/10 shadow-inner">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <p className="text-[12px] font-black uppercase tracking-widest text-primary">Análise Pedagógica</p>
                </div>
                <div className="text-[14px] leading-relaxed text-muted-foreground font-medium selection:bg-primary/20">
                  <ReactMarkdown>{q.explanation}</ReactMarkdown>
                </div>
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full gap-2.5 text-[12px] font-black uppercase tracking-tight h-12 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 transition-all shadow-sm" 
              onClick={() => handleStudyWithTutor(q)}
            >
              <GraduationCap className="h-5 w-5" /> Aprofundar com Tutor Mentor
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          disabled={current === 0} 
          onClick={() => setCurrent(c => c - 1)} 
          className="flex-1 h-12 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[11px]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
        </Button>
        {current < questions.length - 1 ? (
          <Button 
            onClick={() => setCurrent(c => c + 1)} 
            className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-glow-sm"
            data-testid="next-question-button"
          >
            Próxima <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={() => unansweredCount > 0 ? setShowConfirmFinish(true) : handleFinish()} 
            variant="default" 
            className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-glow-sm"
            data-testid="finish-simulado-button"
          >
            <Flag className="h-4 w-4 mr-2" /> Finalizar
          </Button>
        )}
      </div>

      {/* Confirm finish dialog */}
      {showConfirmFinish && (
        <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm font-medium mb-2">⚠️ Você tem {unansweredCount} questões não respondidas.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleFinish}>Finalizar mesmo assim</Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmFinish(false)}>Voltar ao simulado</Button>
          </div>
        </div>
      )}

      {/* Question grid */}
      <div className="glass-card p-3">
        <div className="flex flex-wrap gap-1">
          {questions.map((_, i) => {
            const isFlagged = flaggedQuestions.has(i);
            const isAnswered = selectedAnswers[i] !== undefined;
            const isCurrent = i === current;

            let bgClass = "bg-secondary text-muted-foreground";
            if (isCurrent) bgClass = "bg-primary text-primary-foreground";
            else if (isStudyMode && revealedQuestions.has(i)) {
              bgClass = selectedAnswers[i] === questions[i]?.correct
                ? "bg-green-500/20 text-green-700"
                : "bg-destructive/20 text-destructive";
            } else if (isAnswered) bgClass = "bg-primary/20 text-primary";

            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-7 w-7 rounded text-xs font-medium transition-all relative ${bgClass}`}
              >
                {i + 1}
                {isFlagged && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-500" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" /> Marcada</span>
          {isStudyMode && (
            <>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Correta</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Errada</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimuladoExam;
