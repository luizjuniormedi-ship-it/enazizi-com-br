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
import { selectImageQuestions, imageQuestionToSimQuestion, calculateImageSlots } from "@/lib/imageQuestionPipeline";
import { generateAdaptiveBlueprint, type AdaptiveBlueprint } from "@/lib/adaptiveModalityEngine";
import { useAdaptiveSimulado, type AdaptiveMeta } from "@/hooks/useAdaptiveSimulado";
import {
  type TRIParams,
  type TRIQuestionResult,
  assignTRIParams,
  triProbability,
  itemInformation,
  estimateInitialTheta,
} from "@/lib/triEngine";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStudyContext } from "@/lib/studyContext";

function getSourcePriority(source: string | null | undefined): number {
  if (!source) return 3;
  if (source === "web-scrape" || source === "real-exam-ai") return 1;
  if (source === "ai-exam-style") return 2;
  return 3;
}
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import SimuladoSetup from "@/components/simulados/SimuladoSetup";
import type { SimuladoMode } from "@/components/simulados/SimuladoSetup";
import SimuladoExam from "@/components/simulados/SimuladoExam";
import type { SimQuestion } from "@/components/simulados/SimuladoExam";
import SimuladoResult from "@/components/simulados/SimuladoResult";
import TRIResult from "@/components/simulados/TRIResult";

type Phase = "setup" | "loading" | "exam" | "finished" | "partial";

const BATCH_SIZE = 20;

function buildPrompt(topics: string[], count: number, difficulty: string, specificTopic?: string, examBoard?: string): string {
  const topicsStr = topics.join(", ");
  const perTopic = Math.ceil(count / topics.length);
  const boardInstruction = examBoard ? `\nESTILO DE BANCA: Gere as questões no estilo da prova ${examBoard}, com formato, pegadinhas e abordagens típicas dessa banca.` : "";
  const difficultyInstruction = difficulty === "misto"
    ? "Distribua: 30% intermediárias (padrão REVALIDA) e 70% difíceis (padrão ENARE/USP-SP). Questões intermediárias devem exigir raciocínio clínico sólido. Questões difíceis devem ter diagnósticos diferenciais complexos e armadilhas de prova."
    : difficulty === "facil"
    ? "Nível: intermediário-baixo. Casos clínicos com apresentação clássica, mas ainda exigindo raciocínio clínico. Padrão REVALIDA."
    : difficulty === "intermediario"
    ? "Nível: intermediário-alto (padrão REVALIDA/ENARE). Casos com apresentação típica mas que exigem integração de conhecimentos e diagnóstico diferencial."
    : "Nível: ALTO (padrão ENARE/USP-SP — as provas mais difíceis do Brasil). Casos com apresentações atípicas, sobreposição de diagnósticos, valores laboratoriais limítrofes, armadilhas clássicas de provas de residência. 40% diagnóstico diferencial complexo, 30% conduta com contraindicações sutis, 20% interpretação de exames, 10% complicações/prognóstico.";
  const topicFocus = specificTopic ? `\nFOCO TEMÁTICO: Todas as questões devem abordar especificamente "${specificTopic}". Varie os cenários clínicos mas mantenha o foco neste tema.` : "";

  return `Gere exatamente ${count} questões de múltipla escolha para simulado de residência médica.

IDIOMA OBRIGATÓRIO: TUDO deve ser escrito em PORTUGUÊS BRASILEIRO. Enunciados, alternativas, explicações — TUDO em pt-BR. NUNCA use inglês.

TEMAS: ${topicsStr}${topicFocus}${boardInstruction}
DISTRIBUIÇÃO: aproximadamente ${perTopic} questões por tema. Distribua igualmente.
${difficultyInstruction}

REGRAS OBRIGATÓRIAS:
1. Cada questão DEVE OBRIGATORIAMENTE ser um CASO CLÍNICO COMPLEXO contendo: nome fictício, idade, sexo, profissão quando relevante, queixa principal com tempo de evolução, antecedentes pessoais com medicações em uso, exame físico com sinais vitais COMPLETOS (PA, FC, FR, Temp, SpO2), exames complementares com VALORES NUMÉRICOS e unidades. NÃO gere questões teóricas puras.
2. Mínimo 250 caracteres no enunciado — questões curtas ou sem contexto clínico completo serão rejeitadas
3. Exatamente 5 alternativas (A-E) por questão, todas PLAUSÍVEIS, clinicamente possíveis e com extensão similar
4. Distratores devem explorar erros REAIS de raciocínio clínico que candidatos cometem em provas de residência (confusão entre diagnósticos similares, contraindicações esquecidas, condutas obsoletas)
5. A explicação deve analisar CADA alternativa individualmente (por que certa ou errada), citar referência bibliográfica específica (Harrison cap. X, Sabiston, Nelson, Braunwald, etc.)
6. O campo "correct_index" deve ser o índice (0-4) da alternativa correta
7. 100% das questões devem envolver raciocínio clínico avançado — diagnóstico diferencial, conduta baseada em guidelines, interpretação de exames com valores limítrofes
8. PROIBIDO: questões do tipo "qual das alternativas está correta sobre X" sem caso clínico. PROIBIDO: questões de uma linha. PROIBIDO: enunciados vagos. PROIBIDO: questões com resposta óbvia.
9. Varie: sexo, idade (neonato a idoso), cenário (UBS, PS, enfermaria, UTI, ambulatório, centro cirúrgico), apresentação clínica (típica e atípica) e comorbidades

FORMATO: Retorne APENAS um array JSON puro, sem markdown, sem \`\`\`, neste formato:
[
  {
    "statement": "Paciente do sexo [M/F], [idade] anos, procura [local] com queixa de [sintomas] há [tempo]. [História clínica detalhada]. Ao exame físico: [achados]. Exames complementares: [resultados]. Qual a [conduta/diagnóstico/próximo passo]?",
    "options": ["alternativa A em português", "alternativa B em português", "alternativa C em português", "alternativa D em português", "alternativa E em português"],
    "correct_index": 0,
    "topic": "tema da questão em português",
    "explanation": "Explicação detalhada em português com referência bibliográfica, explicando cada alternativa..."
  }
]`;
}

async function generateBatch(
  topics: string[],
  count: number,
  difficulty: string,
  accessToken: string | undefined,
  specificTopic?: string,
  examBoard?: string,
  avoidStatements?: string[],
): Promise<SimQuestion[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/question-generator`,
    {
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
        timeoutMs: 55000,
        messages: [{ role: "user", content: buildPrompt(topics, count, difficulty, specificTopic, examBoard) }],
        ...(avoidStatements && avoidStatements.length > 0 ? { avoidStatements } : {}),
        generationContext: {
          specialty: topics[0] || "Clínica Médica",
          topic: topics.join(", "),
          subtopic: specificTopic || undefined,
          objective: "practice",
          difficulty: difficulty === "dificil" ? "hard" : difficulty === "facil" ? "easy" : difficulty === "misto" ? "mixed" : "medium",
          language: "pt-BR",
          source: "simulado",
        },
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(errBody.error || `Erro ${res.status}`);
  }

  const json = await res.json();

  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (Array.isArray(parsed.questions)) {
        const validated = filterValidQuestions(parsed.questions, { specialty: topics[0] });
        return mapQuestions(validated, topics);
      }
    } catch { /* fall through */ }
  }

  const content = json.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try { return mapQuestions(JSON.parse(jsonMatch[0]), topics); } catch { /* fall through */ }
  }

  const parsed = parseQuestionsFromText(content);
  if (parsed.length > 0) {
    return parsed.map((q) => ({
      statement: q.statement,
      options: q.options,
      correct: q.correctIndex,
      topic: q.topic || topics[0],
      explanation: q.explanation,
    }));
  }

  return [];
}

function sanitizeStatement(raw: string): string {
  // Remove trailing metadata (topic/subtopic/answer) that AI sometimes appends after the question mark
  let s = raw;
  const lastQ = s.lastIndexOf("?");
  if (lastQ > 0 && lastQ < s.length - 2) {
    const after = s.slice(lastQ + 1).trim();
    const lines = after.split("\n").filter((l) => l.trim());
    // If all trailing lines are short and don't contain clinical data, strip them
    if (
      lines.length > 0 &&
      lines.length <= 5 &&
      lines.every(
        (l) => l.trim().length < 100 && !/\d+\s*(mg|ml|mmHg|bpm|°C|%|U\/L|g\/dL|mEq|mmol)/.test(l),
      )
    ) {
      s = s.slice(0, lastQ + 1);
    }
  }
  return s.trim();
}

function mapQuestions(arr: any[], topics: string[]): SimQuestion[] {
  return (Array.isArray(arr) ? arr : [])
    .map((q: any) => {
      const options = Array.isArray(q.options) ? q.options.map(String) : [];
      const correctIdx = Number.isInteger(q.correct_index) ? q.correct_index : 0;
      return {
        statement: sanitizeStatement(String(q.statement || "")),
        options,
        correct: correctIdx >= 0 && correctIdx < options.length ? correctIdx : 0,
        topic: String(q.topic || topics[0]),
        explanation: String(q.explanation || ""),
      };
    })
    .filter(
      (q) =>
        q.options.length >= 4 &&
        q.statement.length > 10,
    );
}

function deduplicateQuestions(questions: SimQuestion[]): SimQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    // Use first 120 chars normalized for broader duplicate detection
    const key = q.statement.substring(0, 120).toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const Simulados = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshUserState();
  const studyCtx = useStudyContext();
  const autoStartedRef = useRef(false);

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
  const startTimeRef = useRef<Date>();
  const elapsedSecondsRef = useRef<number>(0);
  const configRef = useRef<any>(null);
  const [triResults, setTriResults] = useState<TRIQuestionResult[]>([]);
  const triParamsRef = useRef<TRIParams[]>([]);

  // ── Adaptive engine ──
  const adaptive = useAdaptiveSimulado();
  const [adaptivePreviewMeta, setAdaptivePreviewMeta] = useState<AdaptiveMeta | null>(null);
  const [adaptivePreviewLoading, setAdaptivePreviewLoading] = useState(false);

  const { pendingSession, checked, saveSession, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "simulados" });

  const examStateRef = useRef<any>(null);

  const getExamState = useCallback(() => {
    if (phase !== "exam") return {};
    return { phase, questions, selectedTopics, mode, examState: examStateRef.current };
  }, [phase, questions, selectedTopics, mode]);

  useEffect(() => {
    registerAutoSave(getExamState);
  }, [getExamState, registerAutoSave]);

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
    const timeLeft = isTimedMode
      ? (config.mode === "prova_real" || config.mode === "tri") && config.realExamProfile
        ? (EXAM_PROFILES[config.realExamProfile]?.timeMinutes || 300) * 60
        : qs.length * config.timePerQuestion * 60
      : 0;

    // Assign TRI params for TRI mode based on tagged difficulty
    if (config.mode === "tri") {
      const params: TRIParams[] = qs.map((q: any) => {
        const diffLevel = q._triDifficulty || "intermediario";
        return assignTRIParams(diffLevel);
      });
      triParamsRef.current = params;
    }

    setRestoredState({ timeLeft });
    startTimeRef.current = new Date();
    setPhase("exam");
  };

  const handleAcceptPartial = () => {
    if (questions.length > 0) {
      startExamWithQuestions(questions, configRef.current);
    }
  };

  const handleFetchAdaptivePreview = useCallback(async () => {
    if (!user?.id) return;
    setAdaptivePreviewLoading(true);
    try {
      const perf = await adaptive.fetchPerformance(user.id);
      // Do a quick dry-run to get meta
      const { data } = await supabase.functions.invoke("generate-adaptive-simulado", {
        body: { target_question_count: 5, performance: perf },
      });
      if (data?.meta) setAdaptivePreviewMeta(data.meta);
    } catch { /* silent */ }
    setAdaptivePreviewLoading(false);
  }, [user?.id, adaptive]);

  const handleStart = async (config: { topics: string[]; count: number; difficulty: string; timePerQuestion: number; mode: SimuladoMode; specificTopic?: string; examBoard?: string; realExamProfile?: string }) => {
    // ── Adaptive mode: delegate to edge function ──
    if (config.mode === "adaptativo") {
      setMode("adaptativo");
      setTargetCount(config.count);
      configRef.current = config;
      setPhase("loading");
      setLoadingProgress("Motor adaptativo analisando seu desempenho...");
      setLoadingPercent(20);

      try {
        if (user?.id && !adaptive.performance) {
          await adaptive.fetchPerformance(user.id);
        }
        setLoadingProgress("Gerando simulado personalizado...");
        setLoadingPercent(50);
        await adaptive.generateAdaptive(config.count);

        const adaptiveQs: SimQuestion[] = adaptive.questions.map(q => ({
          statement: q.statement,
          options: q.options,
          correct: q.correct,
          topic: q.topic,
          explanation: q.explanation,
          image_url: q.image_url,
          image_type: q.image_type,
          _isImageQuestion: q._isImageQuestion,
          _editorialGrade: q._editorialGrade,
          difficulty: q.difficulty,
          exam_style: q.exam_style,
          _source: q._source,
        } as SimQuestion));

        if (adaptiveQs.length === 0) {
          toast({ title: "Nenhuma questão adaptativa disponível. Tente outro modo.", variant: "destructive" });
          setPhase("setup");
          return;
        }

        setLoadingPercent(100);
        startExamWithQuestions(adaptiveQs, config);
        return;
      } catch {
        toast({ title: "Erro no motor adaptativo. Usando modo padrão.", variant: "destructive" });
        config = { ...config, mode: "estudo", topics: ["Clínica Médica", "Cirurgia", "Pediatria"], difficulty: "misto" };
      }
    }

    if (config.mode !== "adaptativo" && config.topics.length === 0) {
      toast({ title: "Selecione pelo menos um assunto", variant: "destructive" });
      return;
    }
    if (!config.count || config.count < 1 || config.count > 200) {
      toast({ title: "Número de questões inválido (1-200)", variant: "destructive" });
      return;
    }

    setSelectedTopics(config.topics);
    setMode(config.mode);
    setTargetCount(config.count);
    configRef.current = config;
    setPhase("loading");
    setLoadingPercent(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      // ── Motor Adaptativo: gerar blueprint baseado nos analytics do aluno ──
      let adaptiveBlueprint: AdaptiveBlueprint | null = null;
      try {
        if (user?.id) {
          adaptiveBlueprint = await generateAdaptiveBlueprint(user.id);
          console.info("[Adaptive] Blueprint gerado:", adaptiveBlueprint.imagePercent + "% imagem, insights:", adaptiveBlueprint.insights.length);
        }
      } catch { /* sem adaptação — fluxo segue normal */ }

      // ── Prova Real / TRI: generate per-topic with real distribution ──
      if ((config.mode === "prova_real" || config.mode === "tri") && config.realExamProfile) {
        const profile = EXAM_PROFILES[config.realExamProfile] || EXAM_PROFILES.GERAL;
        const topicDist = calculateTopicDistribution(profile, config.count);
        const diffSlots = calculateDifficultySlots(profile, config.count);

        let allQuestions: SimQuestion[] = [];
        const totalTopics = topicDist.length;

        for (let ti = 0; ti < totalTopics; ti++) {
          const { topic, count: topicCount } = topicDist[ti];
          setLoadingProgress(`Gerando ${topicCount} questões de ${topic}... (${ti + 1}/${totalTopics})`);
          setLoadingPercent(Math.round(((ti) / totalTopics) * 85));

          // Determine difficulty for this batch proportionally
          const easyForTopic = Math.round((diffSlots.easy / config.count) * topicCount);
          const hardForTopic = Math.round((diffSlots.hard / config.count) * topicCount);
          const mediumForTopic = topicCount - easyForTopic - hardForTopic;

          // Generate per difficulty slot for this topic
          const topicSlots = [
            { diff: "facil", n: easyForTopic },
            { diff: "intermediario", n: mediumForTopic },
            { diff: "dificil", n: hardForTopic },
          ].filter(s => s.n > 0);

          for (const slot of topicSlots) {
            try {
              const batch = await generateBatch(
                [topic], slot.n, slot.diff, accessToken,
                undefined, config.examBoard,
                allQuestions.map(q => q.statement.slice(0, 120)),
              );
              // Tag each question with its generated difficulty for TRI
              const taggedBatch = batch.map(q => ({ ...q, _triDifficulty: slot.diff as "facil" | "intermediario" | "dificil" }));
              allQuestions.push(...taggedBatch);
            } catch {
              // continue
            }
          }
        }

        // Inject image questions into prova real/TRI (adaptativo)
        try {
          const adaptiveImgPct = adaptiveBlueprint?.imagePercent ?? 15;
          const adaptiveDist = adaptiveBlueprint?.imageTypeDistribution ?? { ecg: 0.40, xray: 0.30, dermatology: 0.30 };
          const { slots: imgSlots } = calculateImageSlots(config.count, adaptiveImgPct, adaptiveDist);
          if (imgSlots.length > 0) {
            const imgQs = await selectImageQuestions(imgSlots, [], "simulado");
            const imgSim = imgQs.map(iq => {
              const sim = imageQuestionToSimQuestion(iq);
              return { statement: sim.statement, options: sim.options, correct: sim.correct_index, topic: sim.topic, explanation: sim.explanation, image_url: sim.image_url, image_type: sim.image_type, _isImageQuestion: sim._isImageQuestion, _imageQuestionId: sim._imageQuestionId, _editorialGrade: sim._editorialGrade } as SimQuestion;
            });
            allQuestions.push(...imgSim);
          }
        } catch { /* fallback sem imagem */ }

        setLoadingPercent(90);
        setLoadingProgress("Validando questões...");
        allQuestions = deduplicateQuestions(allQuestions);
        const finalQuestions = allQuestions.slice(0, config.count).sort(() => Math.random() - 0.5);

        if (finalQuestions.length === 0) {
          toast({ title: "Erro ao gerar prova real. Tente novamente.", variant: "destructive" });
          setPhase("setup");
          return;
        }

        if (finalQuestions.length < config.count * 0.7) {
          setQuestions(finalQuestions);
          setPartialCount(finalQuestions.length);
          setPhase("partial");
          return;
        }

        setLoadingPercent(100);
        startExamWithQuestions(finalQuestions, config);
        return;
      }

      // ── Step 1: Fetch previously answered question IDs ──
      setLoadingProgress("Verificando questões já respondidas...");
      const { data: pastAttempts } = await supabase
        .from("practice_attempts")
        .select("question_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      const answeredIds = new Set((pastAttempts || []).map((a) => a.question_id));

      // ── Step 2: Fetch questions from bank matching topics ──
      setLoadingProgress("Buscando questões do banco...");
      setLoadingPercent(10);

      const topicFilters = config.topics.map((t) => `topic.ilike.%${t}%`).join(",");
      const { data: bankData } = await supabase
        .from("questions_bank")
        .select("id, statement, options, correct_index, topic, explanation, source, image_url")
        .or(topicFilters)
        .eq("review_status", "approved")
        .limit(500);

      const bankQuestions: SimQuestion[] = (bankData || [])
        .filter((q: any) => !answeredIds.has(q.id))
        .map((q: any) => ({
          statement: String(q.statement || ""),
          options: Array.isArray(q.options) ? q.options.map(String) : [],
          correct: Number.isInteger(q.correct_index) ? q.correct_index : 0,
          topic: String(q.topic || config.topics[0]),
          explanation: String(q.explanation || ""),
          bankId: q.id,
          source: q.source || null,
        }))
        .filter(
          (q) =>
            q.options.length >= 4 &&
            q.statement.length > 10 &&
            !NON_MEDICAL_CONTENT_REGEX.test(q.statement) &&
            !(/\b(imagem abaixo|figura abaixo|vide imagem|observe a imagem|na imagem|na figura|ECG abaixo|tomografia abaixo|radiografia abaixo|imagem a seguir|figura a seguir|conforme a imagem|conforme a figura)\b/i.test(q.statement) && !(q as any).image_url),
        )
        .sort((a, b) => {
          const priorityDiff = getSourcePriority(a.source) - getSourcePriority(b.source);
          return priorityDiff !== 0 ? priorityDiff : Math.random() - 0.5;
        });

      setLoadingPercent(25);
      const bankCount = Math.min(bankQuestions.length, config.count);
      const selectedFromBank = bankQuestions.slice(0, bankCount);
      let deficit = config.count - selectedFromBank.length;

      // ── Step 2.5: Inject image questions (adaptive or default 20%) ──
      let imageSimQuestions: SimQuestion[] = [];
      try {
        const IMAGE_PERCENT = (config as any).imagePercent ?? adaptiveBlueprint?.imagePercent ?? 20;
        const imgDist = adaptiveBlueprint?.imageTypeDistribution ?? { ecg: 0.20, xray: 0.20, dermatology: 0.15, ct: 0.15, us: 0.10, pathology: 0.10, ophthalmology: 0.10 };
        const { slots, fallbackCount } = calculateImageSlots(config.count, IMAGE_PERCENT, imgDist);
        if (fallbackCount > 0) {
          console.info(`[Simulados] ${fallbackCount} questões de imagem substituídas por fallback textual`);
        }
        if (slots.length > 0) {
          setLoadingProgress("Buscando questões com imagem...");
          const imageQuestions = await selectImageQuestions(slots, [], "treino");
          imageSimQuestions = imageQuestions.map(iq => {
            const sim = imageQuestionToSimQuestion(iq);
            return {
              statement: sim.statement,
              options: sim.options,
              correct: sim.correct_index,
              topic: sim.topic,
              explanation: sim.explanation,
              image_url: sim.image_url,
              image_type: sim.image_type,
              _isImageQuestion: sim._isImageQuestion,
              _imageQuestionId: sim._imageQuestionId,
              _editorialGrade: sim._editorialGrade,
            };
          });
          deficit = Math.max(0, deficit - imageSimQuestions.length);
        }
      } catch (imgErr) {
        console.warn("[Simulados] Fallback: sem questões de imagem", imgErr);
      }

      const imageLabel = imageSimQuestions.length > 0 ? ` + ${imageSimQuestions.length} com imagem` : "";
      setLoadingProgress(`${selectedFromBank.length} questões do banco${imageLabel}. ${deficit > 0 ? `Gerando ${deficit} via IA...` : "Pronto!"}`);

      // ── Step 3: Generate remaining via AI if needed ──
      let allQuestions: SimQuestion[] = [...selectedFromBank, ...imageSimQuestions];

      if (deficit > 0) {
        const requestCount = Math.ceil(deficit * 1.8);

        // Sequential generation with anti-repetition context
        const batchCount = Math.ceil(requestCount / BATCH_SIZE);
        const batchSizes = Array.from({ length: batchCount }, (_, i) => {
          const remaining = requestCount - i * BATCH_SIZE;
          return Math.min(BATCH_SIZE, remaining);
        });

        for (let i = 0; i < batchSizes.length; i++) {
          const size = batchSizes[i];
          const pctBase = 25;
          const pctRange = 55;
          setLoadingPercent(pctBase + Math.round((i / batchSizes.length) * pctRange));
          setLoadingProgress(`Gerando lote ${i + 1}/${batchSizes.length}...`);

          // Collect summaries for anti-repetition
          const avoidStatements = allQuestions.map((q) => q.statement.slice(0, 120));

          try {
            const batch = await generateBatch(config.topics, size, config.difficulty, accessToken, config.specificTopic, config.examBoard, avoidStatements.length > 0 ? avoidStatements : undefined);
            allQuestions.push(...batch);
          } catch {
            // continue with next batch
          }
        }

        // Complement if still short — up to 5 retry attempts
        for (let retryIdx = 0; retryIdx < 5 && allQuestions.length < config.count; retryIdx++) {
          const gap = config.count - allQuestions.length;
          setLoadingProgress(`Complementando... tentativa ${retryIdx + 1}/5 (${allQuestions.length}/${config.count})`);
          setLoadingPercent(85 + retryIdx * 2);
          try {
            const avoidStatements = allQuestions.map((q) => q.statement.slice(0, 120));
            const retry = await generateBatch(
              config.topics,
              Math.min(gap + 3, BATCH_SIZE),
              config.difficulty,
              accessToken,
              config.specificTopic,
              config.examBoard,
              avoidStatements,
            );
            allQuestions.push(...retry);
          } catch {
            // accept partial
          }
        }
      }

      setLoadingPercent(90);
      setLoadingProgress("Validando e filtrando questões...");

      // Deduplicate
      allQuestions = deduplicateQuestions(allQuestions);

      if (allQuestions.length === 0) {
        toast({ title: "Erro ao gerar questões. Tente novamente.", variant: "destructive" });
        setPhase("setup");
        return;
      }

      const finalQuestions = allQuestions.slice(0, config.count);

      // If we got significantly fewer than requested, offer partial
      if (finalQuestions.length < config.count && finalQuestions.length < config.count * 0.8) {
        setQuestions(finalQuestions);
        setPartialCount(finalQuestions.length);
        setPhase("partial");
        return;
      }

      setLoadingPercent(100);
      startExamWithQuestions(finalQuestions, config);
    } catch (err: any) {
      toast({ title: "Erro ao gerar simulado", description: err.message, variant: "destructive" });
      setPhase("setup");
    }
  };


  // Auto-start quando vindo do daily-plan / cockpit / banco-de-erros com contexto de prática
  useEffect(() => {
    if (
      autoStartedRef.current ||
      !studyCtx ||
      !checked ||
      pendingSession ||
      phase !== "setup"
    ) return;

    const allowedSources = new Set([
      "daily-plan",
      "weak-topics",
      "error-bank",
      "mission",
      "planner",
    ]);
    if (!allowedSources.has(studyCtx.source) || studyCtx.taskType !== "practice") return;

    const urlCount = Number(new URLSearchParams(window.location.search).get("sc_count"));
    const count = Number.isFinite(urlCount) && urlCount > 0 ? urlCount : studyCtx.source === "daily-plan" ? 20 : 10;

    autoStartedRef.current = true;
    handleStart({
      topics: [studyCtx.specialty || studyCtx.topic || "Clínica Médica"],
      count,
      difficulty: studyCtx.difficulty || "misto",
      timePerQuestion: 3,
      mode: "estudo",
      specificTopic: studyCtx.topic,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyCtx, checked, pendingSession, phase]);

  const handleFinish = useCallback(async (answers: Record<number, number>, flagged: number[]) => {
    setFinalAnswers(answers);
    setFlaggedQuestions(flagged);

    if (startTimeRef.current) {
      elapsedSecondsRef.current = Math.round((Date.now() - startTimeRef.current.getTime()) / 1000);
    }

    // Compute TRI results if in TRI mode
    if (mode === "tri" && triParamsRef.current.length === questions.length) {
      const initialTheta = 0; // Could fetch from history
      const results: TRIQuestionResult[] = questions.map((q, i) => {
        const params = triParamsRef.current[i];
        const correct = answers[i] === q.correct;
        return {
          index: i,
          correct,
          params,
          probability: triProbability(initialTheta, params),
          informationValue: itemInformation(initialTheta, params),
        };
      });
      setTriResults(results);
    }

    if (user) {
      const areaResults: Record<string, { correct: number; total: number }> = {};
      let correctCount = 0;
      questions.forEach((q, i) => {
        if (!areaResults[q.topic]) areaResults[q.topic] = { correct: 0, total: 0 };
        areaResults[q.topic].total++;
        const isCorrect = answers[i] === q.correct;
        if (isCorrect) {
          areaResults[q.topic].correct++;
          correctCount++;
        }
      });

      const finalScore = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

      await supabase.from("exam_sessions").insert({
        user_id: user.id,
        title: `${mode === "tri" ? "🧠 TRI" : mode === "prova_real" ? "🏆 Prova Real" : mode === "extremo" ? "🔥 Prova Extrema" : "Simulado"} - ${selectedTopics.slice(0, 3).join(", ")}${selectedTopics.length > 3 ? "..." : ""}`,
        total_questions: questions.length,
        time_limit_minutes: Math.round(elapsedSecondsRef.current / 60),
        status: "finished",
        finished_at: new Date().toISOString(),
        answers_json: answers,
        results_json: areaResults,
        score: finalScore,
      });

      // Salva tentativas para o anti-repetição entre sessões
      const practiceRows = questions
        .map((q, i) => {
          if (!q.bankId) return null;
          return {
            user_id: user.id,
            question_id: q.bankId,
            correct: answers[i] === q.correct,
          };
        })
        .filter(Boolean);

      if (practiceRows.length > 0) {
        const { error: attemptsError } = await supabase.from("practice_attempts").insert(practiceRows as any[]);
        if (attemptsError) {
          console.error("Erro ao salvar tentativas do simulado:", attemptsError);
        }
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (answers[i] !== undefined && answers[i] !== q.correct) {
          await logErrorToBank({
            userId: user.id,
            tema: q.topic || "Clínica Médica",
            tipoQuestao: "simulado",
            conteudo: q.statement,
            motivoErro: `Marcou "${q.options[answers[i]]}" — Correta: "${q.options[q.correct]}"`,
            categoriaErro: "conceito",
          });
        }
      }

      await addXp(XP_REWARDS.simulado_completed);

      const domainEntries = questions.map((q, i) => ({
        topic: q.topic,
        correct: answers[i] === q.correct,
      }));
      await updateDomainMap(user.id, domainEntries);

      // ── Register medical_image_attempts for image questions → feeds visual_skill_snapshots ──
      const imageQuestions = questions.filter((q: any) => q._isImageQuestion && q.image_type);
      if (imageQuestions.length > 0) {
        const imgAttempts = imageQuestions.map((q: any, _qi) => {
          const origIdx = questions.indexOf(q);
          const timePerQ = elapsedSecondsRef.current > 0 ? Math.round(elapsedSecondsRef.current / questions.length) : 30;
          return {
            user_id: user.id,
            image_id: q._imageQuestionId || q.bankId || q.statement.slice(0, 36),
            selected_index: answers[origIdx] ?? -1,
            correct: answers[origIdx] === q.correct,
            time_seconds: timePerQ,
            image_type: q.image_type,
            question_id: q._imageQuestionId || null,
          };
        });
        await supabase.from("medical_image_attempts").insert(imgAttempts as any[]).then(({ error }) => {
          if (error) console.warn("[Simulado] image_attempts insert:", error.message);
        });

        // Call study-complete for each image type to update visual_skill_snapshots.
        // Also propagates decisionId when the simulado was launched from an
        // orchestrator recommendation (URL ?did=) — closes the adaptive loop.
        const imageTypes = [...new Set(imageQuestions.map((q: any) => q.image_type))];
        const did = (typeof window !== "undefined")
          ? new URLSearchParams(window.location.search).get("did") || undefined
          : undefined;
        for (const imgType of imageTypes) {
          try {
            await supabase.functions.invoke("study-complete", {
              body: {
                actionType: "image_quiz",
                topicId: imgType,
                themeId: imgType,
                metadata: {
                  originModule: "image_quiz",
                  imageType: imgType,
                  source: "simulado",
                  decisionId: did,
                },
              },
            });
          } catch { /* non-blocking */ }
        }
      }
    }

    await completeSession();
    if (user?.id) {
      const topicsSummary = questions.map(q => q.topic).filter(Boolean).join(", ").slice(0, 100) || "Simulado";
      await completeStudyAction({
        userId: user.id,
        taskType: "simulado",
        topic: topicsSummary,
        source: "auto",
        originModule: "simulados",
      });
    }

    // ── Modality Analytics (passive) ──
    if (user) {
      try {
        const analyticsEvents: QuestionAnalyticsEvent[] = questions.map((q, i) => {
          const { mode, imageType } = classifyQuestionMode(q);
          return {
            userId: user.id,
            questionIndex: i,
            questionId: (q as any).bankId || (q as any)._imageQuestionId || undefined,
            bankQuestionId: (q as any).bankId || undefined,
            imageQuestionId: (q as any)._imageQuestionId || undefined,
            mode,
            imageType,
            specialty: q.topic || undefined,
            difficulty: (q as any)._triDifficulty || (q as any).difficulty || undefined,
            examStyle: (q as any).exam_style || undefined,
            selectedAnswer: answers[i] ?? undefined,
            correctAnswer: q.correct,
            isCorrect: answers[i] === q.correct,
          };
        });
        recordQuestionAnalyticsBatch(analyticsEvents).catch(console.error);
      } catch (analyticsErr) {
        console.warn("[ModalityAnalytics] Non-blocking error:", analyticsErr);
      }
    }

    refresh("session");
    setPhase("finished");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, user, mode]);

  const handleRetryErrors = async (sessionIdOrVoid?: string) => {
    if (sessionIdOrVoid) {
      const { data } = await supabase
        .from("exam_sessions")
        .select("answers_json, results_json, score, total_questions")
        .eq("id", sessionIdOrVoid)
        .single();

      if (!data) {
        toast({ title: "Sessão não encontrada", variant: "destructive" });
        return;
      }
      toast({ title: "Funcionalidade em breve", description: "A revisão de erros do histórico estará disponível em breve.", variant: "default" });
      return;
    }

    const errorQuestions = questions.filter((q, i) => finalAnswers[i] !== q.correct);
    if (errorQuestions.length === 0) return;

    setQuestions(errorQuestions);
    setFinalAnswers({});
    setFlaggedQuestions([]);
    setRestoredState({ timeLeft: (mode === "prova" || mode === "extremo") ? errorQuestions.length * 3 * 60 : 0 });
    startTimeRef.current = new Date();
    setPhase("exam");
  };

  const handleNewSimulado = () => {
    setPhase("setup");
    setQuestions([]);
    setFinalAnswers({});
    setFlaggedQuestions([]);
    setRestoredState(null);
    setTriResults([]);
    triParamsRef.current = [];
  };

  if (phase === "setup") {
    return (
      <SimuladoSetup
        onStart={handleStart}
        onResumeSession={handleResumeSession}
        onDiscardSession={abandonSession}
        onRetryErrors={handleRetryErrors}
        pendingSession={pendingSession}
        checkedSession={checked}
        userId={user?.id}
      />
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in gap-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">{loadingProgress || "Gerando questões..."}</p>
        <div className="w-64">
          <Progress value={loadingPercent} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground">{loadingPercent}% concluído</p>
      </div>
    );
  }

  if (phase === "partial") {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in gap-4 max-w-md mx-auto text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-semibold text-foreground">Geração parcial</h2>
        <p className="text-muted-foreground">
          Foram geradas <strong>{partialCount}</strong> de <strong>{targetCount}</strong> questões solicitadas.
          Deseja continuar com as questões disponíveis?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleNewSimulado}>Cancelar</Button>
          <Button onClick={handleAcceptPartial}>Continuar com {partialCount} questões</Button>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    if (mode === "tri" && triResults.length > 0) {
      return (
        <TRIResult
          questions={questions}
          selectedAnswers={finalAnswers}
          triResults={triResults}
          onNewSimulado={handleNewSimulado}
          onRetryErrors={() => handleRetryErrors()}
          flaggedQuestions={flaggedQuestions}
          elapsedSeconds={elapsedSecondsRef.current}
          realExamProfile={configRef.current?.realExamProfile || "GERAL"}
        />
      );
    }
    return (
      <SimuladoResult
        questions={questions}
        selectedAnswers={finalAnswers}
        onNewSimulado={handleNewSimulado}
        onRetryErrors={() => handleRetryErrors()}
        flaggedQuestions={flaggedQuestions}
        mode={mode}
        elapsedSeconds={elapsedSecondsRef.current}
        realExamProfile={configRef.current?.realExamProfile}
        adaptiveMeta={adaptive.meta}
      />
    );
  }

  return (
    <SimuladoExam
      key="simulado-exam-stable"
      questions={questions}
      timeSeconds={restoredState?.timeLeft ?? ((mode === "prova" || mode === "extremo" || mode === "tri") ? questions.length * 3 * 60 : 0)}
      onFinish={handleFinish}
      onAutoSaveState={() => ({ current: 0, selectedAnswers: {}, timeLeft: 0 })}
      onStateChange={(state) => { examStateRef.current = state; }}
      initialState={restoredState ? {
        current: restoredState.current ?? 0,
        selectedAnswers: restoredState.selectedAnswers ?? {},
        timeLeft: restoredState.timeLeft,
        flaggedQuestions: restoredState.flaggedQuestions,
        revealedQuestions: restoredState.revealedQuestions,
      } : undefined}
      mode={mode}
    />
  );
};

export default Simulados;
