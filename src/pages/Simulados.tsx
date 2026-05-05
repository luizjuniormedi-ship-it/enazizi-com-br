import { useState, useCallback, useEffect, useRef } from "react";
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
import { Loader2, FileText, ChevronLeft, Play, Info, Sparkles, DatabaseZap, Clock } from "lucide-react";
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
import SimuladoSetup from "@/components/simulados/SimuladoSetup";
import type { SimuladoMode } from "@/components/simulados/SimuladoSetup";
import SimuladoExam, { type SimQuestion } from "@/components/simulados/SimuladoExam";
import SimuladoResult from "@/components/simulados/SimuladoResult";
import TRIResult from "@/components/simulados/TRIResult";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixSection } from "@/components/enaflix/EnaflixSection";
import { SimuladoProfileCard } from "@/components/enaflix/SimuladoProfileCard";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { useNavigate } from "react-router-dom";

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
    const mod = row.image_type || "text";
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

async function generateBatch(topics: string[], count: number, difficulty: string, accessToken: string | undefined, specificTopic?: string, examBoard?: string, avoidStatements?: string[], jobId?: string, batchNumber?: number, topicWeights?: any[]): Promise<SimQuestion[]> {
  console.log("[DEBUG] Generating batch with config:", { topics, count, difficulty, specificTopic, examBoard });
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/question-generator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      stream: false,
      outputFormat: "json",
      difficulty,
      timeoutMs: 120000,
      messages: [{ role: "user", content: buildPrompt(topics, count, difficulty, specificTopic, examBoard) }],
      ...(avoidStatements && avoidStatements.length > 0 ? { avoidStatements } : {}),
      generationContext: { specialty: topics[0], topic: topics.join(", "), subtopic: specificTopic, objective: "practice", source: "simulado" },
      targetExam: examBoard,
      jobId,
      batchNumber,
      topicWeights, // Pass weights to guide the batch distribution
    }),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) return mapQuestions(JSON.parse(jsonMatch[0]), topics);
  
  // Fallback: check tool_calls if JSON was returned in that format
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const tc = JSON.parse(toolCall.function.arguments);
      const qs = Array.isArray(tc.questions) ? tc.questions : [];
      if (qs.length > 0) return mapQuestions(qs, topics);
    } catch (e) {
      console.error("Error parsing tool_calls fallback:", e);
    }
  }
  
  return [];
}

function mapQuestions(arr: any[], topics: string[]): SimQuestion[] {
  return (Array.isArray(arr) ? arr : [])
    .map((q: any) => ({
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
    const key = q.statement.substring(0, 120).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const Simulados = () => {
  useEffect(() => {
    // Add data-testid to the main container for E2E testing
    const container = document.querySelector('.pb-24');
    if (container) container.setAttribute('data-testid', 'simulados-page');
  }, []);
  const { user } = useAuth();
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
  const [triResults, setTriResults] = useState<TRIQuestionResult[]>([]);
  const triParamsRef = useRef<TRIParams[]>([]);

  const adaptive = useAdaptiveSimulado();
  const [adaptivePreviewMeta, setAdaptivePreviewMeta] = useState<AdaptiveMeta | null>(null);
  const [adaptivePreviewLoading, setAdaptivePreviewLoading] = useState(false);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

  const { pendingSession, checked, saveSession, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "simulados" });

  useEffect(() => {
    if (user && phase === "setup") {
      supabase
        .from("simulation_generation_jobs")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["processing", "partial", "pending"])
        .order("created_at", { ascending: false })
        .limit(3)
        .then(({ data }) => {
          if (data) setActiveJobs(data);
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

  const handleStart = async (config: any) => {
    configRef.current = config;
    setMode(config.mode || "estudo");
    setSelectedTopics(config.topics || ["Clínica Médica"]);
    
    setLoadingProgress("Iniciando geração...");
    setLoadingPercent(5);
    setPhase("loading");

    try {
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
              body: {
                target_question_count: config.count || 20,
                performance: perf,
              },
            }
          );

          if (fnError) throw fnError;
          if (!data?.success) throw new Error(data?.error || "Falha na geração adaptativa");

          setLoadingPercent(90);
          setLoadingProgress("Finalizando ambiente...");

          // O mapQuestions atual espera o formato SimQuestion do Simulados.tsx
          // mas as questões do adaptive já vêm estruturadas.
          // Vamos garantir compatibilidade.
          const adaptiveQs = (data.questions || []).map((q: any) => ({
            statement: q.statement,
            options: q.options,
            correct: q.correct,
            topic: q.topic || config.topics?.[0] || "Geral",
            explanation: q.explanation || "",
            image_url: q.image_url
          }));

          if (adaptiveQs.length === 0) {
            throw new Error("Nenhuma questão foi gerada. Tente novamente.");
          }

          setLoadingPercent(100);
          setTimeout(() => {
            startExamWithQuestions(adaptiveQs, config);
          }, 500);
          return;
        }
      }

      // Fluxo Normal com JOB e BATCHING
      const { data: { session } } = await supabase.auth.getSession();
      const requestedTotal = config.count || 10;
      setTargetCount(requestedTotal);
      cancelGenerationRef.current = false;
      
      let currentJobId: string | undefined = config.resumeJobId;
      let allGenerated: SimQuestion[] = config.existingQuestions || [];
      
      // Para simulados grandes (50 ou 100), criar um job no banco se não estiver retomando
      if (requestedTotal >= 50 && user && !currentJobId) {
        setLoadingProgress("Registrando tarefa de geração...");
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
        
        if (jobError) console.error("Erro ao criar job:", jobError);
        else currentJobId = job.id;
      }
      
      const BATCH_SIZE_AI = 10;
      let currentTry = 0;
      
      while (allGenerated.length < requestedTotal && !cancelGenerationRef.current) {
        const remaining = requestedTotal - allGenerated.length;
        const currentBatchSize = Math.min(BATCH_SIZE_AI, remaining);
        const batchNum = Math.floor(allGenerated.length / BATCH_SIZE_AI) + 1;
        const totalBatchesNum = Math.ceil(requestedTotal / BATCH_SIZE_AI);
        
        setLoadingProgress(`Gerando lote ${batchNum} de ${totalBatchesNum}...`);
        setLoadingPercent(Math.round((allGenerated.length / requestedTotal) * 100));
        
        // Add data-testid for E2E progress monitoring
        const progressElement = document.querySelector('[role="progressbar"]');
        if (progressElement) progressElement.setAttribute('data-testid', 'simulation-job-status');
        
        // Atualizar status do job para processing no primeiro lote
        if (currentJobId && allGenerated.length === 0) {
          await supabase.from("simulation_generation_jobs").update({ status: 'processing' }).eq("id", currentJobId);
        }
        
        try {
          const avoid = allGenerated.map(q => q.statement);
          const batchQs = await generateBatch(
            config.topics || ["Clínica Médica"], 
            currentBatchSize, 
            config.difficulty || "misto", 
            session?.access_token,
            undefined,
            config.realExamProfile ? config.realExamProfile.toLowerCase() : undefined,
            avoid,
            currentJobId,
            batchNum,
            config.topicWeights // Pass profile distribution weights
          );
          
          if (batchQs.length === 0) {
            if (allGenerated.length > 0) {
              setLoadingProgress(`Lote ${batchNum} falhou. Preparando com o que temos...`);
              if (currentJobId) await supabase.from("simulation_generation_jobs").update({ status: 'partial' }).eq("id", currentJobId);
              break;
            }
            throw new Error("Não foi possível gerar questões. Tente reduzir a quantidade ou mudar o tema.");
          }
          
          allGenerated = [...allGenerated, ...batchQs];
          setQuestions(allGenerated);
          setPartialCount(allGenerated.length);
          currentTry = 0;
        } catch (batchError) {
          console.error(`Error in batch ${batchNum}:`, batchError);
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
    setFinalAnswers(answers);
    setFlaggedQuestions(flagged);
    setPhase("finished");
    refresh("session");
  };

  const handleNewSimulado = () => setPhase("setup");

  if (phase === "setup") {
    return (
      <div className="pb-24 pt-8 space-y-12 relative min-h-screen">
        <EnaflixBackgroundFX intensity="medium" />
        <div className="px-4 sm:px-8 lg:px-14">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2 text-white/40 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
          <EnaflixSectionTitle
            kicker="IA ORGANIZADORA"
            title={
              <>
                Simulados <span className="gradient-text">& Provas</span>
              </>
            }
            subtitle="IA de estudos gera desafios reais para testar seu domínio clínico."
          />
        </div>

        {activeJobs.length > 0 && (
          <EnaflixRow title="Gerações em Andamento">
            {activeJobs.map((job) => (
              <SimuladoProfileCard
                key={job.id}
                title={`Simulado em Lote (${job.total_questions} questões)`}
                subtitle={`Progresso: ${job.generated_questions}/${job.total_questions}`}
                count={job.total_questions}
                timeMinutes={Math.round(job.total_questions * 3)}
                difficulty={job.config?.difficulty || "misto"}
                badge={job.status === "partial" ? "Parcial" : "Processando"}
                image="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=400"
                onClick={() => handleResumeJob(job)}
              />
            ))}
          </EnaflixRow>
        )}

        {pendingSession && checked && (
          <div className="px-4 sm:px-8 lg:px-14">
            <ResumeSessionBanner updatedAt={pendingSession.updated_at} onResume={handleResumeSession} onDiscard={abandonSession} />
          </div>
        )}

        <EnaflixRow title="Recomendados para você">
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
        </EnaflixRow>

        <EnaflixRow title="Bancas Oficiais">
          {Object.entries(EXAM_PROFILES).slice(0, 8).map(([id, profile]) => (
            <SimuladoProfileCard
              key={id} title={profile.name} subtitle="Padrão oficial da banca"
              count={profile.totalQuestions} timeMinutes={profile.timeMinutes}
              image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=400"
              onClick={() => handleStart({ topics: profile.topicWeights.map(t => t.topic), count: profile.totalQuestions, difficulty: "misto", mode: "prova_real", realExamProfile: id })}
              data-testid={`banca-${id.toLowerCase()}-button`}
            />
          ))}
        </EnaflixRow>

        <div>
          <div className="px-4 sm:px-8 lg:px-14 mb-8">
            <EnaflixSectionTitle kicker="PERSONALIZAR" title="Configuração Avançada" subtitle="Monte sua prova personalizada." />
          </div>
          <div className="px-4 sm:px-8 lg:px-14">
            <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
              <SimuladoSetup
                onStart={handleStart}
                adaptiveLoading={adaptivePreviewLoading}
                adaptiveMeta={adaptivePreviewMeta}
                onFetchAdaptivePreview={() => {}}
                onResumeSession={() => {}}
                onDiscardSession={() => {}}
                onRetryErrors={() => {}}
                pendingSession={null}
                checkedSession={true}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (phase === "loading") {
    return (
      <div className="relative min-h-screen">
        <EnaflixBackgroundFX intensity="medium" />
        <div className="relative flex flex-col items-center justify-center py-40 gap-6 px-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
            <Loader2 className="h-16 w-16 text-primary animate-spin relative" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-white">{loadingProgress || "Gerando questões..."}</h2>
            <p className="text-sm text-white/40 font-medium">
              {partialCount > 0 
                ? `${partialCount} questões já estão prontas para você.` 
                : "IA organizadora preparando seu ambiente de prova."}
            </p>
          </div>
          <div className="w-64 space-y-4">
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
                  className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
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
                className="text-white/40 hover:text-white"
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
      <div className="relative min-h-screen pb-24 pt-8">
        <EnaflixBackgroundFX intensity="medium" />
        <div className="relative px-4 sm:px-8 lg:px-14">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={handleNewSimulado} className="gap-2 text-white/40 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Novo Simulado
            </Button>
          </div>
          <SimuladoResult
            questions={questions} selectedAnswers={finalAnswers} onNewSimulado={handleNewSimulado}
            onRetryErrors={() => {}} flaggedQuestions={flaggedQuestions} mode={mode}
            elapsedSeconds={elapsedSecondsRef.current}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-24 pt-6">
      <EnaflixBackgroundFX intensity="subtle" />
      <div className="relative px-4 sm:px-8 lg:px-14">
        <SimuladoExam
          questions={questions}
          timeSeconds={restoredState?.timeLeft ?? 0}
          onFinish={handleFinish}
          onAutoSaveState={() => ({ current: 0, selectedAnswers: {}, timeLeft: 0 })}
          onStateChange={() => {}}
          mode={mode}
        />
      </div>
    </div>
  );
};

export default Simulados;
