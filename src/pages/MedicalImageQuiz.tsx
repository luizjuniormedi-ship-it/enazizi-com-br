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
import { Activity, CheckCircle, XCircle, SkipForward, RotateCcw, Trophy, ImageIcon, ZoomIn, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { isImageUrlClinical } from "@/lib/multimodalSafetyGate";
import PipelineOptimizationPanel from "@/components/quiz/PipelineOptimizationPanel";

type ImageQuestion = {
  id: string;
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

type QualityTier = "tier1" | "tier2" | "tier3";

const TIER_LABELS: Record<QualityTier, { label: string; color: string }> = {
  tier1: { label: "Alta qualidade", color: "bg-emerald-500/20 text-emerald-400" },
  tier2: { label: "Qualidade moderada", color: "bg-yellow-500/20 text-yellow-400" },
  tier3: { label: "Conteúdo em expansão", color: "bg-orange-500/20 text-orange-400" },
};

const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: "Fácil", color: "bg-green-500/20 text-green-400" },
  medium: { label: "Médio", color: "bg-yellow-500/20 text-yellow-400" },
  hard: { label: "Difícil", color: "bg-red-500/20 text-red-400" },
};

const imageTypeLabels: Record<string, string> = {
  ecg: "❤️ ECG",
  xray: "🫁 RX Tórax",
  ct: "🧠 TC",
  us: "📡 US",
  dermatology: "🩹 Dermato",
  ophthalmology: "👁️ Oftalmo",
  pathology: "🔬 Patologia",
};
// ─── Strict medical-only fetcher ──────────────────────────────────────
const SELECT_FIELDS = `
  id, statement, option_a, option_b, option_c, option_d, option_e,
  correct_index, explanation, difficulty, exam_style,
  discussion, exam_tips, pitfalls,
  medical_image_assets!inner(
    image_url, image_type, diagnosis, is_active,
    review_status, clinical_confidence, integrity_status,
    validation_level, asset_origin, ai_validated, quality_gate_passed
  )
`;

/** Frontend blocklist — last line of defense against non-medical URLs */
const BLOCKED_URL_TERMS = [
  "logo", "stock", "laptop", "banner", "algoscope", "placeholder",
  "mock", "demo", "avatar", "portrait", "screenshot", "dashboard",
  "icon", "favicon", "thumbnail", "profile", "headshot", "staff",
  "bio-photo", "doctor-photo", "team", "about-us", "generic",
  "notebook", "computer", "desktop", "monitor", "phone",
];

const VALID_IMAGE_TYPES = ["xray", "ecg", "ct", "us", "dermatology", "pathology", "ophthalmology"];

/** Validate a URL is a real medical image */
function isValidMedicalImageUrl(url: string | null): boolean {
  if (!url || typeof url !== "string" || url.trim().length < 10) return false;
  if (!isImageUrlClinical(url)) return false;
  const lower = url.toLowerCase();
  if (BLOCKED_URL_TERMS.some((term) => lower.includes(term))) return false;
  const hasImageExt = /\.(jpg|jpeg|png|webp|gif|bmp|tiff)(\?|$)/i.test(url);
  const isStorageUrl = url.includes("supabase.co/storage");
  if (!hasImageExt && !isStorageUrl) return false;
  return true;
}

/** Validate a question has all required fields */
function isCompleteQuestion(q: any): boolean {
  if (!q.statement || q.statement.trim().length < 50) return false;
  if (!q.explanation || q.explanation.trim().length < 30) return false;
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
  if (opts.some((o: any) => !o || String(o).trim().length < 5)) return false;
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 4) return false;
  return true;
}

/** Validate a full asset object is renderable */
function isRenderableMedicalImage(asset: any): boolean {
  if (!asset) return false;
  if (!isValidMedicalImageUrl(asset.image_url)) return false;
  if (asset.ai_validated === false) return false;
  if (asset.quality_gate_passed === false) return false;
  if (asset.integrity_status && asset.integrity_status !== "ok") return false;
  if (asset.image_type && !VALID_IMAGE_TYPES.includes(asset.image_type)) return false;
  return true;
}

function mapRows(data: any[]): ImageQuestion[] {
  let blockedImages = 0;
  let skippedIncomplete = 0;

  const result = data
    .filter((q: any) => {
      // HARD BLOCK: skip incomplete questions entirely
      if (!isCompleteQuestion(q)) {
        skippedIncomplete++;
        console.log("QUESTION SKIPPED (incomplete):", q.id, "stmt_len:", q.statement?.length || 0);
        return false;
      }
      return true;
    })
    .map((q: any) => {
      const asset = q.medical_image_assets;
      const hasValidImage = isRenderableMedicalImage(asset);

      if (!hasValidImage) {
        blockedImages++;
        console.log("INVALID IMAGE BLOCKED:", asset?.image_url || "no-url", "asset:", q.id);
      }

      const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean);
      return {
        id: q.id,
        statement: q.statement,
        options: opts,
        correct_index: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        exam_style: q.exam_style,
        image_url: hasValidImage ? asset.image_url : null,
        image_type: asset?.image_type || null,
        diagnosis: asset?.diagnosis || null,
        discussion: q.discussion || null,
        exam_tips: q.exam_tips || [],
        pitfalls: q.pitfalls || [],
      } as ImageQuestion;
    })
    // HARD BLOCK: only show questions that have a valid medical image
    .filter((q) => q.image_url !== null);

  console.log(`[ImageQuiz] Fetched: ${data.length} | Valid: ${result.length} | Blocked images: ${blockedImages} | Skipped incomplete: ${skippedIncomplete}`);
  return result;
}

async function fetchQuestionsWithFallback(
  imageType: string,
  difficulty: string,
): Promise<{ questions: ImageQuestion[]; tier: QualityTier }> {
  const applyFilters = (q: any, it: string, diff: string) => {
    if (it !== "all") q = q.eq("medical_image_assets.image_type", it as any);
    if (diff !== "all") q = q.eq("difficulty", diff as any);
    return q;
  };

  // ── Tier 1: Gold/Silver, confidence >= 0.9, ai_validated ──
  const t1 = applyFilters(
    supabase
      .from("medical_image_questions")
      .select(SELECT_FIELDS)
      .eq("status", "published")
      .eq("medical_image_assets.is_active", true)
      .eq("medical_image_assets.review_status", "published")
      .eq("medical_image_assets.integrity_status", "ok")
      .eq("medical_image_assets.ai_validated", true)
      .gte("medical_image_assets.clinical_confidence", 0.9)
      .in("medical_image_assets.validation_level", ["gold", "silver"])
      .in("medical_image_assets.asset_origin", ["real_medical", "validated_medical"])
      .in("medical_image_assets.image_type", VALID_IMAGE_TYPES as any)
      .neq("medical_image_assets.image_url", ""),
    imageType,
    difficulty,
  );
  const { data: d1, error: e1 } = await t1.order("created_at", { ascending: false }).limit(50);
  if (e1) throw e1;
  const q1 = mapRows(d1 || []);
  if (q1.length >= 5) return { questions: q1, tier: "tier1" };

  // ── Tier 2: Gold/Silver/Bronze, confidence >= 0.8 ──
  const t2 = applyFilters(
    supabase
      .from("medical_image_questions")
      .select(SELECT_FIELDS)
      .eq("status", "published")
      .eq("medical_image_assets.is_active", true)
      .eq("medical_image_assets.integrity_status", "ok")
      .gte("medical_image_assets.clinical_confidence", 0.8)
      .in("medical_image_assets.validation_level", ["gold", "silver", "bronze"])
      .in("medical_image_assets.image_type", VALID_IMAGE_TYPES as any)
      .neq("medical_image_assets.image_url", ""),
    imageType,
    difficulty,
  );
  const { data: d2, error: e2 } = await t2.order("created_at", { ascending: false }).limit(50);
  if (e2) throw e2;
  const q2 = mapRows(d2 || []);
  if (q2.length >= 3) return { questions: q2, tier: "tier2" };

  // ── Tier 3: active + integrity ok + any confidence ──
  const t3 = applyFilters(
    supabase
      .from("medical_image_questions")
      .select(SELECT_FIELDS)
      .eq("status", "published")
      .eq("medical_image_assets.is_active", true)
      .eq("medical_image_assets.integrity_status", "ok")
      .in("medical_image_assets.image_type", VALID_IMAGE_TYPES as any)
      .neq("medical_image_assets.image_url", ""),
    imageType,
    difficulty,
  );
  const { data: d3, error: e3 } = await t3.order("created_at", { ascending: false }).limit(50);
  if (e3) throw e3;
  const q3 = mapRows(d3 || []);
  console.log(`[ImageQuiz] Tier stats — T1: ${q1.length} | T2: ${q2.length} | T3: ${q3.length}`);
  return { questions: q3, tier: "tier3" };
}

const MedicalImageQuiz = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { pendingSession, checked, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "image-quiz" });

  // ── Adaptive params from study-next ──
  const adaptiveImageType = searchParams.get("imageType") || searchParams.get("type") || null;
  const adaptiveDifficulty = searchParams.get("difficulty") || null;

  const [imageType, setImageType] = useState<string>(adaptiveImageType || "all");
  const [difficulty, setDifficulty] = useState<string>(adaptiveDifficulty || "all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [quizMode, setQuizMode] = useState<"browse" | "quiz">("browse");
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [activeTier, setActiveTier] = useState<QualityTier>("tier1");

  // ── Adaptive pressure: fetch visual_skill_snapshots for current type ──
  const { data: visualSkill } = useQuery({
    queryKey: ["visual-skill-snapshot", user?.id, imageType],
    enabled: !!user && imageType !== "all",
    queryFn: async () => {
      const { data } = await supabase
        .from("visual_skill_snapshots")
        .select("accuracy, score, trend, attempts_count, weakest_area")
        .eq("user_id", user!.id)
        .eq("image_type", imageType)
        .maybeSingle();
      return data;
    },
  });

  // Compute adaptive difficulty based on visual skill
  const getAdaptiveDifficulty = useCallback((): string | null => {
    if (!visualSkill || difficulty !== "all") return null;
    const acc = visualSkill.accuracy ?? 100;
    const trend = visualSkill.trend;
    if (trend === "declining") return "easy"; // repeat weak topics
    if (acc < 50) return "easy";
    if (acc > 75) return "hard";
    return null; // keep default
  }, [visualSkill, difficulty]);

  // Log adaptive filter
  useEffect(() => {
    if (adaptiveImageType) {
      console.log("QUIZ FILTER:", adaptiveImageType, "adaptive difficulty:", getAdaptiveDifficulty());
    }
  }, [adaptiveImageType, getAdaptiveDifficulty]);

  // Fetch with tiered fallback + adaptive difficulty
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["image-quiz-questions", imageType, difficulty, visualSkill?.accuracy],
    queryFn: async () => {
      const effectiveDifficulty = getAdaptiveDifficulty() || difficulty;
      let result = await fetchQuestionsWithFallback(imageType, effectiveDifficulty);
      // Fallback: if adaptive filter returns no results, try without type filter
      if (result.questions.length === 0 && imageType !== "all") {
        console.log("[ImageQuiz] No results for", imageType, "— falling back to all");
        result = await fetchQuestionsWithFallback("all", difficulty);
      }
      setActiveTier(result.tier);
      return result.questions;
    },
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["image-quiz-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_image_attempts")
        .select("correct, image_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      const total = data?.length || 0;
      const correct = data?.filter((a: any) => a.correct).length || 0;
      const uniqueImages = new Set(data?.map((a: any) => a.image_id)).size;
      return { total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, uniqueImages };
    },
  });

  const saveAttempt = useMutation({
    mutationFn: async (params: { imageId: string; selectedIndex: number; correct: boolean; timeSeconds: number; imageType?: string; questionId?: string }) => {
      const { error } = await supabase.from("medical_image_attempts").insert({
        user_id: user!.id,
        image_id: params.imageId,
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
      queryClient.invalidateQueries({ queryKey: ["visual-skill-snapshot"] });
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
        imageId: currentQuestion.id,
        selectedIndex: index,
        correct,
        timeSeconds,
        imageType: currentQuestion.image_type || undefined,
        questionId: currentQuestion.id || undefined,
      });

      // Log to error_bank on wrong answer
      if (!correct) {
        logErrorToBank({
          userId: user.id,
          tema: currentQuestion.diagnosis || currentQuestion.image_type || "Imagem Médica",
          subtema: currentQuestion.image_type || undefined,
          tipoQuestao: "objetiva",
          conteudo: currentQuestion.statement.slice(0, 300),
          categoriaErro: "conceito",
          dificuldade: currentQuestion.difficulty === "hard" ? 3 : currentQuestion.difficulty === "medium" ? 2 : 1,
        });
      }

      // Call study-complete
      try {
        await supabase.functions.invoke("study-complete", {
          body: {
            actionType: "free_study",
            themeId: currentQuestion.diagnosis || currentQuestion.image_type || "image-quiz",
            topicId: currentQuestion.image_type || "image-quiz",
            wasCorrect: correct,
            taskId: currentQuestion.id,
            metadata: {
              source: "image_quiz",
              originModule: "image_quiz",
              imageType: currentQuestion.image_type,
              difficulty: currentQuestion.difficulty,
              timeSeconds,
            },
          },
        });
      } catch {
        // Non-blocking: don't break quiz flow
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
      if (error) {
        console.error("GENERATE ERROR:", error);
        throw error;
      }
      const generated = data?.generated || 0;
      const processed = data?.processed || 0;
      const failed = data?.failed || 0;
      console.log("GENERATED QUESTIONS:", generated, "processed:", processed, "failed:", failed);
      if (generated > 0) {
        toast.success(`${generated} novas questões geradas com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ["image-quiz-questions"] });
      } else if (processed === 0) {
        toast.info("Todos os assets já possuem questões. Nenhum pendente.");
      } else {
        toast.warning(`${processed} assets processados, mas ${failed} falharam. Verifique os logs.`);
      }
      if (data?.errors?.length > 0) {
        console.warn("Generation errors:", data.errors);
      }
    } catch (err: any) {
      toast.error("Erro ao gerar questões: " + (err.message || "tente novamente"));
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4 bg-black/95 border-border/30">
          <div className="relative flex items-center justify-center min-h-[50vh]">
            {zoomImage && isValidMedicalImageUrl(zoomImage) ? (
              <img
                src={zoomImage}
                alt="Imagem ampliada"
                className="max-w-full max-h-[85vh] object-contain"
                referrerPolicy="no-referrer"
              />
            ) : zoomImage ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                <p className="text-muted-foreground">Imagem indisponível para ampliação</p>
              </div>
            ) : null}
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
            Quiz de Imagens Médicas
          </h1>
          <p className="text-muted-foreground">ECG, RX, TC, US e mais — interprete imagens clínicas com gabarito comentado.</p>
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
      <div className="flex flex-wrap gap-3">
        <Select value={imageType} onValueChange={setImageType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo de imagem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="ecg">❤️ ECG</SelectItem>
            <SelectItem value="xray">🫁 RX Tórax</SelectItem>
            <SelectItem value="ct">🧠 TC</SelectItem>
            <SelectItem value="us">📡 US</SelectItem>
            <SelectItem value="dermatology">🩹 Dermato</SelectItem>
            <SelectItem value="ophthalmology">👁️ Oftalmo</SelectItem>
            <SelectItem value="pathology">🔬 Patologia</SelectItem>
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
        <Badge variant="secondary" className="self-center">
          {questions.length} questões
        </Badge>
        <Badge className={`self-center ${TIER_LABELS[activeTier].color}`}>
          {TIER_LABELS[activeTier].label}
        </Badge>
        {adaptiveImageType && adaptiveImageType !== "all" && (
          <Badge className="self-center bg-primary/20 text-primary border border-primary/30">
            🎯 {visualSkill?.trend === "declining" ? "Reforço" : "Treino focado"}: {imageTypeLabels[adaptiveImageType] || adaptiveImageType.toUpperCase()}
            {visualSkill?.accuracy !== undefined && ` (${visualSkill.accuracy}%)`}
          </Badge>
        )}
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

      {/* Pipeline Optimization Panel */}
      {quizMode === "browse" && <PipelineOptimizationPanel />}

      {questions.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Não há imagens médicas suficientes para este filtro</h3>
          <p className="text-muted-foreground">Apenas imagens médicas reais validadas são exibidas neste quiz.</p>
          <p className="text-xs text-muted-foreground mt-2">Tente remover os filtros de tipo ou dificuldade, ou clique em "Gerar Questões" para criar novas.</p>
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
          <Card className="overflow-hidden">
            {/* Image */}
            {currentQuestion.image_url && isValidMedicalImageUrl(currentQuestion.image_url) && (
              <div
                className="relative bg-black/90 flex items-center justify-center min-h-[250px] sm:min-h-[350px] cursor-zoom-in group"
                onClick={() => setZoomImage(currentQuestion.image_url)}
              >
                <img
                  src={currentQuestion.image_url}
                  alt={`${currentQuestion.image_type || "Imagem"} - Quiz`}
                  className="max-w-full max-h-[400px] object-contain"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                  }}
                />
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge variant="secondary" className="gap-1 bg-background/80">
                    <ZoomIn className="h-3 w-3" /> Ampliar
                  </Badge>
                </div>
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge className={difficultyLabels[currentQuestion.difficulty]?.color || ""}>
                    {difficultyLabels[currentQuestion.difficulty]?.label}
                  </Badge>
                  <Badge variant="secondary">
                    {imageTypeLabels[currentQuestion.image_type || ""] || currentQuestion.image_type}
                  </Badge>
                  {currentQuestion.exam_style && (
                    <Badge variant="outline" className="bg-background/80">{currentQuestion.exam_style}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* No image fallback — required when the asset is invalid or unavailable */}
            {(!currentQuestion.image_url || !isValidMedicalImageUrl(currentQuestion.image_url)) && (
              <div className="bg-muted/30 border-b border-border flex flex-col items-center justify-center min-h-[200px] gap-3 p-6">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center">
                  Imagem indisponível para esta questão
                </p>
                <div className="flex gap-2">
                  <Badge className={difficultyLabels[currentQuestion.difficulty]?.color || ""}>
                    {difficultyLabels[currentQuestion.difficulty]?.label}
                  </Badge>
                  {currentQuestion.image_type && (
                    <Badge variant="secondary">
                      {imageTypeLabels[currentQuestion.image_type] || currentQuestion.image_type}
                    </Badge>
                  )}
                </div>
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

                  {/* Discussion */}
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

                  {/* Exam Tips */}
                  {currentQuestion.exam_tips?.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-sm font-semibold text-primary mb-2">🎯 Pontos de Prova</p>
                      <ul className="space-y-1">
                        {currentQuestion.exam_tips.map((tip, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pitfalls */}
                  {currentQuestion.pitfalls?.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-sm font-semibold text-destructive mb-2">⚠️ Armadilhas Comuns</p>
                      <ul className="space-y-1">
                        {currentQuestion.pitfalls.map((pit, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{pit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handleRestart} size="sm">
                  <RotateCcw className="h-4 w-4 mr-1" /> Recomeçar
                </Button>
                {selectedAnswer !== null && currentIndex < questions.length - 1 && (
                  <Button onClick={handleNext}>
                    Próxima <SkipForward className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {selectedAnswer !== null && currentIndex === questions.length - 1 && (
                  <Card className="p-3 bg-primary/10 border-primary/20">
                    <p className="font-semibold">
                      🏆 Resultado: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </Card>
        </>
      ) : (
        /* Browse Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {questions.map((q, i) => (
            <Card
              key={q.id}
              className="overflow-hidden cursor-pointer hover:border-primary/30 transition-all group"
              onClick={() => {
                setCurrentIndex(i);
                setQuizMode("quiz");
                setSelectedAnswer(null);
                setShowExplanation(false);
                setStartTime(Date.now());
              }}
            >
              <div className="relative bg-black/80 h-40 flex items-center justify-center">
                {q.image_url && isValidMedicalImageUrl(q.image_url) ? (
                  <img
                    src={q.image_url}
                    alt="Quiz"
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center px-4">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Imagem indisponível para esta questão</p>
                  </div>
                )}
                <Badge className={cn("absolute top-2 left-2", difficultyLabels[q.difficulty]?.color)}>
                  {difficultyLabels[q.difficulty]?.label}
                </Badge>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {imageTypeLabels[q.image_type || ""] || q.image_type || "IMG"}
                  </Badge>
                  {q.exam_style && (
                    <span className="text-[10px] text-muted-foreground">{q.exam_style}</span>
                  )}
                </div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                  {q.statement.length > 80 ? q.statement.slice(0, 80) + "…" : q.statement}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicalImageQuiz;
