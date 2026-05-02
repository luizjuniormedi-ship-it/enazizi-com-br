import { useState, useEffect, useMemo, useCallback } from "react";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { useDashboardInvalidation } from "@/hooks/useDashboardInvalidation";
import { isMedicalQuestion } from "@/lib/medicalValidation";
import MedicalTermHighlighter from "@/components/medical/MedicalTermHighlighter";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { updateDomainMap } from "@/lib/updateDomainMap";
import { Database, Play, Trash2, ChevronDown, ChevronUp, Search, BarChart3, Target, TrendingUp, GraduationCap, Download, HelpCircle, Zap } from "lucide-react";
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
    await supabase.from("practice_attempts").insert({
      user_id: user.id,
      question_id: practiceQuestion.id,
      correct: isCorrect,
    });

    // Award XP
    await addXp(isCorrect ? XP_REWARDS.question_correct : XP_REWARDS.question_answered);

    // Rastreamento pedagógico para automação ENAFLIX
    const { trackStudyActivity } = await import("@/lib/educationalEngine");
    trackStudyActivity({
      userId: user.id,
      topic: practiceQuestion.topic || "Geral",
      questionsCount: 1,
      errorsCount: isCorrect ? 0 : 1,
      studyTimeSeconds: 60, // Estimativa por questão
    });

    // Update medical domain map
    if (practiceQuestion.topic) {
      await updateDomainMap(user.id, [{ topic: practiceQuestion.topic, correct: isCorrect }]);
    }

    // Log wrong answer to error_bank
    if (!isCorrect) {
      await logErrorToBank({
        userId: user.id,
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
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in py-8">
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
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
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

        <div className="glass-card p-6">
          {practiceQuestion.topic && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary mb-3 inline-block">
              {practiceQuestion.topic}
            </span>
          )}
          <p className="text-base font-medium mb-6"><MedicalTermHighlighter text={practiceQuestion.statement} /></p>

          <div className="space-y-3">
            {practiceQuestion.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => !answered && setSelected(i)}
                className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${
                  answered && i === practiceQuestion.correct_index
                    ? "border-green-500 bg-green-500/10"
                    : answered && i === selected && i !== practiceQuestion.correct_index
                    ? "border-destructive bg-destructive/10"
                    : selected === i
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/50 hover:border-primary/30"
                }`}
              >
                <span className="font-semibold mr-2">
                  {practiceQuestion.options.length === 2 ? "" : `${String.fromCharCode(65 + i)}) `}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {answered && practiceQuestion.explanation && (
            <div className="mt-4 p-4 rounded-lg bg-muted text-sm">
              <p className="font-medium mb-1">Explicação:</p>
              <p className="text-muted-foreground"><MedicalTermHighlighter text={practiceQuestion.explanation} /></p>
            </div>
          )}

          <div className="flex gap-3 mt-6 flex-wrap">
            {!answered ? (
              <Button onClick={confirmAnswer} disabled={selected === null}>Confirmar</Button>
            ) : (
              <>
                <Button onClick={nextQuestion}>
                  {practiceIdx + 1 >= filtered.length ? "Finalizar" : "Próxima"}
                </Button>
                {selected !== practiceQuestion.correct_index && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("sc_source", "error-bank");
                      params.set("sc_topic", practiceQuestion.topic || "Medicina");
                      params.set("sc_objective", "correction");
                      params.set("sc_taskType", "error_review");
                      params.set("sc_reason", `Errou questão: "${practiceQuestion.options[practiceQuestion.correct_index]}"`);
                      navigate(`/dashboard/chatgpt?${params.toString()}`);
                    }}
                  >
                    <GraduationCap className="h-4 w-4" />
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
    <div className="space-y-6 animate-fade-in">
      <StudyContextBanner />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Banco de Questões
          </h1>
          <p className="text-muted-foreground">
            {filtered.length} questões disponíveis
            {totalCount > filtered.length && (
              <span className="text-xs ml-1">({totalCount} no banco total)</span>
            )}
          </p>
        </div>
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
        <div className="space-y-4">
          {/* Global stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{globalStats.total}</p>
                <p className="text-xs text-muted-foreground">Questões respondidas</p>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{globalStats.correct}</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{globalRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de acerto</p>
              </div>
            </div>
          </div>

          {/* Per-topic stats */}
          {topicStats.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Desempenho por Tópico
              </h3>
              <div className="space-y-3">
                {topicStats.map((s) => (
                  <div key={s.topic}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate mr-2">{s.topic}</span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {s.correct}/{s.total} ({s.rate}%)
                      </span>
                    </div>
                    <Progress
                      value={s.rate}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar questões..."
            className="pl-9 bg-secondary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {topics.length > 0 && (
          <Select value={topicFilter} onValueChange={(v) => { setTopicFilter(v); setSubtopicFilter("all"); }}>
            <SelectTrigger className="w-[180px] bg-secondary">
              <SelectValue placeholder="Tópico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tópicos</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {subtopics.length > 0 && (
          <Select value={subtopicFilter} onValueChange={setSubtopicFilter}>
            <SelectTrigger className="w-[180px] bg-secondary">
              <SelectValue placeholder="Subtema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os subtemas</SelectItem>
              {subtopics.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {sources.length > 0 && (
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px] bg-secondary">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fontes</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {questions.length === 0
              ? "Nenhuma questão salva. Use o Gerador de Questões para criar e salvar questões."
              : "Nenhuma questão encontrada com os filtros atuais."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <div key={q.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
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
