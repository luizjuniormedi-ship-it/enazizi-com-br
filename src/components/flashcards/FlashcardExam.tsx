import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ArrowRight, ArrowLeft, Bookmark, GraduationCap,
  CheckCircle2, XCircle, RotateCcw, Send, Eye, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rating } from "@/hooks/useFsrs";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

export interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  topic: string | null;
  is_global?: boolean;
  user_id?: string;
}

export type FlashcardReviewStatus = "pending" | "correct" | "wrong";

interface FlashcardExamProps {
  cards: FlashcardItem[];
  mode: "due" | "all" | "sprint";
  sprintTimeLeft?: number;
  onReview: (cardId: string, rating: Rating, userAnswer: string) => void;
  onFinish: (stats: { correct: number; wrong: number; skipped: number }) => void;
  onDelete?: (cardId: string) => void;
  userId?: string;
}

import { cn } from "@/lib/utils";

const FlashcardExam = ({
  cards, mode, sprintTimeLeft: externalTimeLeft,
  onReview, onFinish, onDelete, userId,
}: FlashcardExamProps) => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Map<number, FlashcardReviewStatus>>(new Map());
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stats = {
    correct: Array.from(statuses.values()).filter(s => s === "correct").length,
    wrong: Array.from(statuses.values()).filter(s => s === "wrong").length,
    skipped: 0,
  };
  const reviewedCount = statuses.size;
  const card = cards[current];

  // Focus input when navigating
  useEffect(() => {
    if (!flipped) inputRef.current?.focus();
  }, [current, flipped]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const isAnswerCorrect = useCallback(() => {
    if (!card || !userAnswer.trim()) return false;
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "").trim();
    const userNorm = normalize(userAnswer);
    const answerNorm = normalize(card.answer);
    const answerWords = answerNorm.split(/\s+/).filter(w => w.length > 3);
    if (answerWords.length === 0) return userNorm === answerNorm;
    const matchCount = answerWords.filter(w => userNorm.includes(w)).length;
    return matchCount / answerWords.length >= 0.4;
  }, [card, userAnswer]);

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) return;
    setAnswerSubmitted(true);
    setFlipped(true);
  };

  const handleReview = (quality: "again" | "good" | "easy") => {
    if (!card) return;
    const ratingMap: Record<string, Rating> = {
      again: Rating.Again, good: Rating.Good, easy: Rating.Easy,
    };
    const isCorrect = quality !== "again";
    setStatuses(prev => new Map(prev).set(current, isCorrect ? "correct" : "wrong"));
    onReview(card.id, ratingMap[quality], userAnswer);
    import("@/lib/haptics").then(h => isCorrect ? h.hapticSuccess() : h.hapticError());

    // Rastreamento pedagógico para automação ENAFLIX
    if (userId) {
      import("@/lib/educationalEngine").then(({ trackStudyActivity }) => {
        trackStudyActivity({
          userId,
          topic: card.topic || "Geral",
          fsrsCount: 1,
          errorsCount: isCorrect ? 0 : 1,
          studyTimeSeconds: 45, // Estimativa por flashcard
        });
      });
    }

    // Auto-advance
    if (current < cards.length - 1) {
      setCurrent(c => c + 1);
    }
    setFlipped(false);
    setUserAnswer("");
    setAnswerSubmitted(false);
  };

  const handleFinish = useCallback(() => {
    const skipped = cards.length - statuses.size;
    onFinish({
      correct: Array.from(statuses.values()).filter(s => s === "correct").length,
      wrong: Array.from(statuses.values()).filter(s => s === "wrong").length,
      skipped,
    });
  }, [cards.length, statuses, onFinish]);

  const toggleFlag = (idx: number) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const navigateTo = (idx: number) => {
    setCurrent(idx);
    setFlipped(false);
    setUserAnswer("");
    setAnswerSubmitted(false);
  };

  // Swipe gestures for mobile navigation
  const swipeHandlers = useMemo(() => ({
    onSwipeLeft: () => {
      if (current < cards.length - 1) navigateTo(current + 1);
    },
    onSwipeRight: () => {
      if (current > 0) navigateTo(current - 1);
    },
    onSwipeUp: () => {
      if (!flipped) {
        setFlipped(true);
      }
    },
  }), [current, cards.length, flipped]);

  const { onTouchStart, onTouchEnd } = useSwipeGesture(swipeHandlers);

  if (!card) return null;

  const unreviewedCount = cards.length - reviewedCount;
  const timeWarning = mode === "sprint" && (externalTimeLeft ?? 999) < 30;

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Header sticky */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur py-2">
        <span className="text-sm font-medium">{current + 1}/{cards.length}</span>
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="text-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />{stats.correct}
          </span>
          <span className="text-destructive flex items-center gap-1">
            <XCircle className="h-4 w-4" />{stats.wrong}
          </span>
        </div>
        {mode === "sprint" && externalTimeLeft !== undefined && (
          <span className={`flex items-center gap-1 text-sm font-mono font-bold ${timeWarning ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
            <Clock className="h-4 w-4" /> {formatTime(externalTimeLeft)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{reviewedCount}/{cards.length} revisados</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(reviewedCount / cards.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="perspective-1000 min-h-[400px] flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={`${current}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full h-full cursor-pointer"
            onClick={() => !answerSubmitted && setFlipped(!flipped)}
          >
            {!flipped ? (
              <div className="glass-card-pixar p-8 min-h-[350px] flex flex-col justify-center shadow-pixar border-primary/20 bg-card-pixar/40">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">
                    {card.topic || "Geral"}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFlag(current); }}
                    className={cn("p-2 rounded-xl transition-all", flagged.has(current) ? "text-yellow-500 bg-yellow-500/10 shadow-glow-yellow" : "text-white/40 hover:text-yellow-500")}
                  >
                    <Bookmark className={cn("h-6 w-6", flagged.has(current) && "fill-current")} />
                  </button>
                </div>
                <div className="text-xs uppercase tracking-widest text-primary/60 mb-4 font-black text-center">Pergunta</div>
                <p className="text-xl sm:text-2xl font-bold text-white text-center leading-tight">{card.question}</p>
                <div className="mt-12 flex justify-center">
                  <span className="text-xs text-white/30 font-medium flex items-center gap-2 animate-pulse">
                    <RotateCcw className="h-3 w-3" /> Toque para revelar resposta
                  </span>
                </div>
              </div>
            ) : (
              <div className="glass-card-pixar p-8 min-h-[350px] flex flex-col justify-center shadow-pixar-violet border-violet-500/20 bg-card-pixar-violet/40">
                <div className="text-xs uppercase tracking-widest text-violet-400 mb-6 font-black text-center">Resposta</div>
                {answerSubmitted && (
                  <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className={cn("text-lg font-bold flex items-center justify-center gap-2", isAnswerCorrect() ? "text-green-400" : "text-red-400")}>
                      {isAnswerCorrect() ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      Sua resposta: {userAnswer}
                    </span>
                  </div>
                )}
                <p className="text-xl sm:text-2xl font-bold text-white text-center leading-relaxed italic">
                  {card.answer}
                </p>
                <div className="mt-8 flex justify-center">
                  <span className="text-xs text-white/30 font-medium">Auto-avaliação abaixo</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Input / FSRS buttons */}
      {!flipped ? (
        <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
          <Button variant="outline" size="icon" onClick={() => navigateTo(Math.max(0, current - 1))} disabled={current === 0}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmitAnswer(); }} className="flex-1 flex gap-2">
            <Input
              ref={inputRef}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Digite sua resposta..."
              className="flex-1"
            />
            <Button type="submit" disabled={!userAnswer.trim()}>
              <Send className="h-4 w-4 mr-2" /> Responder
            </Button>
          </form>
          <Button variant="ghost" size="sm" onClick={() => { setFlipped(true); setAnswerSubmitted(false); }} className="text-muted-foreground text-xs">
            <Eye className="h-4 w-4 mr-1" /> Ver
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateTo(Math.min(cards.length - 1, current + 1))} disabled={current === cards.length - 1}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="destructive" onClick={() => handleReview("again")} className="min-w-[100px]">
            <RotateCcw className="h-4 w-4 mr-2" /> Errei
          </Button>
          <Button variant="outline" onClick={() => handleReview("good")} className="min-w-[100px]">
            Bom
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]" onClick={() => handleReview("easy")}>
            Fácil
          </Button>
          {onDelete && card.user_id === userId && (
            <Button variant="ghost" size="sm" title="Remover" onClick={() => onDelete(card.id)}>
              <XCircle className="h-4 w-4" />
            </Button>
          )}
          {answerSubmitted && !isAnswerCorrect() && card.topic && (
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => navigate("/dashboard/mentor", {
                state: {
                  initialMessage: `Errei um flashcard sobre "${card.topic}". A pergunta era: "${card.question}". A resposta correta era: "${card.answer}". Me explique este tema seguindo o protocolo ENAZIZI.`,
                  fromErrorBank: true,
                },
              })}
            >
              <GraduationCap className="h-3.5 w-3.5" /> Aprofundar no Tutor IA
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => navigateTo(current - 1)} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {current < cards.length - 1 ? (
          <Button onClick={() => navigateTo(current + 1)} className="flex-1">
            Próxima <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => unreviewedCount > 0 ? setShowConfirmFinish(true) : handleFinish()}
            variant="default" className="flex-1"
          >
            <Flag className="h-4 w-4 mr-1" /> Finalizar
          </Button>
        )}
      </div>

      {/* Confirm finish */}
      {showConfirmFinish && (
        <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm font-medium mb-2">⚠️ Você tem {unreviewedCount} flashcards não revisados.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleFinish}>Finalizar mesmo assim</Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirmFinish(false)}>Voltar</Button>
          </div>
        </div>
      )}

      {/* Question grid */}
      <div className="glass-card p-3">
        <div className="flex flex-wrap gap-1">
          {cards.map((_, i) => {
            const isFlagged = flagged.has(i);
            const status = statuses.get(i);
            const isCurrent = i === current;

            let bgClass = "bg-secondary text-muted-foreground";
            if (isCurrent) bgClass = "bg-primary text-primary-foreground";
            else if (status === "correct") bgClass = "bg-green-500/20 text-green-700";
            else if (status === "wrong") bgClass = "bg-destructive/20 text-destructive";

            return (
              <button
                key={i}
                onClick={() => navigateTo(i)}
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
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Acertou</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Errou</span>
        </div>
      </div>
    </div>
  );
};

export default FlashcardExam;
