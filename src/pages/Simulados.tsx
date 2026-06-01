import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { updateDomainMap } from "@/lib/updateDomainMap";
import { recordQuestionAnalyticsBatch, classifyQuestionMode, type QuestionAnalyticsEvent } from "@/lib/modalityAnalytics";
import { NON_MEDICAL_CONTENT_REGEX } from "@/lib/medicalValidation";
import { parseQuestionsFromText } from "@/lib/parseQuestions";
import { filterValidQuestions } from "@/lib/aiOutputValidation";
import { EXAM_PROFILES, calculateTopicDistribution, calculateDifficultySlots } from "@/lib/realExamDistribution";
import type { ExamDistributionTree } from "@/lib/examDistributionFromCurriculum";
import { selectImageQuestions, imageQuestionToSimQuestion, calculateImageSlots } from "@/lib/imageQuestionPipeline";
import { generateAdaptiveBlueprint, type AdaptiveBlueprint } from "@/lib/adaptiveModalityEngine";
import { useAdaptiveSimulado, type AdaptiveMeta } from "@/hooks/useAdaptiveSimulado";
import {
  type TRIParams,
  type TRIQuestionResult,
  assignTRIParams,
  triProbability,
  itemInformation,
} from "@/lib/triEngine";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, FileText, ChevronLeft, Play, Info, Sparkles, DatabaseZap, Clock, Trophy, Zap, Target, CheckCircle2, TrendingDown, History, Printer } from "lucide-react";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStudyContext } from "@/lib/studyContext";
import { logSimuladoSelection } from "@/lib/simuladoSelectionTelemetry";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SimuladoSetup from "@/components/simulados/SimuladoSetup";
import type { SimuladoMode } from "@/components/simulados/SimuladoSetup";
import SimuladoExam from "@/components/simulados/SimuladoExam";
import type { SimQuestion } from "@/components/simulados/SimuladoExam";
import SimuladoResult from "@/components/simulados/SimuladoResult";
import TRIResult from "@/components/simulados/TRIResult";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixSection } from "@/components/enaflix/EnaflixSection";
import { SimuladoProfileCard } from "@/components/enaflix/SimuladoProfileCard";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { useNavigate } from "react-router-dom";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import { evaluateCognitivePressure } from "@/lib/pedagogical/cognitive-pressure-engine";
import { useCognitiveOrchestrator } from "@/hooks/useCognitiveOrchestrator";

async function computeRealPerformance(userId: string) {
  const { data: rows } = await supabase
    .from("simulado_question_analytics" as any)
    .select("mode, image_type, is_correct, response_time_seconds, difficulty")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const analytics = (rows || []) as any[];

  const modalityStats: Record<string, { correct: number; total: number }> = {};
  const diffStats: Record<string, { correct: number; total: number }> = {};

  for (const row of analytics) {
    const mod = row.image_type || "ecg"; // Use a real modality as default for adaptive weighting
    if (!modalityStats[mod]) modalityStats[mod] = { correct: 0, total: 0 };
    modalityStats[mod].total++;
    if (row.is_correct) modalityStats[mod].correct++;

    const diff = row.difficulty || "medium";
    if (!diffStats[diff]) diffStats[diff] = { correct: 0, total: 0 };
    diffStats[diff].total++;
    if (row.is_correct) diffStats[diff].correct++;
  }

  const by_modality: Record<string, number> = {};
  for (const [mod, stats] of Object.entries(modalityStats)) {
    by_modality[mod] = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 50;
  }

  const by_difficulty: Record<string, number> = {};
  for (const [diff, stats] of Object.entries(diffStats)) {
    by_difficulty[diff] = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 50;
  }

  return { by_modality, by_difficulty, response_time: {}, error_patterns: [] };
}

type Phase = "setup" | "loading" | "exam" | "finished" | "partial";

const BATCH_SIZE = 10;

function buildPrompt(topics: string[], count: number, difficulty: string, specificTopic?: string, examBoard?: string): string {
  const topicsStr = topics.join(", ");
  const perTopic = Math.ceil(count / topics.length);
  const boardInstruction = examBoard ? `\nESTILO DE BANCA: Gere as questões no estilo da prova ${examBoard}, com formato, pegadinhas e abordagens típicas dessa banca.` : "";
  const difficultyInstruction = difficulty === "misto"
    ? "Distribua: 30% intermediárias (padrão REVALIDA) e 70% difíceis (padrão ENARE/USP-SP)."
    : difficulty === "facil"
    ? "Nível: intermediário-baixo."
    : difficulty === "intermediario"
    ? "Nível: intermediário-alto."
    : "Nível: ALTO (padrão ENARE/USP-SP).";
  const topicFocus = specificTopic ? `\nFOCO TEMÁTICO: Todas as questões devem abordar especificamente "${specificTopic}".` : "";

  return `Gere exatamente ${count} questões de múltipla escolha para simulado de residência médica. IDIOMA: PT-BR. TEMAS: ${topicsStr}${topicFocus}${boardInstruction}. ${difficultyInstruction} FORMATO: Array JSON puro.`;
}

async function generateBatch(
  topics: string[], 
  count: number, 
  difficulty: string, 
  accessToken: string | undefined, 
  specificTopic?: string, 
  examBoard?: string, 
  avoidStatements?: string[], 
  jobId?: string, 
  batchNumber?: number, 
  topicWeights?: any[],
  autoDistribution?: boolean,
  customDistribution?: any[],
  includeWeakThemes?: boolean,
  includePreviousErrors?: boolean,
  mode: SimuladoMode = "estudo",
  avoidIds?: string[]
): Promise<{ questions: SimQuestion[]; sessionId: string | null }> {
  // [QUESTION_GEN_START]
  console.log("[QUESTION_GEN_START] Config:", { topics, count, difficulty, examBoard, mode });
  
  try {
    const { data, error } = await supabase.functions.invoke("question-generator", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: {
        count,
        difficulty,
        specialty: topics[0] || "Clínica Médica",
        topics,
        targetExam: examBoard,
        mode,
        avoidIds,
        avoidStatements: avoidStatements,
        generationContext: {
          subtopic: specificTopic,
          topicWeights,
          autoDistribution
        }
      }
    });

    if (error) throw error;
    if (!data?.success) {
      console.error("[SIMULADO_GEN] Generator failed:", data);
      throw new Error(data?.error || "Falha na geração");
    }

    // [QUESTION_GEN_COUNT] check
    const receivedCount = data.questions?.length || 0;
    if (receivedCount < count) {
      console.warn(`[QUESTION_GEN_COUNT_MISMATCH] Requested ${count}, got ${receivedCount}`);
    }

    // [QUESTION_GEN_FINAL_OK]
    console.log(`[QUESTION_GEN_FINAL_OK] Session: ${data.session_id} Questions: ${receivedCount}`);
    return { questions: mapQuestions(data.questions || [], topics), sessionId: data.session_id || null };

  } catch (e) {
    console.error("[SIMULADO_GEN] Batch failed:", e);
    throw e;
  }
}

function mapQuestions(arr: any[], topics: string[]): SimQuestion[] {
  return (Array.isArray(arr) ? arr : [])
    .map((q: any) => ({
      id: q.id,
      bankId: q.id,
      statement: String(q.statement || ""),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correct: typeof q.correct === 'number' ? q.correct : (Number.isInteger(q.correct_index) ? q.correct_index : 0),
      topic: String(q.topic || topics[0]),
      explanation: String(q.explanation || ""),
      image_url: q.image_url,
    }))
    .filter(q => q.options.length >= 4 && q.statement.length > 10);
}

function deduplicateQuestions(questions: SimQuestion[]): SimQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    if (!q.statement) return false;
    const key = q.statement.substring(0, 150).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const Simulados = () => {
  const { user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    console.log("[Simulados] Página montada. User:", user?.id, "AuthLoading:", authLoading);
    // Add data-testid to the main container for E2E testing
    const container = document.querySelector('.pb-24');
    if (container) container.setAttribute('data-testid', 'simulados-page');
  }, [user, authLoading]);

  const { toast } = useToast();
  const { addXp } = useGamification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshUserState();
  const studyCtx = useStudyContext();
  const autoStartedRef = useRef(false);
  const cancelGenerationRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [finalAnswers, setFinalAnswers] = useState<Record<number, number>>({});
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [restoredState, setRestoredState] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [mode, setMode] = useState<SimuladoMode>("estudo");
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>([]);
  const [partialCount, setPartialCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const startTimeRef = useRef<Date>();
  const elapsedSecondsRef = useRef<number>(0);
  const configRef = useRef<any>(null);
  const simuladoSessionIdRef = useRef<string | null>(null);
  const e2eCorrelationIdRef = useRef<string | null>(null);
  const [triResults, setTriResults] = useState<TRIQuestionResult[]>([]);
  const triParamsRef = useRef<TRIParams[]>([]);
  
  // New state for Configuration Step
  const [showConfigStep, setShowConfigStep] = useState(false);
  const [configToVerify, setConfigToVerify] = useState<any>(null);

  const { data: cogOrch } = useCognitiveOrchestrator();
  const adaptive = useAdaptiveSimulado();
  const [adaptivePreviewMeta, setAdaptivePreviewMeta] = useState<AdaptiveMeta | null>(null);
  const [adaptivePreviewLoading, setAdaptivePreviewLoading] = useState(false);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

  const { pendingSession, checked, saveSession, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "simulados" });

  useEffect(() => {
    if (user && phase === "setup") {
      console.log("[Simulados] Buscando jobs ativos para o usuário:", user.id);
      supabase
        .from("simulation_generation_jobs")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["processing", "partial", "pending"])
        .order("created_at", { ascending: false })
        .limit(3)
        .then(({ data, error }) => {
          if (error) {
            console.error("[Simulados] Erro ao buscar jobs ativos:", error);
            return;
          }
          if (data) {
            console.log("[Simulados] Jobs ativos encontrados:", data.length);
            setActiveJobs(data);
          }
        });
    }
  }, [user, phase]);

  const handleResumeJob = async (job: any) => {
    setPhase("loading");
    setLoadingProgress("Retomando geração...");
    setQuestions(job.results || []);
    setPartialCount(job.generated_questions || 0);
    setTargetCount(job.total_questions);
    
    // Continue with the configuration from the job
    handleStart({
      ...job.config,
      count: job.total_questions,
      resumeJobId: job.id,
      existingQuestions: job.results || []
    });
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await supabase
        .from("simulation_generation_jobs")
        .update({ status: 'failed', error_message: 'cancelled_by_user' })
        .eq("id", jobId);
      
      setActiveJobs(prev => prev.filter(j => j.id !== jobId));
      toast({
        title: "Geração cancelada",
        description: "A geração do simulado foi interrompida com sucesso.",
      });
    } catch (e) {
      console.error("Error cancelling job:", e);
    }
  };

  const examStateRef = useRef<any>(null);

  const getExamState = useCallback(() => {
    if (phase !== "exam") return {};
    return { phase, questions, selectedTopics, mode, examState: examStateRef.current };
  }, [phase, questions, selectedTopics, mode]);

  useEffect(() => { registerAutoSave(getExamState); }, [getExamState, registerAutoSave]);

  const handleResumeSession = useCallback(() => {
    if (!pendingSession?.session_data) return;
    const data = pendingSession.session_data as Record<string, any>;
    if (data.questions) setQuestions(data.questions);
    if (data.selectedTopics) setSelectedTopics(data.selectedTopics);
    if (data.mode) setMode(data.mode);
    if (data.examState) setRestoredState(data.examState);
    startTimeRef.current = new Date();
    setPhase("exam");
    clearPending();
  }, [pendingSession, clearPending]);

  const startExamWithQuestions = (qs: SimQuestion[], config: any) => {
    setQuestions(qs);
    const isTimedMode = config.mode === "prova" || config.mode === "extremo" || config.mode === "prova_real" || config.mode === "tri";
    const timeLeft = isTimedMode ? (config.mode === "prova_real" && config.realExamProfile ? (EXAM_PROFILES[config.realExamProfile]?.timeMinutes || 300) * 60 : qs.length * 3 * 60) : 0;
    setRestoredState({ timeLeft });
    startTimeRef.current = new Date();
    setPhase("exam");
  };

  const handleStart = async (config: { 
    topics: string[]; 
    count: number; 
    difficulty: string; 
    timePerQuestion?: number; 
    mode: SimuladoMode; 
      specificTopic?: string; 
      examBoard?: string; 
      realExamProfile?: string; 
      imagePercent?: number; 
      dynamicDistribution?: ExamDistributionTree; 
      topicWeights?: any[];
      autoDistribution?: boolean;
      customDistribution?: any[];
      includeWeakThemes?: boolean;
      includePreviousErrors?: boolean;
      resumeJobId?: string;
      existingQuestions?: SimQuestion[];
      forceStart?: boolean; // New flag to bypass config step
    }) => {
    console.log("[Simulados] iniciar clicado", config);
    const correlationId = crypto.randomUUID();
    e2eCorrelationIdRef.current = correlationId;
    console.log("[E2E_SIMULADO_START]", { correlation_id: correlationId, config });
    
    // Safety check: ensure topics are loaded from distribution if missing
    const hasManualTopics = Array.isArray(config.topics) && config.topics.length > 0;
    const hasAutoDistribution = config.topicWeights && Array.isArray(config.topicWeights) && config.topicWeights.length > 0;
    const hasCustomDistribution = config.customDistribution && Array.isArray(config.customDistribution) && config.customDistribution.length > 0;
    const selectedExam = config.realExamProfile || config.examBoard;

    if (!hasManualTopics && (hasAutoDistribution || hasCustomDistribution)) {
      const weights = config.customDistribution || config.topicWeights;
      config.topics = weights.map((tw: any) => tw.topic);
      console.log("[Simulados] Tópicos recuperados da distribuição:", config.topics);
    }
    
    // Se ainda estiver vazio e tivermos uma banca selecionada, tentamos carregar o blueprint
    if ((!config.topics || config.topics.length === 0) && selectedExam && selectedExam !== "all") {
      const profile = EXAM_PROFILES[selectedExam as keyof typeof EXAM_PROFILES];
      if (profile) {
        config.topics = profile.topicWeights.map(t => t.topic);
        config.topicWeights = profile.topicWeights;
        console.log("[Simulados] Tópicos carregados do blueprint da banca:", selectedExam, config.topics);
      }
    }

    // Ensure selectedTopics state is updated to reflect the reality of generation
    if (config.topics && config.topics.length > 0) {
      setSelectedTopics(config.topics);
    }
    
    const canGenerate = (config.topics && config.topics.length > 0) || config.specificTopic || selectedExam;
    if (!canGenerate) {
      toast({
        title: "Seleção necessária",
        description: "Selecione uma banca ou pelo menos um assunto.",
        variant: "destructive"
      });
      return;
    }

    // Check if we need to show the configuration step
    const isBoardMode = config.mode === "prova_real" || config.mode === "tri";
    if (isBoardMode && !config.forceStart && !showConfigStep) {
      console.log("[Simulados] Exibindo tela de confirmação/configuração avançada.");
      setConfigToVerify(config);
      setShowConfigStep(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const questionCount = config.count || 10;
    
    // Cognitive Pressure Control
    if (cogOrch?.fatigue_index && cogOrch.fatigue_index > 80) {
      toast({
        title: "Fadiga detectada",
        description: "Seu nível de cansaço está alto. Reduzimos a dificuldade do simulado para proteger sua retenção.",
      });
      config.difficulty = "facil";
    }

    configRef.current = config;
    simuladoSessionIdRef.current = null;
    setMode(config.mode || "estudo");
    
    setLoadingProgress("Iniciando geração...");
    setLoadingPercent(5);
    setPhase("loading");
    setShowConfigStep(false); // Ensure config step is hidden when starting

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (config.mode === "adaptativo") {
        setLoadingProgress("Analisando seu desempenho...");
        setLoadingPercent(20);
        
        // Se já tivermos o hook, usamos ele, mas aqui no Simulado.tsx
        // o usuário está clicando no card que chama handleStart diretamente.
        // Vamos garantir que a lógica adaptativa seja disparada.
        if (user) {
          const perf = await computeRealPerformance(user.id);
          setLoadingProgress("IA organizadora preparando blueprint...");
          setLoadingPercent(40);
          
          const { data, error: fnError } = await supabase.functions.invoke(
            "generate-adaptive-simulado",
            {
              headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
              body: {
                target_question_count: config.count || 20,
                performance: perf,
                topics: config.topics && config.topics.length > 0 ? config.topics : undefined,
                discipline: (config.topics && config.topics[0]) || undefined,
                targetExam: config.realExamProfile || config.examBoard || undefined,
                mode: config.mode || "adaptativo",
              },
            }
          );

          if (fnError) throw fnError;
          if (!data?.success) throw new Error(data?.error || "Falha na geração adaptativa");

          if (data?.session_id) {
            simuladoSessionIdRef.current = data.session_id;
            console.log(`[SIMULADO_SESSION_CAPTURED] adaptive=${data.session_id}`);
            console.log("[E2E_SIMULADO_SESSION_CREATED]", { correlation_id: correlationId, session_id: data.session_id, source: "adaptive" });
          }

          setLoadingPercent(90);
          setLoadingProgress("Finalizando ambiente...");

          // O mapQuestions atual espera o formato SimQuestion do Simulados.tsx
          // mas as questões do adaptive já vêm estruturadas.
          // Vamos garantir compatibilidade.
          const adaptiveQs = (data.questions || []).map((q: any) => ({
            statement: q.statement || q.content || "",
            options: q.options || [],
            correct: typeof q.correct === 'number' ? q.correct : (typeof q.correct_index === 'number' ? q.correct_index : 0),
            topic: q.topic || q.specialty || config.topics?.[0] || "Geral",
            explanation: q.explanation || q.rationale || "",
            image_url: q.image_url || q.imageUrl
          }));

          if (adaptiveQs.length === 0) {
            throw new Error("Nenhuma questão foi gerada. Tente novamente.");
          }

          setLoadingPercent(100);
          setTimeout(() => {
            console.log("[E2E_SIMULADO_QUESTIONS_RENDERED]", { correlation_id: correlationId, session_id: simuladoSessionIdRef.current, questions: adaptiveQs.length });
            startExamWithQuestions(adaptiveQs, config);
          }, 500);
          return;
        }
      }

      // Fluxo Normal com JOB e BATCHING
      const requestedTotal = config.count || 10;
      setTargetCount(requestedTotal);
      cancelGenerationRef.current = false;
      
      let currentJobId: string | undefined = config.resumeJobId;
      let allGenerated: SimQuestion[] = config.existingQuestions || [];
      
      // Para simulados grandes (50 ou 100), criar um job no banco se não estiver retomando
      if (requestedTotal >= 50 && user && !currentJobId) {
        console.log("[Simulados] criando job", {
          user_id: user.id,
          total_questions: requestedTotal,
          status: 'pending',
          config: {
            topics: config.topics,
            difficulty: config.difficulty,
            mode: config.mode,
            realExamProfile: config.realExamProfile
          }
        });
        const { data: job, error: jobError } = await supabase
          .from("simulation_generation_jobs")
          .insert({
            user_id: user.id,
            total_questions: requestedTotal,
            status: 'pending',
            config: {
              topics: config.topics,
              difficulty: config.difficulty,
              mode: config.mode,
              realExamProfile: config.realExamProfile
            }
          })
          .select()
          .single();
        
        if (jobError) {
          console.error("Erro ao criar job:", jobError);
          toast({
            title: "Erro ao criar job",
            description: "Não foi possível registrar a tarefa de geração em massa.",
            variant: "destructive"
          });
        }
        else currentJobId = job.id;
      }

      const BATCH_SIZE_AI = 20; // Increased batch size to reduce calls
      let currentTry = 0;
      
      while (allGenerated.length < requestedTotal && !cancelGenerationRef.current) {
        // SAFETY LIMIT: If we are in a loop but not progressing, break
        if (currentTry > 10) {
          console.error("[Simulados] Too many attempts, breaking loop to avoid UI freeze.");
          break;
        }
        currentTry++;

        const remaining = requestedTotal - allGenerated.length;
        const currentBatchSize = Math.min(BATCH_SIZE_AI, remaining);
        const batchNum = Math.floor(allGenerated.length / BATCH_SIZE_AI) + 1;
        const totalBatchesNum = Math.ceil(requestedTotal / BATCH_SIZE_AI);
        
        console.log(`[Simulados] Gerando lote ${batchNum}/${totalBatchesNum} (total acumulado: ${allGenerated.length}/${requestedTotal})`);
        setLoadingProgress(`Gerando lote ${batchNum} de ${totalBatchesNum}...`);
        setLoadingPercent(Math.max(5, Math.round((allGenerated.length / requestedTotal) * 100)));
        
        // Add data-testid for E2E progress monitoring
        const progressElement = document.querySelector('[role="progressbar"]');
        if (progressElement) progressElement.setAttribute('data-testid', 'simulation-job-status');
        
        // Atualizar status do job para processing no primeiro lote
        if (currentJobId && allGenerated.length === 0) {
          await supabase.from("simulation_generation_jobs").update({ status: 'processing' }).eq("id", currentJobId);
        }
        
        try {
          const avoid = allGenerated.map(q => q.statement);
          const avoidIds = allGenerated.map(q => q.id).filter(Boolean) as string[];
          
          console.log(`[Simulados] Chamando question-generator para lote ${batchNum}. Count: ${currentBatchSize}. AvoidIds: ${avoidIds.length}`);
          
          let batchData: any = null;
          let batchErr: any = null;
          
          try {
            console.log(`[Simulados] Lote ${batchNum}: Chamando question-generator. Count: ${currentBatchSize}`);
            const batchQs = await generateBatch(
              config.topics && config.topics.length > 0 ? config.topics : ["Clínica Médica"],
              currentBatchSize,
              config.difficulty || "misto",
              session?.access_token,
              config.specificTopic,
              config.realExamProfile || config.examBoard,
              avoid,
              currentJobId,
              batchNum,
              config.topicWeights,
              config.autoDistribution,
              config.customDistribution,
              config.includeWeakThemes,
              config.includePreviousErrors,
              config.mode || "estudo",
              avoidIds
            );
            batchData = { success: true, questions: batchQs.questions, session_id: batchQs.sessionId };
            if (batchQs.sessionId && !simuladoSessionIdRef.current) {
              simuladoSessionIdRef.current = batchQs.sessionId;
              console.log(`[SIMULADO_SESSION_CAPTURED] ${batchQs.sessionId}`);
            }
            console.log(`[Simulados] Lote ${batchNum} finalizado com sucesso. Recebidas ${batchQs.questions.length} questões.`);
          } catch (e) {
            console.error("[Simulados] generateBatch falhou, tentando invoke direto:", e);
            const { data, error } = await supabase.functions.invoke(
              "question-generator",
              {
                body: {
                  count: currentBatchSize,
                  difficulty: config.difficulty || "misto",
                  specialty: (config.topics && config.topics[0]) || "Clínica Médica",
                  topics: config.topics && config.topics.length > 0 ? config.topics : ["Clínica Médica"],
                  targetExam: config.realExamProfile || config.examBoard,
                  mode: config.mode || "estudo",
                  generationContext: {
                    subtopic: config.specificTopic,
                    topicWeights: config.topicWeights,
                    autoDistribution: config.autoDistribution,
                    customDistribution: config.customDistribution,
                    includeWeakThemes: config.includeWeakThemes,
                    includePreviousErrors: config.includePreviousErrors,
                  },
                  avoidStatements: avoid,
                  avoidIds: avoidIds,
                  jobId: currentJobId,
                  batchNumber: batchNum,
                },
              }
            );
            batchData = data;
            batchErr = error;
            if (data?.session_id && !simuladoSessionIdRef.current) {
              simuladoSessionIdRef.current = data.session_id;
              console.log(`[SIMULADO_SESSION_CAPTURED] ${data.session_id}`);
            }
          }

          if (batchErr) {
            console.error("[Simulados] Erro na Edge Function invoke:", batchErr);
            throw batchErr;
          }

          if (!batchData?.success) {
            console.error("[Simulados] Resposta da API sem sucesso:", batchData);
            throw new Error(batchData?.error || "Falha na geração das questões pela IA.");
          }

          const batchQs = (batchData.questions || []).map((q: any) => ({
            ...q,
            topic: q.topic || q.specialty || (config.topics && config.topics[0]) || "Geral"
          }));
          
          if (batchQs.length === 0) {
            console.warn("[Simulados] Lote retornado vazio.");
            if (allGenerated.length > 0) {
              setLoadingProgress(`Lote ${batchNum} falhou. Preparando com o que temos...`);
              if (currentJobId) await supabase.from("simulation_generation_jobs").update({ status: 'partial' }).eq("id", currentJobId);
              break;
            }
            throw new Error("Não foi possível gerar questões. A IA retornou um resultado vazio.");
          }
          
          allGenerated = deduplicateQuestions([...allGenerated, ...batchQs]);
          setQuestions(allGenerated);
          setPartialCount(allGenerated.length);
          currentTry = 0;

          // Update job progress
          if (currentJobId) {
            await supabase.from("simulation_generation_jobs").update({ 
              generated_questions: allGenerated.length,
              results: allGenerated as any
            }).eq("id", currentJobId);
          }
        } catch (batchError) {
          console.error(`[Simulados] Erro no lote ${batchNum}:`, batchError);
          if (currentTry < 1) {
            currentTry++;
            setLoadingProgress(`Re-tentando lote ${batchNum}...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          
          if (allGenerated.length > 0) {
            toast({
              title: "Algumas questões falharam",
              description: `Geramos ${allGenerated.length} de ${requestedTotal} questões. Iniciando simulado parcial.`,
            });
            if (currentJobId) await supabase.from("simulation_generation_jobs").update({ status: 'partial' }).eq("id", currentJobId);
            break;
          }
          if (currentJobId) await supabase.from("simulation_generation_jobs").update({ status: 'failed', error_message: String(batchError) }).eq("id", currentJobId);
          throw batchError;
        }
      }
      
      if (cancelGenerationRef.current) {
        if (currentJobId) await supabase.from("simulation_generation_jobs").update({ status: 'cancelled' }).eq("id", currentJobId);
        if (allGenerated.length === 0) {
          setPhase("setup");
          return;
        }
      }
      
      setLoadingPercent(100);
      setLoadingProgress("Finalizando simulado...");
      if (currentJobId && allGenerated.length >= requestedTotal) {
        await supabase.from("simulation_generation_jobs").update({ status: 'completed' }).eq("id", currentJobId);
      }
      setTimeout(() => {
        startExamWithQuestions(allGenerated, config);
      }, 500);
    } catch (e) {
      console.error("Simulado start error details:", e);
      toast({ 
        title: "Erro ao iniciar simulado", 
        description: e instanceof Error ? `Erro: ${e.message}` : "Erro desconhecido ao conectar com o gerador de questões.",
        variant: "destructive" 
      });
      setPhase("setup");
    }
  };

  const handleFinish = async (answers: Record<number, number>, flagged: number[]) => {
    clearInterval(elapsedSecondsRef.current);
    console.log("[SIMULADO_FINALIZE_START]", { sessionId: simuladoSessionIdRef.current, totalQs: questions.length });

    if (user) {
      const durationSeconds = startTimeRef.current
        ? Math.round((new Date().getTime() - startTimeRef.current.getTime()) / 1000)
        : 0;
      const elapsed = Math.round(durationSeconds / 60);

      const areaResults: Record<string, { correct: number; total: number }> = {};
      questions.forEach((q, i) => {
        if (!areaResults[q.topic]) areaResults[q.topic] = { correct: 0, total: 0 };
        areaResults[q.topic].total++;
        if (answers[i] === q.correct) areaResults[q.topic].correct++;
      });

      const correctCount = Object.values(answers).filter((ans, idx) => ans === questions[idx]?.correct).length;
      const finalScore = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

          // Create exam_sessions row BEFORE analytics so the FK from analytics is satisfied.
      const sessionId = simuladoSessionIdRef.current;
      console.log("[E2E_SIMULADO_FINALIZE_START]", { correlation_id: e2eCorrelationIdRef.current, session_id: sessionId, user_id: user.id, total_questions: questions.length });

      if (sessionId) {
        try {
          try {
            const { error: examErr } = await supabase.from("exam_sessions").insert({
              id: sessionId,
              user_id: user.id,
              title: `Simulado - ${selectedTopics.slice(0, 3).join(", ")}${selectedTopics.length > 3 ? "..." : ""}`,
              total_questions: questions.length,
              time_limit_minutes: questions.length * 3,
              status: "finished",
              finished_at: new Date().toISOString(),
              answers_json: answers as any,
              results_json: areaResults as any,
              score: finalScore,
            });
            if (examErr) {
              // 23505 = duplicate id (already inserted) — safe to ignore
              if ((examErr as any).code !== "23505") {
                console.warn("[SIMULADO_EXAM_SESSION_INSERT_FAIL]", examErr.message);
              }
            } else {
              console.log("[SIMULADO_EXAM_SESSION_INSERT_OK]", sessionId);
            }
            try { await addXp(XP_REWARDS.simulado_completed); } catch (xpErr) { console.error("XP error (non-fatal):", xpErr); }
          } catch (err) {
            console.error("[SIMULADO_EXAM_SESSION_INSERT_FAIL]", err);
          }

          // Per-question analytics — triggers the cognitive fan-out pipeline
          try {
            console.log("[SIMULADO_ANALYTICS_INSERT_START]", { sessionId, userId: user.id, count: questions.length });
            const rows = questions.map((q, idx) => {
              const rawMode = (configRef.current?.mode as string) || "";
              const hasImg = !!((q as any).image_url || (q as any).has_image || rawMode === "image");
              const safeMode = hasImg ? "image" : "text"; // CHECK constraint: image|text|fallback_text
              return {
                simulado_session_id: sessionId,
                user_id: user.id,
                question_id: (q as any).id ?? null,
                bank_question_id: (q as any).bankId ?? ((q as any).source === "bank" || (q as any)._source === "bank" ? (q as any).id : null),
                question_index: idx,
                selected_answer: answers[idx] ?? null,
                correct_answer: q.correct,
                is_correct: answers[idx] === q.correct,
                mode: safeMode,
                specialty: q.topic ?? null,
              };
            });
            const { error: anaErr } = await supabase
              .from("simulado_question_analytics")
              .insert(rows as any);
            if (anaErr) {
              console.error("[SIMULADO_ANALYTICS_INSERT_FAIL]", {
                message: anaErr.message,
                code: (anaErr as any).code,
                details: (anaErr as any).details,
                hint: (anaErr as any).hint,
                sessionId,
                userId: user.id,
              });
            } else {
              console.log("[SIMULADO_ANALYTICS_INSERT_OK]", { sessionId, rows: rows.length });
              console.log("[E2E_SIMULADO_ANALYTICS_OK]", { correlation_id: e2eCorrelationIdRef.current, session_id: sessionId, rows: rows.length });
            }
          } catch (anaCatch: any) {
            console.error("[SIMULADO_ANALYTICS_INSERT_FAIL]", anaCatch?.message || anaCatch);
          }

          // ── SPRINT LOOP PEDAGÓGICO — captura de massa observada ──
          // Persiste cada resposta em simulado_answers + practice_attempts e
          // registra erros em error_bank (que auto-cria fsrs_cards).
          try {
            const answerRows = questions.map((q, idx) => ({
              session_id: sessionId,
              user_id: user.id,
              question_id: (q as any).id && !String((q as any).id).startsWith("gen-") ? (q as any).id : null,
              selected_answer: answers[idx] ?? null,
              is_correct: answers[idx] === q.correct,
            }));
            const { error: ansErr } = await supabase.from("simulado_answers").insert(answerRows as any);
            if (ansErr) {
              console.warn("[LOOP_CAPTURE_SIMULADO_ANSWERS_FAIL]", ansErr.message);
            } else {
              console.log("[LOOP_CAPTURE_SIMULADO_ANSWERS_OK]", { sessionId, rows: answerRows.length });
            }

            // practice_attempts (somente questões reais do banco)
            const attemptRows = questions
              .map((q, idx) => {
                const qid = (q as any).id;
                if (!qid || String(qid).startsWith("gen-")) return null;
                // questions table is UUID; only insert if it looks like a uuid
                if (!/^[0-9a-f-]{36}$/i.test(String(qid))) return null;
                return {
                  user_id: user.id,
                  question_id: qid,
                  correct: answers[idx] === q.correct,
                };
              })
              .filter(Boolean) as any[];
            if (attemptRows.length > 0) {
              const { error: paErr } = await supabase.from("practice_attempts").insert(attemptRows);
              if (paErr) {
                console.warn("[LOOP_CAPTURE_PRACTICE_ATTEMPTS_FAIL]", paErr.message);
              } else {
                console.log("[LOOP_CAPTURE_PRACTICE_ATTEMPTS_OK]", { sessionId, rows: attemptRows.length });
              }
            }

            // error_bank + FSRS (auto via logErrorToBank.ensureFsrsCard)
            let errorsLogged = 0;
            for (let i = 0; i < questions.length; i++) {
              const q = questions[i];
              if (answers[i] === undefined || answers[i] === q.correct) continue;
              try {
                await logErrorToBank({
                  userId: user.id,
                  tema: q.topic || "Geral",
                  tipoQuestao: "simulado",
                  conteudo: (q as any).statement?.slice(0, 500),
                  motivoErro: `Marcou opção ${answers[i]} — Correta: opção ${q.correct}`,
                  categoriaErro: "conceito",
                });
                errorsLogged++;
              } catch (e: any) {
                console.warn("[LOOP_CAPTURE_ERROR_BANK_FAIL]", e?.message);
              }
            }
            console.log("[LOOP_CAPTURE_ERROR_BANK_OK]", { sessionId, errorsLogged });
          } catch (loopErr: any) {
            console.error("[LOOP_CAPTURE_FAIL]", loopErr?.message || loopErr);
          }


          const { error: updErr } = await supabase
            .from("simulado_sessions")
            .update({
              status: "finished",
              finished_at: new Date().toISOString(),
              score: finalScore,
              correct_count: correctCount,
              total_questions: questions.length,
              metadata: { duration_seconds: durationSeconds, elapsed_minutes: elapsed, correlation_id: e2eCorrelationIdRef.current } as any,
            })
            .eq("id", sessionId);
          if (updErr) {
            console.error("[E2E_SIMULADO_FAIL]", { stage: "session_finish", code: (updErr as any).code, details: (updErr as any).details, hint: (updErr as any).hint, session_id: sessionId, correlation_id: e2eCorrelationIdRef.current });
          } else {
            console.log("[E2E_SIMULADO_FANOUT_OK]", { correlation_id: e2eCorrelationIdRef.current, session_id: sessionId });
            console.log("[E2E_SIMULADO_FINISHED]", { correlation_id: e2eCorrelationIdRef.current, session_id: sessionId, score: finalScore });
          }
        } catch (e) {
          console.error("[SIMULADO_SESSION_UPDATE_FAIL]", e);
        }
      } else {
        console.warn("[SIMULADO_SESSION_UPDATE_SKIP] no sessionId captured");
      }
    }


    setFinalAnswers(answers);
    setFlaggedQuestions(flagged);
    setPhase("finished");
    refresh("session");
  };

  const handleNewSimulado = () => setPhase("setup");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="min-h-screen relative z-10 animate-fade-in pb-24" data-testid="simulados-page">
        <EnaflixBackgroundFX intensity="medium" />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  if (showConfigStep) {
                    setShowConfigStep(false);
                    setConfigToVerify(null);
                  } else {
                    navigate("/dashboard");
                  }
                }} 
                className="gap-2 text-white/40 hover:text-white mb-4 pl-0"
              >
                <ChevronLeft className="h-4 w-4" /> {showConfigStep ? "Voltar para Seleção" : "Voltar"}
              </Button>
              <EnaflixSectionTitle 
                kicker={showConfigStep ? "PERSONALIZAR" : "IA ORGANIZADORA"}
                title={
                  showConfigStep ? (
                    <>Configuração do <span className="gradient-text">Simulado</span></>
                  ) : (
                    <>Simulados <span className="gradient-text">& Provas</span></>
                  )
                } 
                subtitle={showConfigStep ? "Ajuste os temas e pesos antes de iniciar seu desafio." : "IA de estudos gera desafios reais para testar seu domínio clínico."}
              />
            </div>
            {pendingSession && checked && !showConfigStep && (
              <ResumeSessionBanner updatedAt={pendingSession.updated_at} onResume={handleResumeSession} onDiscard={abandonSession} />
            )}
          </div>

          {showConfigStep && configToVerify && (
            <div className="w-full max-w-3xl mx-auto">
              <div className="glass-card p-6 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SimuladoSetup
                  inlineMode={true}
                  onStart={(config) => handleStart({ ...config, forceStart: true })}
                  adaptiveLoading={adaptivePreviewLoading}
                  adaptiveMeta={adaptivePreviewMeta}
                  onFetchAdaptivePreview={() => {}}
                  onResumeSession={handleResumeSession}
                  onDiscardSession={abandonSession}
                  onRetryErrors={() => {}}
                  pendingSession={null}
                  checkedSession={true}
                  userId={user?.id}
                />
              </div>
            </div>
          )}

          {!showConfigStep && (
            <>
              {activeJobs.length > 0 && (
                <EnaflixSection title="Gerações em Andamento">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeJobs.map(job => (
                      <Card key={job.id} className="bg-card/50 border-primary/20 backdrop-blur-sm overflow-hidden">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                                {job.config?.mode === 'prova_real' ? job.config?.realExamProfile : 'Simulado Personalizado'}
                              </p>
                              <h4 className="font-semibold text-sm line-clamp-1">
                                {job.config?.topics?.join(', ') || 'Temas variados'}
                              </h4>
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {job.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground">
                              <span>Progresso</span>
                              <span>{job.generated_questions || 0} / {job.total_questions}</span>
                            </div>
                            <Progress value={((job.generated_questions || 0) / job.total_questions) * 100} className="h-1" />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                              <Clock className="h-3 w-3" />
                              {new Date(job.created_at).toLocaleTimeString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 text-[10px] font-bold uppercase text-white/40 hover:text-destructive"
                                onClick={() => handleCancelJob(job.id)}
                              >
                                Cancelar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 text-[10px] font-bold uppercase"
                                onClick={() => handleResumeJob(job)}
                              >
                                Retomar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </EnaflixSection>
              )}

              <div className="w-full max-w-5xl mx-auto space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SimuladoProfileCard
                    title="Simulado Adaptativo IA"
                    subtitle="Focado nos seus temas de menor desempenho"
                    count={20} timeMinutes={60} difficulty="misto" badge="IA Recomendou"
                    image="https://images.unsplash.com/photo-1633526543814-9718c8922b7a?q=80&w=400"
                    onClick={() => handleStart({ topics: ["Clínica Médica"], count: 20, difficulty: "misto", mode: "adaptativo" })}
                  />
                  <SimuladoProfileCard
                    title="Desafio de Diagnóstico Visual"
                    subtitle="100% questões com imagem"
                    count={10} timeMinutes={20} difficulty="intermediario"
                    image="https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=400"
                    onClick={() => handleStart({ topics: ["Clínica Médica"], count: 10, difficulty: "intermediario", mode: "estudo", imagePercent: 100 })}
                  />
                </div>

                <EnaflixSection title="Bancas Oficiais" subtitle="Simule o ambiente real das maiores provas do país.">
                  <EnaflixRow title="">
                    {Object.entries(EXAM_PROFILES).slice(0, 8).map(([id, profile]) => (
                      <div key={id} className="flex-none w-[280px] sm:w-[320px]">
                        <SimuladoProfileCard
                          title={profile.name}
                          subtitle="Padrão oficial da banca"
                          count={profile.totalQuestions}
                          timeMinutes={profile.timeMinutes}
                          image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=400"
                          onClick={() => handleStart({ topics: profile.topicWeights.map(t => t.topic), count: profile.totalQuestions, difficulty: "misto", mode: "prova_real", realExamProfile: id })}
                          data-testid={`banca-${id.toLowerCase()}-button`}
                        />
                      </div>
                    ))}
                  </EnaflixRow>
                </EnaflixSection>

                <div className="space-y-8 pt-8 border-t border-white/5">
                  <EnaflixSectionTitle kicker="PERSONALIZAR" title="Configuração Avançada" subtitle="Monte sua prova personalizada." />
                  <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden p-6 sm:p-8">
                    <SimuladoSetup
                      onStart={(config) => {
                        console.log("[Simulados] Setup.onStart disparado:", config);
                        handleStart(config);
                      }}
                      adaptiveLoading={adaptivePreviewLoading}
                      adaptiveMeta={adaptivePreviewMeta}
                      onFetchAdaptivePreview={() => {
                        console.log("[Simulados] Fetch adaptive preview");
                      }}
                      onResumeSession={handleResumeSession}
                      onDiscardSession={abandonSession}
                      onRetryErrors={() => {}}
                      pendingSession={pendingSession}
                      checkedSession={checked}
                      userId={user?.id}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen relative z-10 flex flex-col items-center justify-center animate-fade-in p-4">
        <EnaflixBackgroundFX intensity="medium" />
        <div className="relative flex flex-col items-center justify-center gap-6 text-center max-w-md w-full">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
            <Loader2 className="h-16 w-16 text-primary animate-spin relative" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">{loadingProgress || "Gerando questões..."}</h2>
            <div className="text-sm text-white/40 font-medium">
              {targetCount >= 50 && !cancelGenerationRef.current && (
                <p className="mb-1 text-primary">Preparando simulado de grande porte...</p>
              )}
              <p>
                {partialCount > 0 
                  ? `${partialCount} questões já estão prontas para você.` 
                  : "IA organizadora preparando seu ambiente de prova."}
              </p>
            </div>

          </div>
          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Progress value={loadingPercent} className="h-1.5 bg-white/5" />
              <p className="text-[10px] text-center font-bold text-white/20 uppercase tracking-widest">{loadingPercent}% concluído</p>
            </div>
            <div className="flex flex-col gap-2">
              {partialCount > 0 && (
                <Button 
                  onClick={() => {
                    cancelGenerationRef.current = true;
                    startExamWithQuestions(questions.slice(0, partialCount), configRef.current);
                  }} 
                  variant="outline"
                  className="w-full h-11 bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2 font-black uppercase tracking-widest text-[10px]"
                >
                  <Play className="h-4 w-4" /> Iniciar com {partialCount} questões
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  cancelGenerationRef.current = true;
                  setPhase("setup");
                }} 
                className="text-white/40 hover:text-white font-bold uppercase tracking-widest text-[10px]"
              >
                Cancelar e Voltar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="min-h-screen relative z-10 animate-fade-in pb-24">
        <EnaflixBackgroundFX intensity="medium" />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleNewSimulado} className="gap-2 text-white/40 hover:text-white pl-0">
              <ChevronLeft className="h-4 w-4" /> Novo Simulado
            </Button>
          </div>
          <div className="w-full max-w-5xl mx-auto">
            <SimuladoResult
              questions={questions} selectedAnswers={finalAnswers} onNewSimulado={handleNewSimulado}
              onRetryErrors={() => {}} flaggedQuestions={flaggedQuestions} mode={mode}
              elapsedSeconds={elapsedSecondsRef.current}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10 animate-fade-in py-6">
      <EnaflixBackgroundFX intensity="subtle" />
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SimuladoExam
          questions={questions}
          timeSeconds={restoredState?.timeLeft ?? 0}
          onFinish={handleFinish}
          onAutoSaveState={() => ({ current: 0, selectedAnswers: {}, timeLeft: 0 })}
          onStateChange={() => {}}
          mode={mode}
        />
      </main>
    </div>
  );
};

export default memo(Simulados);
