import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { useQueryClient } from "@tanstack/react-query";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { isMedicalContent } from "@/lib/medicalValidation";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { updateDomainMap } from "@/lib/updateDomainMap";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useFsrs, Rating } from "@/hooks/useFsrs";
import {
  FlipVertical, Loader2, Brain, GraduationCap,
  Download, Zap, Clock, Award, Maximize2, Minimize2,
  MoreVertical, HelpCircle, ArrowLeft, Search, DatabaseZap, Sparkles, ChevronLeft,
  LayoutGrid
} from "lucide-react";
import { CinematicHero } from "@/components/cinematic";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import ModuleEmptyState from "@/components/layout/ModuleEmptyState";
import { exportToPdf } from "@/lib/exportPdf";
import { useNavigate } from "react-router-dom";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { createPortal } from "react-dom";
import FlashcardExam, { type FlashcardItem } from "@/components/flashcards/FlashcardExam";

import { EnaflixActionCard } from "@/components/enaflix/EnaflixActionCard";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixSection } from "@/components/enaflix/EnaflixSection";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

type Phase = "setup" | "active" | "finished";

interface FsrsReviewState {
  due: string;
  stability: number;
  state: number;
}

const Flashcards = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshUserState();
  const studyCtx = useStudyContext();
  const [allCards, setAllCards] = useState<FlashcardItem[]>([]);
  const [dueCards, setDueCards] = useState<FlashcardItem[]>([]);
  const [fsrsStates, setFsrsStates] = useState<Map<string, FsrsReviewState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<"due" | "all" | "sprint">(studyCtx?.topic ? "all" : "due");
  const [topicSearch, setTopicSearch] = useState(studyCtx?.topic || "");

  const [generateQuantity, setGenerateQuantity] = useState(10);
  const [generatingFromBank, setGeneratingFromBank] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { addXp } = useGamification();

  // Sprint
  const [sprintConfig] = useState({ cardCount: 10, timeMinutes: 5 });
  const [sprintTimeLeft, setSprintTimeLeft] = useState(0);
  const sprintTimerRef = useRef<NodeJS.Timeout>();

  // Session result
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, skipped: 0 });

  // Telemetry: module opened (Fase A baseline)
  useEffect(() => { telemetry.track('flashcard_opened'); }, []);

  const {
    pendingSession, checked: sessionChecked, saveSession: persistSession,
    completeSession, abandonSession, registerAutoSave, clearPending,
  } = useSessionPersistence({ moduleKey: "flashcards" });

  useEffect(() => {
    registerAutoSave(() => {
      if (allCards.length === 0) return {};
      return { mode, topicSearch, phase };
    });
  }, [registerAutoSave, mode, topicSearch, allCards.length, phase]);

  const handleRestoreSession = () => {
    if (!pendingSession) return;
    const data = pendingSession.session_data as any;
    if (data.mode) setMode(data.mode);
    if (data.topicSearch) setTopicSearch(data.topicSearch);
    clearPending();
  };

  const { review: fsrsReview, getDueCards: getFsrsDue } = useFsrs();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ownRes, globalRes, fsrsRes] = await Promise.all([
        supabase.from("flashcards").select("id, question, answer, topic, is_global, user_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("flashcards").select("id, question, answer, topic, is_global, user_id").eq("is_global", true).neq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
        supabase.from("fsrs_cards").select("card_ref_id, due, stability, state").eq("user_id", user.id).eq("card_type", "flashcard"),
      ]);

      if (ownRes.error) throw ownRes.error;
      if (globalRes.error) throw globalRes.error;
      if (fsrsRes.error) throw fsrsRes.error;

      const ownCards = ownRes.data || [];
      const globalCards = globalRes.data || [];
      const ownIds = new Set(ownCards.map(c => c.id));
      const merged = [...ownCards, ...globalCards.filter(c => !ownIds.has(c.id))]
        .filter(c => isMedicalContent(`${c.question} ${c.answer}`));
      setAllCards(merged);

      const stateMap = new Map<string, FsrsReviewState>();
      (fsrsRes.data || []).forEach((r: any) => stateMap.set(r.card_ref_id, { due: r.due, stability: r.stability, state: r.state }));
      setFsrsStates(stateMap);

      const now = new Date().toISOString();
      const due = merged.filter((c) => {
        const fsrs = stateMap.get(c.id);
        return !fsrs || fsrs.due <= now;
      });
      setDueCards(due);
    } catch (err) {
      console.error("Erro ao carregar flashcards:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os flashcards. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCards = useMemo(() => {
    const base = mode === "due" ? dueCards : allCards;
    const search = topicSearch.trim().toLowerCase();
    let result = search
      ? base.filter(c => c.topic?.toLowerCase().includes(search) || c.question?.toLowerCase().includes(search))
      : base;
    if (mode === "sprint") result = result.slice(0, sprintConfig.cardCount);
    return result;
  }, [mode, dueCards, allCards, topicSearch, sprintConfig.cardCount]);

  const handleGenerateFromBank = async (autoStart = true) => {
    if (!user) return;
    const search = topicSearch.trim();
    if (!search) {
      toast({ title: "Digite um tema", description: "Informe o tema para buscar questões no banco.", variant: "destructive" });
      return;
    }
    setGeneratingFromBank(true);
    try {
      const { data: existing } = await supabase
        .from("flashcards")
        .select("question")
        .eq("user_id", user.id);
      const existingHashes = new Set((existing || []).map(f => f.question?.slice(0, 80).toLowerCase()));

      const limit = Math.min(generateQuantity + 15, 60);
      const [{ data: bankQ }, { data: realQ }] = await Promise.all([
        supabase
          .from("questions_bank")
          .select("statement, explanation, options, correct_index, topic")
          .or(`topic.ilike.%${search}%,statement.ilike.%${search}%`)
          .eq("is_global", true)
          .limit(limit),
        supabase
          .from("real_exam_questions")
          .select("statement, explanation, options, correct_index, topic")
          .or(`topic.ilike.%${search}%,statement.ilike.%${search}%`)
          .eq("is_active", true)
          .limit(limit),
      ]);

      const allQuestions = [...(bankQ || []), ...(realQ || [])];
      const newCards: { user_id: string; question: string; answer: string; topic: string }[] = [];
      for (const q of allQuestions) {
        if (newCards.length >= generateQuantity) break;
        const hash = q.statement?.slice(0, 80).toLowerCase();
        if (!hash || existingHashes.has(hash)) continue;
        existingHashes.add(hash);

        const opts = Array.isArray(q.options) ? q.options as string[] : [];
        const correctOpt = q.correct_index != null && opts[q.correct_index]
          ? `✅ ${opts[q.correct_index]}`
          : "";
        const answer = [correctOpt, q.explanation ? `\n\n🧠 ${q.explanation}` : ""].join("").trim();
        if (!answer) continue;

        newCards.push({
          user_id: user.id,
          question: q.statement,
          answer,
          topic: q.topic || search,
        });
      }

      if (newCards.length === 0) {
        toast({ title: "Nenhuma questão encontrada", description: `Não encontramos questões novas para "${search}".` });
        setGeneratingFromBank(false);
        return;
      }

      const { error, data: inserted } = await supabase.from("flashcards").insert(newCards).select("id, question, answer, topic, is_global, user_id");
      if (error) throw error;

      toast({ title: `${newCards.length} flashcards gerados!`, description: `Prontos para revisão de "${search}".` });
      await fetchData();

      if (autoStart && inserted && inserted.length > 0) {
        // Auto-start session with the newly generated cards
        setMode("all");
        setSessionStats({ correct: 0, wrong: 0, skipped: 0 });
        setPhase("active");
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingFromBank(false);
    }
  };

  // Sprint timer
  useEffect(() => {
    if (phase !== "active" || mode !== "sprint" || sprintTimeLeft <= 0) return;
    sprintTimerRef.current = setInterval(() => {
      setSprintTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(sprintTimerRef.current);
          setPhase("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(sprintTimerRef.current);
  }, [phase, mode, sprintTimeLeft > 0]);

  const handleStartSession = (selectedMode: "due" | "all" | "sprint") => {
    setMode(selectedMode);
    if (selectedMode === "sprint") {
      setSprintTimeLeft(sprintConfig.timeMinutes * 60);
    }
    setSessionStats({ correct: 0, wrong: 0, skipped: 0 });
    setPhase("active");
  };

  const handleReview = async (cardId: string, rating: Rating, userAnswer: string) => {
    if (!user) return;
    const card = allCards.find(c => c.id === cardId);
    if (!card) return;

    try {
      const updatedCard = await fsrsReview("flashcard", cardId, rating);
      const scheduledDays = Math.round(updatedCard.scheduled_days);
      const isCorrect = rating !== Rating.Again;

      await addXp(isCorrect ? XP_REWARDS.question_correct : XP_REWARDS.question_answered);
      if (card.topic) {
        await updateDomainMap(user.id, [{ topic: card.topic, correct: isCorrect }]);
      }
      if (rating === Rating.Again && card.topic) {
        await logErrorToBank({
          userId: user.id,
          tema: card.topic || "Flashcard",
          tipoQuestao: "flashcard",
          conteudo: card.question,
          motivoErro: `Resposta do aluno: "${userAnswer}" — Resposta correta: "${card.answer}"`,
          categoriaErro: "conceito",
        });
      }

      const labels: Record<string, string> = {
        [Rating.Again]: "Revisar em breve",
        [Rating.Good]: scheduledDays > 0 ? `Próxima em ${scheduledDays} dias` : "Revisar em breve",
        [Rating.Easy]: scheduledDays > 0 ? `Próxima em ${scheduledDays} dias` : "Revisar em breve",
      };
      toast({ title: labels[rating] || "Revisado" });

      // Emit ALOS Event (non-blocking)
      void pedagogicalEventBus.emit({
        event_type: 'fsrs_review_completed',
        module: 'fsrs',
        source: 'frontend',
        entity_type: 'flashcard',
        entity_id: cardId,
        study_context: {
          topic: card.topic || "Geral",
        },
        metadata: {
          rating,
          scheduled_days: scheduledDays,
          is_correct: isCorrect
        }
      }, user.id);
    } catch (err) {
      console.error("Review error:", err);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a revisão.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (cardId: string) => {
    try {
      const { error } = await supabase.from("flashcards").delete().eq("id", cardId);
      if (error) throw error;
      setAllCards(prev => prev.filter(c => c.id !== cardId));
      setDueCards(prev => prev.filter(c => c.id !== cardId));
      toast({ title: "Flashcard removido" });
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        title: "Erro",
        description: "Não foi possível remover o flashcard.",
        variant: "destructive",
      });
    }
  };

  const handleFinish = (stats: { correct: number; wrong: number; skipped: number }) => {
    clearInterval(sprintTimerRef.current);
    setSessionStats(stats);
    telemetry.track('flashcard_completed', { ...stats, mode });
    if (user?.id) {
      completeStudyAction({
        userId: user.id,
        taskType: "flashcard",
        topic: topicSearch || "Flashcards",
        source: "auto",
        originModule: "flashcards",
      });
    }
    refresh("review");
    setPhase("finished");
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  // ── Empty state ──
  if (allCards.length === 0) {
    return (
    <div className="pb-24 pt-8 space-y-12 relative min-h-screen">
      <EnaflixBackgroundFX intensity="medium" />
      <div className="px-4 sm:px-8 lg:px-14">
        <EnaflixSectionTitle
          kicker="Revisão Inteligente"
          title="Consolidação Cognitiva"
          subtitle="Fortaleça sua memória de longo prazo com repetição espaçada."
        />
      </div>

        <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          <EnaflixActionCard
            title="Gerar Flashcards"
            description="Use a IA para criar novos cards a partir de temas médicos."
            icon={Sparkles}
            variant="primary"
            onClick={() => handleGenerateFromBank(true)}
          />
          <EnaflixActionCard
            title="Importar Conteúdo"
            description="Adicione seus próprios materiais em PDF ou texto."
            icon={DatabaseZap}
            onClick={() => navigate("/dashboard/uploads")}
          />
          <EnaflixActionCard
            title="Simulados"
            description="Pratique com questões reais de residência."
            icon={LayoutGrid}
            onClick={() => navigate("/dashboard/simulados")}
          />
        </div>
      </div>
    );
  }

  const reviewedCount = allCards.length - dueCards.length;

  // ── PHASE: Finished ──
  if (phase === "finished") {
    const total = sessionStats.correct + sessionStats.wrong;
    const rate = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;

    return (
      <div className="max-w-xl mx-auto space-y-8 animate-fade-in relative min-h-screen pt-12">
        <EnaflixBackgroundFX intensity="medium" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-pixar p-12 text-center space-y-8 shadow-pixar border-primary/30"
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <Award className="h-20 w-20 text-primary mx-auto relative drop-shadow-[0_0_15px_rgba(var(--pixar-blue),0.8)]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">
              {mode === "sprint" ? "Sprint Imbatível!" : "Sessão Concluída!"}
            </h2>
            <p className="text-white/60 font-medium">Sua memória muscular médica acaba de ser fortalecida.</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 shadow-glow-green">
              <div className="text-3xl font-black text-green-400">{sessionStats.correct}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-green-500/60 mt-1">Acertos</div>
            </div>
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-glow-red">
              <div className="text-3xl font-black text-red-400">{sessionStats.wrong}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-red-500/60 mt-1">Erros</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-3xl font-black text-white/40">{sessionStats.skipped}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-white/20 mt-1">Pulados</div>
            </div>
          </div>

          {total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-tighter text-white/40">
                <span>Taxa de Retenção</span>
                <span className="text-primary">{rate}%</span>
              </div>
              <Progress value={rate} className="h-3 bg-white/5" />
            </div>
          )}
        </motion.div>

        <TaskCompletionCard
          title="Consolidação Completa"
          secondaryLabel="Nova Jornada"
          onSecondary={() => setPhase("setup")}
        />
      </div>
    );
  }

  // ── PHASE: Active ──
  if (phase === "active") {
    if (filteredCards.length === 0) {
      return (
        <div className="max-w-xl mx-auto glass-card p-12 text-center animate-fade-in">
          <p className="text-lg font-medium mb-2">Nenhum flashcard disponível</p>
          <p className="text-sm text-muted-foreground mb-4">Selecione outros temas ou modo.</p>
          <Button onClick={() => setPhase("setup")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      );
    }

    const content = (
      <div className={isFullscreen ? "fixed inset-0 z-[100] bg-background p-2 sm:p-4 overflow-auto" : ""}>
        <div className="flex justify-end mb-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => setPhase("setup")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Sair
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
        <FlashcardExam
          cards={filteredCards}
          mode={mode}
          sprintTimeLeft={mode === "sprint" ? sprintTimeLeft : undefined}
          onReview={handleReview}
          onFinish={handleFinish}
          onDelete={handleDelete}
          userId={user?.id}
        />
      </div>
    );

    if (isFullscreen) return createPortal(content, document.body);
    return content;
  }

  // ── PHASE: Setup ──
  return (
    <div className="pb-24 pt-8 space-y-12 relative min-h-screen">
      <EnaflixBackgroundFX intensity="medium" />
      <div className="px-4 sm:px-8 lg:px-14">
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className="gap-2 text-white/40 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
        
        <EnaflixSectionTitle
          kicker="REVISÃO INTELIGENTE"
          title={
            <>
              Consolidação <span className="gradient-text">Cognitiva</span>
            </>
          }
          subtitle="Foco total na retenção de longo prazo com algoritmos de repetição espaçada (FSRS)."
        />
      </div>

      {pendingSession && (
        <div className="px-4 sm:px-8 lg:px-14">
          <ResumeSessionBanner
            updatedAt={pendingSession.updated_at}
            onResume={handleRestoreSession}
            onDiscard={abandonSession}
          />
        </div>
      )}

      {/* Stats Row */}
      <EnaflixRow title="Status da sua memória">
        <div className="flex gap-4">
          {[
            { label: "Novos", count: Array.from(fsrsStates.values()).filter(s => s.state === 0).length, color: "text-blue-400" },
            { label: "Aprendendo", count: Array.from(fsrsStates.values()).filter(s => s.state === 1 || s.state === 3).length, color: "text-amber-400" },
            { label: "Revisão", count: Array.from(fsrsStates.values()).filter(s => s.state === 2).length, color: "text-emerald-400" },
            { label: "Total", count: allCards.length, color: "text-white" },
          ].map(({ label, count, color }) => (
            <div key={label} className="bg-white/5 border border-white/5 rounded-2xl p-6 min-w-[140px] text-center">
              <div className={cn("text-3xl font-black mb-1", color)}>{count}</div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </EnaflixRow>

      {/* Modes Row */}
      <EnaflixSection title="Escolha seu modo de estudo">
        <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          <EnaflixActionCard
            title="Revisão Prioritária"
            description={`${dueCards.length} cards com alto risco de esquecimento.`}
            icon={Brain}
            variant="primary"
            badge="IA Recomendou"
            onClick={() => handleStartSession("due")}
          />
          <EnaflixActionCard
            title="Modo Sprint"
            description={`${sprintConfig.cardCount} cards em ${sprintConfig.timeMinutes} minutos.`}
            icon={Zap}
            onClick={() => handleStartSession("sprint")}
          />
          <EnaflixActionCard
            title="Todos os Cards"
            description={`Revisar todo o acervo de ${allCards.length} cards.`}
            icon={GraduationCap}
            onClick={() => handleStartSession("all")}
          />
        </div>
      </EnaflixSection>

      {/* Tool Row */}
      <EnaflixSection title="Ferramentas de Produção" subtitle="Gere e filtre por tema para focar seu estudo.">
        <div className="px-4 sm:px-8 lg:px-14">
          <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-8 space-y-6 max-w-2xl">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Digite o tema (ex: Cardiologia, IAM, Pneumonia)"
                  value={topicSearch}
                  onChange={e => setTopicSearch(e.target.value)}
                  className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary focus:border-primary text-white"
                />
              </div>
              {topicSearch.trim() && (
                <Button variant="ghost" className="h-12 text-white/40 hover:text-white" onClick={() => setTopicSearch("")}>
                  Limpar
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Quantidade de flashcards</label>
              <div className="flex gap-2">
                {[5, 10, 15, 20, 30].map(q => (
                  <button
                    key={q}
                    onClick={() => setGenerateQuantity(q)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                      generateQuantity === q
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full h-14 gap-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-glow-sm"
              onClick={() => handleGenerateFromBank(true)}
              disabled={generatingFromBank || !topicSearch.trim()}
            >
              {generatingFromBank ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <DatabaseZap className="h-5 w-5" />
              )}
              Gerar {generateQuantity} Flashcards e Iniciar
            </Button>
          </div>
        </div>
      </EnaflixSection>
    </div>
  );
};

export default memo(Flashcards);
