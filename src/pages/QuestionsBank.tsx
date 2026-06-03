import { useState, useEffect, useMemo, useCallback } from "react";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { useDashboardInvalidation } from "@/hooks/useDashboardInvalidation";
import { isMedicalQuestion } from "@/lib/medicalValidation";
import MedicalTermHighlighter from "@/components/medical/MedicalTermHighlighter";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { updateDomainMap } from "@/lib/updateDomainMap";
import { Database, Play, Trash2, ChevronDown, ChevronUp, Search, BarChart3, Target, TrendingUp, GraduationCap, Download, HelpCircle, Zap, ChevronLeft, ArrowRight, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { exportToPdf } from "@/lib/exportPdf";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { useAutoReplenish } from "@/hooks/useAutoReplenish";

interface Question {
  id: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  topic: string | null;
  subtopic: string | null;
  source: string | null;
  created_at: string;
  image_url: string | null;
}

interface TopicStat {
  topic: string;
  total: number;
  correct: number;
  rate: number;
}

function parseOptions(raw: Json | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

const PAGE_SIZE = 1000;

const QuestionsBank = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const { invalidateAll } = useDashboardInvalidation();
  const navigate = useNavigate();
  const studyCtx = useStudyContext();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [topicFilter, setTopicFilter] = useState(studyCtx?.topic || "all");
  const [subtopicFilter, setSubtopicFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Stats
  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);
  const [globalStats, setGlobalStats] = useState({ total: 0, correct: 0 });
  const [showStats, setShowStats] = useState(true);

  // Practice mode
  const [practicing, setPracticing] = useState(false);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [practiceFinished, setPracticeFinished] = useState(false);

  // Expanded explanations
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!user) return;
    // Fetch attempts joined with question topic
    const { data } = await supabase
      .from("practice_attempts")
      .select("correct, question_id, questions_bank(topic)")
      .eq("user_id", user.id);

    if (!data || data.length === 0) {
      setTopicStats([]);
      setGlobalStats({ total: 0, correct: 0 });
      return;
    }

    let totalAll = 0;
    let correctAll = 0;
    const map = new Map<string, { total: number; correct: number }>();

    for (const row of data) {
      totalAll++;
      if (row.correct) correctAll++;

      const topic = (row.questions_bank as any)?.topic || "Sem tópico";
      const entry = map.get(topic) || { total: 0, correct: 0 };
      entry.total++;
      if (row.correct) entry.correct++;
      map.set(topic, entry);
    }

    setGlobalStats({ total: totalAll, correct: correctAll });
    setTopicStats(
      Array.from(map.entries())
        .map(([topic, s]) => ({
          topic,
          total: s.total,
          correct: s.correct,
          rate: Math.round((s.correct / s.total) * 100),
        }))
        .sort((a, b) => b.total - a.total)
    );
  }, [user]);

  const fetchQuestions = useCallback(async (pageNum: number, append = false) => {
    if (!user) return;
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("questions_bank")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${user.id},is_global.eq.true`)
      .eq("review_status", "approved")
      .range(from, to);

    if (data) {
      const mapped = data.map((q) => ({
        ...q,
        options: parseOptions(q.options),
        correct_index: q.correct_index ?? 0,
      }));
      const IMAGE_REF = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir|vide imagem|conforme a imagem|conforme a figura)\b/i;
      const filtered = mapped.filter(q => {
        if (!isMedicalQuestion(q) || q.options.length < 4 || q.options.length > 5) return false;
        if (IMAGE_REF.test(q.statement) && !q.image_url) return false;
        return true;
      });
      // Sort: real exam sources first, then by date
      const prioritized = filtered.sort((a, b) => {
        const srcA = a.source === "web-scrape" || a.source === "real-exam-ai" ? 0 : a.source === "ai-exam-style" ? 1 : 2;
        const srcB = b.source === "web-scrape" || b.source === "real-exam-ai" ? 0 : b.source === "ai-exam-style" ? 1 : 2;
        if (srcA !== srcB) return srcA - srcB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setQuestions(prev => append ? [...prev, ...prioritized] : prioritized);
      setTotalCount(count ?? 0);
      setHasMore((from + data.length) < (count ?? 0));
    }
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setLoading(false);
    setLoadingMore(false);
  }, [user, toast]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchQuestions(nextPage, true);
  }, [page, fetchQuestions]);

  useEffect(() => {
    if (!user) return;
    setPage(0);
    fetchQuestions(0);
    loadStats();
  }, [user, fetchQuestions, loadStats]);

  const topics = useMemo(() => {
    const set = new Set(questions.map((q) => q.topic).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [questions]);

  const CURSINHO_KEYWORDS = ['estrategia', 'medway', 'sanar', 'medcel', 'medgrupo', 'jaleko', 'afya'];

  const sanitizeSource = (s: string | null): string | null => {
    if (!s) return s;
    if (CURSINHO_KEYWORDS.some(k => s.toLowerCase().includes(k))) return "Banco Global";
    return s;
  };

  const sources = useMemo(() => {
    const set = new Set(
      questions
        .map((q) => sanitizeSource(q.source))
        .filter((s): s is string => !!s)
    );
    return Array.from(set).sort();
  }, [questions]);

  const subtopics = useMemo(() => {
    if (topicFilter === "all") return [];
    const set = new Set(
      questions
        .filter(q => q.topic === topicFilter && q.subtopic)
        .map(q => q.subtopic as string)
    );
    return Array.from(set).sort();
  }, [questions, topicFilter]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (topicFilter !== "all" && q.topic !== topicFilter) return false;
      if (subtopicFilter !== "all" && q.subtopic !== subtopicFilter) return false;
      if (sourceFilter !== "all" && sanitizeSource(q.source) !== sourceFilter) return false;
      if (searchTerm && !q.statement.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [questions, topicFilter, subtopicFilter, sourceFilter, searchTerm]);

  const handleDelete = async (id: string) => {
    await supabase.from("questions_bank").delete().eq("id", id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    toast({ title: "Questão removida." });
  };

  // Practice mode logic
  const startPractice = () => {
    if (filtered.length === 0) return;
    setPracticing(true);
    setPracticeIdx(0);
    setSelected(null);
    setAnswered(false);
    setScore({ correct: 0, total: 0 });
  };

  const practiceQuestion = filtered[practiceIdx];

  const confirmAnswer = async () => {
    if (selected === null || !user || !practiceQuestion) return;
    const isCorrect = selected === practiceQuestion.correct_index;
    setAnswered(true);
    setScore((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));

    // Save attempt to DB
    const { error: paErr } = await supabase.from("practice_attempts").insert({
      user_id: user.id,
      question_id: practiceQuestion.id,
      correct: isCorrect,
    });
    if (paErr) {
      console.warn("[LOOP_CAPTURE_PRACTICE_ATTEMPTS_FAIL]", { source: "QuestionsBank", err: paErr.message });
    } else {
      console.log("[LOOP_CAPTURE_PRACTICE_ATTEMPTS_OK]", { source: "QuestionsBank", question_id: practiceQuestion.id, correct: isCorrect });
    }

    // Award XP
    await addXp(isCorrect ? XP_REWARDS.question_correct : XP_REWARDS.question_answered);

    // ENAZIZI ALOS Event Bus integration (non-blocking)
    void pedagogicalEventBus.emit({
      event_type: isCorrect ? 'planner_task_completed' : 'simulado_error_detected',
      module: 'simulado',
      source: 'frontend',
      severity: isCorrect ? 'info' : 'warning',
      entity_type: 'question',
      entity_id: practiceQuestion.id,
      study_context: {
        topic: practiceQuestion.topic || "Geral",
        subtopic: practiceQuestion.subtopic || undefined,
        difficulty: String(practiceQuestion.correct_index) // placeholder for question diff
      },
      metadata: {
        is_correct: isCorrect,
        selected_option: selected,
        correct_option: practiceQuestion.correct_index
      }
    }, user.id);

    // Update medical domain map
    if (practiceQuestion.topic) {
      await updateDomainMap(user.id, [{ topic: practiceQuestion.topic, correct: isCorrect }]);
    }

    // Log wrong answer to error_bank
    if (!isCorrect) {
      await logErrorToBank({
        userId: user.id,
        questionId: (practiceQuestion as any).id,
        tema: practiceQuestion.topic || "Geral",
        tipoQuestao: "objetiva",
        conteudo: practiceQuestion.statement,
        motivoErro: `Marcou "${practiceQuestion.options[selected]}" — Correta: "${practiceQuestion.options[practiceQuestion.correct_index]}"`,
        categoriaErro: "conceito",
      });
    }
  };

  const { checkAndReplenish } = useAutoReplenish(topicFilter !== "all" ? topicFilter : null);

  const nextQuestion = () => {
    if (practiceIdx + 1 >= filtered.length) {
      setPracticing(false);
      setPracticeFinished(true);
      loadStats();
      invalidateAll();
      if (practiceQuestion?.topic) checkAndReplenish(practiceQuestion.topic);
      return;
    }
    setPracticeIdx((i) => i + 1);
    setSelected(null);
    setAnswered(false);
  };

  const globalRate = globalStats.total > 0 ? Math.round((globalStats.correct / globalStats.total) * 100) : 0;

  if (practiceFinished) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in py-8 relative min-h-screen">
        <EnaflixBackgroundFX intensity="medium" />
        <TaskCompletionCard
          title="Prática finalizada!"
          subtitle={`Você acertou ${score.correct} de ${score.total} questões. Progresso atualizado.`}
          secondaryLabel="Voltar ao Banco"
          onSecondary={() => setPracticeFinished(false)}
        />
      </div>
    );
  }

  if (practicing && practiceQuestion) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl relative min-h-screen pb-12">
        <EnaflixBackgroundFX intensity="medium" />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Play className="h-6 w-6 text-primary" /> Modo Prática
          </h1>
          <Button variant="outline" size="sm" onClick={() => { setPracticing(false); loadStats(); }}>
            Voltar ao Banco
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Questão {practiceIdx + 1} de {filtered.length}</span>
          <span>Acertos: {score.correct}/{score.total}</span>
        </div>

        <div className="glass-card-pixar p-8 shadow-pixar border-primary/20 bg-card-pixar-violet/40">
          {practiceQuestion.topic && (
            <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold mb-4 inline-block">
              {practiceQuestion.topic}
            </span>
          )}
          <p className="text-xl sm:text-2xl font-bold text-white mb-8 leading-tight">
            <MedicalTermHighlighter text={practiceQuestion.statement} />
          </p>

          <div className="space-y-4">
            {practiceQuestion.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => !answered && setSelected(i)}
                className={cn(
                  "w-full text-left p-5 rounded-2xl border text-base transition-all duration-300 relative group overflow-hidden shadow-elegant",
                  answered && i === practiceQuestion.correct_index
                    ? "border-green-500 bg-green-500/20 text-green-300 shadow-glow-green"
                    : answered && i === selected && i !== practiceQuestion.correct_index
                    ? "border-red-500 bg-red-500/20 text-red-300 shadow-glow-red"
                    : selected === i
                    ? "border-primary bg-primary/20 text-white shadow-glow-primary"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center font-black text-xs transition-colors",
                    selected === i ? "bg-primary text-white" : "bg-white/10 text-white/40"
                  )}>
                    {practiceQuestion.options.length === 2 ? "" : String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                </div>
              </button>
            ))}
          </div>

          {answered && practiceQuestion.explanation && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/20 text-sm shadow-inner"
            >
              <p className="font-black text-primary mb-2 uppercase tracking-widest text-xs flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Explicação do Especialista
              </p>
              <p className="text-white/80 leading-relaxed text-base italic">
                <MedicalTermHighlighter text={practiceQuestion.explanation} />
              </p>
            </motion.div>
          )}

          <div className="flex gap-4 mt-8 flex-wrap">
            {!answered ? (
              <Button 
                onClick={confirmAnswer} 
                disabled={selected === null}
                size="lg"
                className="gap-2 px-8 py-6 rounded-2xl shadow-pixar bg-[var(--pixar-grad-primary)]"
              >
                <CheckCircle2 className="h-5 w-5" /> Confirmar Resposta
              </Button>
            ) : (
              <>
                <Button 
                  onClick={nextQuestion}
                  size="lg"
                  className="gap-2 px-8 py-6 rounded-2xl shadow-pixar"
                >
                  {practiceIdx + 1 >= filtered.length ? "Finalizar Sessão" : "Próxima Questão"}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                {selected !== practiceQuestion.correct_index && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 px-8 py-6 rounded-2xl border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("sc_source", "error-bank");
                      params.set("sc_topic", practiceQuestion.topic || "Medicina");
                      params.set("sc_objective", "correction");
                      params.set("sc_taskType", "error_review");
                      params.set("sc_reason", `Errou questão: "${practiceQuestion.options[practiceQuestion.correct_index]}"`);
                      navigate(`/dashboard/sessao-estudo?${params.toString()}`);
                    }}
                  >
                    <GraduationCap className="h-5 w-5" />
                    Estudar com Tutor IA
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

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
          kicker="Banco Global"
          title="Arena de Questões"
          subtitle={`${totalCount} questões disponíveis para o seu treinamento.`}
        />
      </div>
      <div className="px-4 sm:px-8 lg:px-14">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)} className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Estatísticas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToPdf(
              filtered.map((q, i) => ({
                title: q.statement,
                content: q.options.map((o: string, j: number) => `${String.fromCharCode(65 + j)}) ${o}${j === q.correct_index ? " ✓" : ""}`).join("\n") + (q.explanation ? `\n\nExplicação: ${q.explanation}` : ""),
                subtitle: q.topic || undefined,
              })),
              "Banco_Questoes_ENAZIZI"
            )}
            disabled={filtered.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/questoes", {
              state: { initialTopic: topicFilter !== "all" ? topicFilter : undefined },
            })}
          >
            <HelpCircle className="h-4 w-4" /> Gerar mais
          </Button>
          <Button onClick={startPractice} disabled={filtered.length === 0} className="gap-2">
            <Play className="h-4 w-4" /> Praticar ({filtered.length})
          </Button>
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && globalStats.total > 0 && (
        <div className="space-y-6">
          {/* Global stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-card-pixar p-6 flex items-center gap-4 bg-card-pixar-violet/20 border-white/5">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{globalStats.total}</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Respondidas</p>
              </div>
            </div>
            <div className="glass-card-pixar p-6 flex items-center gap-4 bg-card-pixar-violet/20 border-white/5">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center ring-1 ring-green-500/20">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{globalStats.correct}</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Acertos</p>
              </div>
            </div>
            <div className="glass-card-pixar p-6 flex items-center gap-4 bg-card-pixar-violet/20 border-white/5">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center ring-1 ring-accent/20">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{globalRate}%</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Taxa de acerto</p>
              </div>
            </div>
          </div>

          {/* Per-topic stats */}
          {topicStats.length > 0 && (
            <div className="glass-card-pixar p-8 bg-card-pixar-violet/10 border-white/5">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                Desempenho por Tópico
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {topicStats.slice(0, 10).map((s) => (
                  <div key={s.topic} className="space-y-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-white/80 truncate mr-2">{s.topic}</span>
                      <span className="text-white/40 flex-shrink-0 font-mono">
                        {s.correct}/{s.total} ({s.rate}%)
                      </span>
                    </div>
                    <Progress
                      value={s.rate}
                      className="h-1.5 bg-white/5"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            placeholder="Buscar por termo médico, enunciado ou tema..."
            className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary/20 text-white placeholder:text-white/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {topics.length > 0 && (
            <Select value={topicFilter} onValueChange={(v) => { setTopicFilter(v); setSubtopicFilter("all"); }}>
              <SelectTrigger className="w-[180px] h-12 bg-white/5 border-white/10 rounded-xl text-white">
                <SelectValue placeholder="Tópico" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a24] border-white/10">
                <SelectItem value="all">Todos os tópicos</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {subtopics.length > 0 && (
            <Select value={subtopicFilter} onValueChange={setSubtopicFilter}>
              <SelectTrigger className="w-[180px] h-12 bg-white/5 border-white/10 rounded-xl text-white">
                <SelectValue placeholder="Subtema" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a24] border-white/10">
                <SelectItem value="all">Todos os subtemas</SelectItem>
                {subtopics.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card-pixar p-16 text-center border-dashed border-white/10">
          <Database className="h-16 w-16 mx-auto text-white/10 mb-6" />
          <p className="text-white/40 font-medium">
            {questions.length === 0
              ? "Nenhuma questão salva. Use o Gerador de Questões para criar e salvar questões."
              : "Nenhuma questão encontrada com os filtros atuais."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filtered.slice(0, 50).map((q) => (
            <div key={q.id} className="glass-card-pixar p-6 group hover:bg-white/[0.04] transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">

                    {q.topic && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {q.topic}
                      </span>
                    )}
                    {q.source && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {q.source}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(q.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm font-medium line-clamp-2"><MedicalTermHighlighter text={q.statement} /></p>
                  {q.image_url && !q.image_url.startsWith("[IMG]") && (
                    <img
                      src={q.image_url}
                      alt="Imagem da questão"
                      className="mt-2 max-h-48 rounded-lg border border-border object-contain"
                      loading="lazy"
                    />
                  )}
                  {q.image_url && q.image_url.startsWith("[IMG]") && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      📷 {q.image_url.replace("[IMG] ", "")}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {q.options.map((opt, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-1 rounded border ${
                          i === q.correct_index
                            ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                            : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        {q.options.length > 2 && `${String.fromCharCode(65 + i)}) `}{opt}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  >
                    {expandedId === q.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  {(isAdmin || isProfessor) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {expandedId === q.id && q.explanation && (
                <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Explicação:</p>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
                {loadingMore ? "Carregando..." : `Carregar mais (${questions.length} de ${totalCount})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionsBank;
