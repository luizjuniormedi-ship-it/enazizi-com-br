import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CheckCircle, XCircle, RotateCcw, Trophy, ImageIcon, ZoomIn, Sparkles, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ImageQuestion = {
  id: string;
  asset_id: string | null;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  difficulty: string;
  exam_style: string | null;
  image_url: string | null;
  image_type: string | null;
  diagnosis: string | null;
  discussion: {
    definition?: string;
    physiopathology?: string;
    findings?: string;
    clinical_correlation?: string;
    differential?: string;
    management?: string;
  } | null;
  exam_tips: string[];
  pitfalls: string[];
};

const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: "Fácil", color: "bg-green-500/20 text-green-400" },
  medium: { label: "Médio", color: "bg-yellow-500/20 text-yellow-400" },
  hard: { label: "Difícil", color: "bg-red-500/20 text-red-400" },
};

const imageTypeLabels: Record<string, string> = {
  dermatology: "🩹 Dermato",
  xray: "🫁 Raio-X",
  ecg: "❤️ ECG",
};

// All known labels for display purposes (badges, etc.)
const allImageTypeLabels: Record<string, string> = {
  ecg: "❤️ ECG",
  xray: "🫁 Raio-X",
  ct: "🧠 TC",
  us: "📡 US",
  dermatology: "🩹 Dermato",
  ophthalmology: "👁️ Oftalmo",
  pathology: "🔬 Patologia",
};

// ─── Simple fetcher — no overly strict validation ──────────────────────
const SELECT_FIELDS = `
  id, asset_id, statement, option_a, option_b, option_c, option_d, option_e,
  correct_index, explanation, difficulty, exam_style,
  discussion, exam_tips, pitfalls,
  medical_image_assets!inner(
    id, image_url, image_type, diagnosis, is_active
  )
`;

function isValidImageUrl(url: string | null): boolean {
  if (!url || typeof url !== "string" || url.trim().length < 10) return false;
  return true;
}

function mapRows(data: any[]): ImageQuestion[] {
  const result = data
    .filter((q: any) => {
      if (!q.statement || q.statement.trim().length < 20) return false;
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
      if (opts.length < 3) return false;
      if (typeof q.correct_index !== "number") return false;
      return true;
    })
    .map((q: any) => {
      const asset = q.medical_image_assets;
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean);
      return {
        id: q.id,
        asset_id: q.asset_id || asset?.id || null,
        statement: q.statement,
        options: opts,
        correct_index: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        exam_style: q.exam_style,
        image_url: isValidImageUrl(asset?.image_url) ? asset.image_url : null,
        image_type: asset?.image_type || null,
        diagnosis: asset?.diagnosis || null,
        discussion: q.discussion || null,
        exam_tips: q.exam_tips || [],
        pitfalls: q.pitfalls || [],
      } as ImageQuestion;
    });

  // DEDUP: max 3 questions per unique image_url
  const imageCount = new Map<string, number>();
  return result.filter((q) => {
    if (!q.image_url) return true; // keep text-only questions
    const count = imageCount.get(q.image_url) || 0;
    if (count >= 3) return false;
    imageCount.set(q.image_url, count + 1);
    return true;
  });
}

async function fetchQuestions(
  imageType: string,
  difficulty: string,
): Promise<ImageQuestion[]> {
  let query = supabase
    .from("medical_image_questions")
    .select(SELECT_FIELDS)
    .eq("status", "published")
    .eq("medical_image_assets.is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (imageType !== "all") {
    query = query.eq("medical_image_assets.image_type", imageType as any);
  }
  if (difficulty !== "all") {
    query = query.eq("difficulty", difficulty as any);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapRows(data || []);
}

const MedicalImageQuiz = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { pendingSession, checked, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "image-quiz" });

  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  const adaptiveImageType = searchParams.get("imageType") || searchParams.get("type") || null;
  const adaptiveDifficulty = searchParams.get("difficulty") || null;

  const [imageType, setImageType] = useState<string>(adaptiveImageType || "all");
  const [difficulty, setDifficulty] = useState<string>(adaptiveDifficulty || "all");
  const [quizSize, setQuizSize] = useState<number>(10);
  const [diagnosisFilter, setDiagnosisFilter] = useState<string>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [quizMode, setQuizMode] = useState<"browse" | "quiz">("browse");
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch questions
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["image-quiz-questions", imageType, difficulty, diagnosisFilter, quizSize],
    queryFn: async () => {
      let result = await fetchQuestions(imageType, difficulty);

      // Fallback if filtered type returns nothing
      if (result.length === 0 && imageType !== "all") {
        result = await fetchQuestions("all", difficulty);
      }

      // Apply diagnosis filter
      if (diagnosisFilter !== "all") {
        result = result.filter(q => q.diagnosis === diagnosisFilter);
      }

      // Shuffle and limit
      const shuffled = result.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, quizSize);
    },
  });

  // Available diagnoses — based on current image type filter
  const { data: availableDiagnoses = [] } = useQuery({
    queryKey: ["image-quiz-diagnoses", imageType],
    queryFn: async () => {
      let query = supabase
        .from("medical_image_assets")
        .select("diagnosis")
        .eq("is_active", true)
        .not("diagnosis", "is", null);

      if (imageType !== "all") {
        query = query.eq("image_type", imageType as any);
      }

      const { data } = await query;
      const unique = [...new Set((data || []).map((d: any) => d.diagnosis).filter(Boolean))].sort();
      return unique as string[];
    },
  });

  // Available image type counts
  const { data: imageTypeCounts = {} } = useQuery({
    queryKey: ["image-quiz-type-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_image_questions")
        .select("medical_image_assets!inner(image_type)")
        .eq("status", "published")
        .eq("medical_image_assets.is_active", true);
      
      const counts: Record<string, number> = {};
      (data || []).forEach((q: any) => {
        const t = q.medical_image_assets?.image_type;
        if (t) counts[t] = (counts[t] || 0) + 1;
      });
      return counts;
    },
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["image-quiz-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_image_attempts")
        .select("correct, asset_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      const total = data?.length || 0;
      const correct = data?.filter((a: any) => a.correct).length || 0;
      const uniqueImages = new Set(data?.map((a: any) => a.asset_id).filter(Boolean)).size;
      return { total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, uniqueImages };
    },
  });

  const saveAttempt = useMutation({
    mutationFn: async (params: { assetId: string | null; selectedIndex: number; correct: boolean; timeSeconds: number; imageType?: string; questionId?: string }) => {
      const { error } = await supabase.from("medical_image_attempts").insert({
        user_id: user!.id,
        asset_id: params.assetId || null,
        selected_index: params.selectedIndex,
        correct: params.correct,
        time_seconds: params.timeSeconds,
        image_type: params.imageType || null,
        question_id: params.questionId || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-quiz-stats"] });
    },
  });

  const currentQuestion = questions[currentIndex];

  // Auto-save session
  useEffect(() => {
    registerAutoSave(() => {
      if (quizMode !== "quiz" || score.total === 0) return {};
      return { imageType, difficulty, currentIndex, score, quizMode };
    });
  }, [imageType, difficulty, currentIndex, score, quizMode, registerAutoSave]);

  const handleResumeSession = () => {
    if (!pendingSession) return;
    const d = pendingSession.session_data as any;
    if (d.imageType) setImageType(d.imageType);
    if (d.difficulty) setDifficulty(d.difficulty);
    if (typeof d.currentIndex === "number") setCurrentIndex(d.currentIndex);
    if (d.score) setScore(d.score);
    if (d.quizMode) setQuizMode(d.quizMode);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setStartTime(Date.now());
    clearPending();
  };

  const handleAnswer = async (index: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;
    setSelectedAnswer(index);
    setShowExplanation(true);
    const correct = index === currentQuestion.correct_index;
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    const timeSeconds = Math.round((Date.now() - startTime) / 1000);

    if (user) {
      saveAttempt.mutate({
        assetId: currentQuestion.asset_id,
        selectedIndex: index,
        correct,
        timeSeconds,
        imageType: currentQuestion.image_type || undefined,
        questionId: currentQuestion.id || undefined,
      });

      if (!correct) {
        logErrorToBank({
          userId: user.id,
          questionId: (currentQuestion as any).id,
          tema: currentQuestion.diagnosis || currentQuestion.image_type || "Imagem Médica",
          subtema: currentQuestion.image_type || undefined,
          tipoQuestao: "objetiva",
          conteudo: currentQuestion.statement.slice(0, 300),
          categoriaErro: "conceito",
          dificuldade: currentQuestion.difficulty === "hard" ? 3 : currentQuestion.difficulty === "medium" ? 2 : 1,
        });
      }

      // Notify study-complete — closes the orchestrator adaptive loop
      // by propagating decisionId (?did=) when the user came from a
      // recommendation. Without this, orchestrator_outcomes stays empty.
      try {
        const decisionId = searchParams.get("did") || undefined;
        await supabase.functions.invoke("study-complete", {
          body: {
            actionType: "image_quiz",
            themeId: currentQuestion.diagnosis || currentQuestion.image_type || "image-quiz",
            topicId: currentQuestion.image_type || "image-quiz",
            wasCorrect: correct,
            taskId: currentQuestion.id,
            metadata: {
              source: "image_quiz",
              originModule: "image_quiz",
              imageType: currentQuestion.image_type,
              diagnosis: currentQuestion.diagnosis,
              difficulty: currentQuestion.difficulty,
              assetId: currentQuestion.asset_id,
              timeSeconds,
              decisionId,
            },
          },
        });
      } catch (e) {
        console.error("[ImageQuiz] study-complete failed:", e);
      }
    }

    if (correct) toast.success("Correto! 🎉");
    else toast.error(`Incorreto. Resposta: ${currentQuestion.options[currentQuestion.correct_index]}`);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setStartTime(Date.now());
    }
  };

  const handleRestart = () => {
    completeSession();
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setStartTime(Date.now());
  };

  // ── Admin: excluir questão ruim do banco (apenas admins) ──
  const handleAdminDeleteQuestion = async () => {
    if (!isAdmin || !currentQuestion?.id) return;
    setIsDeletingQuestion(true);
    try {
      const { error } = await supabase
        .from("medical_image_questions")
        .delete()
        .eq("id", currentQuestion.id);
      if (error) throw error;

      toast.success("Questão excluída do banco");

      // Invalida caches para refletir remoção (refetch do quiz)
      queryClient.invalidateQueries({ queryKey: ["image-quiz-questions"] });
      queryClient.invalidateQueries({ queryKey: ["image-quiz-type-counts"] });
      queryClient.invalidateQueries({ queryKey: ["image-quiz-stats"] });

      // Avança visualmente para a próxima questão (refetch substitui o array)
      setSelectedAnswer(null);
      setShowExplanation(false);
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
      setStartTime(Date.now());
    } catch (err: any) {
      console.error("[ImageQuiz] delete failed:", err);
      toast.error("Falha ao excluir: " + (err?.message || "tente novamente"));
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  const shuffleAndStart = useCallback(() => {
    setQuizMode("quiz");
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setStartTime(Date.now());
  }, []);

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image-questions-secure", {
        body: { batch_size: 5 },
      });
      if (error) throw error;
      const generated = data?.generated || 0;
      if (generated > 0) {
        toast.success(`${generated} novas questões geradas!`);
        queryClient.invalidateQueries({ queryKey: ["image-quiz-questions"] });
        queryClient.invalidateQueries({ queryKey: ["image-quiz-type-counts"] });
      } else {
        toast.info("Nenhuma questão nova gerada. Tente novamente mais tarde.");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar: " + (err.message || "tente novamente"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset quiz state when filters change
  useEffect(() => {
    if (quizMode === "quiz") return;
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
  }, [imageType, difficulty, diagnosisFilter, quizSize]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalQuestions = Object.values(imageTypeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4 bg-black/95 border-border/30">
          <div className="relative flex items-center justify-center min-h-[50vh]">
            {zoomImage && (
              <img
                src={zoomImage}
                alt="Imagem ampliada"
                className="max-w-full max-h-[85vh] object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume banner */}
      {quizMode === "browse" && pendingSession && (
        <ResumeSessionBanner
          updatedAt={pendingSession.updated_at}
          onResume={handleResumeSession}
          onDiscard={abandonSession}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-7 w-7 text-primary" />
            Questões com Imagem
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalQuestions} questões disponíveis — ECG, RX, TC, US, Dermato e mais
          </p>
        </div>
        {stats && (
          <div className="flex gap-3">
            <Card className="px-3 py-2 text-center">
              <p className="text-lg font-bold text-primary">{stats.uniqueImages}</p>
              <p className="text-[10px] text-muted-foreground">Imagens feitas</p>
            </Card>
            <Card className="px-3 py-2 text-center">
              <p className="text-lg font-bold text-green-400">{stats.accuracy}%</p>
              <p className="text-[10px] text-muted-foreground">Acertos</p>
            </Card>
            <Card className="px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-400">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Tentativas</p>
            </Card>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={imageType} onValueChange={(v) => { setImageType(v); setDiagnosisFilter("all"); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de imagem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🏥 Todas ({totalQuestions})</SelectItem>
            {Object.entries(imageTypeLabels).map(([key, label]) => {
              const count = imageTypeCounts[key] || 0;
              if (count === 0) return null;
              return (
                <SelectItem key={key} value={key}>
                  {label} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Dificuldade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="easy">🟢 Fácil</SelectItem>
            <SelectItem value="medium">🟡 Médio</SelectItem>
            <SelectItem value="hard">🔴 Difícil</SelectItem>
          </SelectContent>
        </Select>

        <Select value={diagnosisFilter} onValueChange={setDiagnosisFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Diagnóstico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os diagnósticos ({availableDiagnoses.length})</SelectItem>
            {availableDiagnoses.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(quizSize)} onValueChange={(v) => setQuizSize(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Qtd" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 questões</SelectItem>
            <SelectItem value="10">10 questões</SelectItem>
            <SelectItem value="15">15 questões</SelectItem>
            <SelectItem value="20">20 questões</SelectItem>
            <SelectItem value="30">30 questões</SelectItem>
            <SelectItem value="50">50 questões</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="self-center">
          {questions.length} carregadas
        </Badge>

        {quizMode === "browse" && questions.length > 0 && (
          <Button onClick={shuffleAndStart} className="ml-auto">
            <Activity className="h-4 w-4 mr-2" /> Iniciar Quiz
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateQuestions}
          disabled={isGenerating}
          className="gap-1.5"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? "Gerando..." : "Gerar Questões"}
        </Button>
      </div>

      {questions.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma questão encontrada para este filtro</h3>
          <p className="text-muted-foreground text-sm">
            Tente remover filtros ou clique em "Gerar Questões" para criar novas automaticamente.
          </p>
        </Card>
      ) : quizMode === "quiz" && currentQuestion ? (
        <>
          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">
              {currentIndex + 1}/{questions.length}
            </span>
            <Progress value={((currentIndex + 1) / questions.length) * 100} className="flex-1" />
            <Badge variant="outline" className="gap-1">
              <Trophy className="h-3 w-3" /> {score.correct}/{score.total}
            </Badge>
          </div>

          {/* Quiz Card */}
          <Card className="overflow-hidden relative">
            {/* Admin: botão lixeira para excluir questão ruim do banco */}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    disabled={isDeletingQuestion}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full shadow-lg shadow-destructive/30 backdrop-blur-md bg-destructive/90 hover:bg-destructive border border-white/10"
                    title="Excluir questão do banco (admin)"
                    aria-label="Excluir questão do banco"
                  >
                    {isDeletingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir esta questão do banco?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é permanente e remove a questão do banco multimodal.
                      Use apenas para questões claramente ruins (imagem inadequada, gabarito errado, conteúdo confuso).
                      Os alunos não verão mais esta questão.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingQuestion}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleAdminDeleteQuestion}
                      disabled={isDeletingQuestion}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeletingQuestion ? "Excluindo…" : "Excluir definitivamente"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Image */}
            {currentQuestion.image_url && (
              <div
                className="relative bg-black/90 flex items-center justify-center min-h-[250px] sm:min-h-[350px] cursor-zoom-in group"
                onClick={() => setZoomImage(currentQuestion.image_url)}
              >
                <img
                  src={currentQuestion.image_url}
                  alt={`${currentQuestion.image_type || "Imagem"} médica`}
                  className="max-w-full max-h-[400px] object-contain"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge variant="secondary" className="gap-1 bg-background/80">
                    <ZoomIn className="h-3 w-3" /> Ampliar
                  </Badge>
                </div>
                <div className="absolute top-3 left-3 flex gap-2">
                  {currentQuestion.difficulty && (
                    <Badge className={difficultyLabels[currentQuestion.difficulty]?.color || ""}>
                      {difficultyLabels[currentQuestion.difficulty]?.label}
                    </Badge>
                  )}
                  {currentQuestion.image_type && (
                    <Badge variant="secondary">
                      {allImageTypeLabels[currentQuestion.image_type] || currentQuestion.image_type}
                    </Badge>
                  )}
                  {currentQuestion.exam_style && (
                    <Badge variant="outline" className="bg-background/80">{currentQuestion.exam_style}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* No image fallback */}
            {!currentQuestion.image_url && (
              <div className="bg-muted/30 border-b border-border flex flex-col items-center justify-center min-h-[200px] gap-3 p-6">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center">Imagem indisponível</p>
              </div>
            )}

            {/* Question & Options */}
            <div className="p-5 space-y-4">
              <p className="font-semibold text-base sm:text-lg leading-relaxed">{currentQuestion.statement}</p>
              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((option, i) => {
                  const isSelected = selectedAnswer === i;
                  const isCorrect = i === currentQuestion.correct_index;
                  const showResult = selectedAnswer !== null;

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={selectedAnswer !== null}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all font-medium",
                        !showResult && "hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
                        showResult && isCorrect && "border-green-500 bg-green-500/10 text-green-400",
                        showResult && isSelected && !isCorrect && "border-red-500 bg-red-500/10 text-red-400",
                        showResult && !isSelected && !isCorrect && "opacity-50",
                        !showResult && "border-border"
                      )}
                    >
                      <span className="flex items-start gap-2">
                        {showResult && isCorrect && <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />}
                        {showResult && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                        <span className="text-muted-foreground mr-1">{String.fromCharCode(65 + i)}.</span>
                        <span className="flex-1">{option}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {showExplanation && currentQuestion.explanation && (
                <Card className="p-4 bg-primary/5 border-primary/20 animate-fade-in space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-primary mb-2">💡 Explicação</p>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{currentQuestion.explanation}</p>
                  </div>

                  {currentQuestion.discussion && Object.values(currentQuestion.discussion).some(Boolean) && (
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      <p className="text-sm font-semibold text-primary">📚 Discussão Médica</p>
                      {currentQuestion.discussion.definition && (
                        <div><p className="text-xs font-semibold text-muted-foreground uppercase">Definição</p><p className="text-sm text-muted-foreground">{currentQuestion.discussion.definition}</p></div>
                      )}
                      {currentQuestion.discussion.physiopathology && (
                        <div><p className="text-xs font-semibold text-muted-foreground uppercase">Fisiopatologia</p><p className="text-sm text-muted-foreground">{currentQuestion.discussion.physiopathology}</p></div>
                      )}
                      {currentQuestion.discussion.findings && (
                        <div><p className="text-xs font-semibold text-muted-foreground uppercase">Achados Típicos</p><p className="text-sm text-muted-foreground">{currentQuestion.discussion.findings}</p></div>
                      )}
                      {currentQuestion.discussion.clinical_correlation && (
                        <div><p className="text-xs font-semibold text-muted-foreground uppercase">Correlação Clínica</p><p className="text-sm text-muted-foreground">{currentQuestion.discussion.clinical_correlation}</p></div>
                      )}
                      {currentQuestion.discussion.differential && (
                        <div><p className="text-xs font-semibold text-muted-foreground uppercase">Diagnóstico Diferencial</p><p className="text-sm text-muted-foreground">{currentQuestion.discussion.differential}</p></div>
                      )}
                      {currentQuestion.discussion.management && (
                        <div><p className="text-xs font-semibold text-muted-foreground uppercase">Conduta</p><p className="text-sm text-muted-foreground">{currentQuestion.discussion.management}</p></div>
                      )}
                    </div>
                  )}

                  {currentQuestion.exam_tips?.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs font-semibold text-amber-400 mb-1">🎯 Dicas de Prova</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {currentQuestion.exam_tips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentQuestion.pitfalls?.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Pegadinhas</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {currentQuestion.pitfalls.map((p, i) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentQuestion.diagnosis && (
                    <div className="pt-2 border-t border-border/50">
                      <Badge variant="outline" className="text-xs">
                        Diagnóstico: {currentQuestion.diagnosis}
                      </Badge>
                    </div>
                  )}
                </Card>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={handleRestart} className="gap-1">
                  <RotateCcw className="h-4 w-4" /> Recomeçar
                </Button>
                {selectedAnswer !== null && currentIndex < questions.length - 1 && (
                  <Button onClick={handleNext}>
                    Próxima →
                  </Button>
                )}
                {selectedAnswer !== null && currentIndex === questions.length - 1 && (
                  <Button onClick={() => { completeSession(); setQuizMode("browse"); }}>
                    Finalizar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </>
      ) : (
        /* Browse mode — show summary cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {questions.map((q, i) => (
            <Card
              key={q.id}
              className="overflow-hidden hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer"
              onClick={() => { setCurrentIndex(i); shuffleAndStart(); }}
            >
              {q.image_url ? (
                <div className="bg-black/80 h-40 flex items-center justify-center">
                  <img
                    src={q.image_url}
                    alt={`${q.image_type || "Imagem"} médica`}
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
              ) : (
                <div className="bg-muted/20 h-40 flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium line-clamp-2">{q.statement}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {q.difficulty && (
                    <Badge className={`text-[10px] ${difficultyLabels[q.difficulty]?.color || ""}`}>
                      {difficultyLabels[q.difficulty]?.label}
                    </Badge>
                  )}
                  {q.image_type && (
                    <Badge variant="secondary" className="text-[10px]">
                      {allImageTypeLabels[q.image_type] || q.image_type}
                    </Badge>
                  )}
                  {q.diagnosis && (
                    <Badge variant="outline" className="text-[10px]">
                      {q.diagnosis}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicalImageQuiz;
