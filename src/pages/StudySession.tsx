import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTelemetry } from "@/hooks/useTelemetry";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen, Brain, HelpCircle, MessageSquare, BarChart3,
  Send, Loader2, GraduationCap, Play, RotateCcw, Stethoscope,
  FileText, AlertTriangle, TrendingUp, Target, Maximize2, Minimize2, MoreVertical, Sparkles, ChevronLeft
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";

import StudyStyleSelector, { type StudyMode } from "@/components/tutor/StudyStyleSelector";
import TutorChatPanel from "@/components/study/TutorChatPanel";
import OperationalHub from "@/components/study/OperationalHub";
import { parseStudySignal, stripStudySignal, type StudySignal } from "@/lib/parseStudySignal";
import {
  invokeStudyCompleteWithRetry,
  flushStudyCompleteQueue,
} from "@/lib/studyCompleteRetryQueue";

type Phase = "start" | "style-select" | "performance" | "lesson" | "active-recall" | "questions" | "discussion" | "discursive" | "scoring" | "reinforcement";
type Msg = { role: "user" | "assistant"; content: string };

interface SpecialtyScore {
  name: string;
  score: number;
  total: number;
}

interface PerformanceData {
  totalQuestions: number;
  correctAnswers: number;
  level: string;
  readiness: number;
  specialties: SpecialtyScore[];
  weakTopics: string[];
  studiedTopics: string[];
}

const PHASE_META: Record<Phase, { label: string; icon: typeof BookOpen; shortLabel: string }> = {
  start: { label: "Início", icon: Play, shortLabel: "Início" },
  "style-select": { label: "Estilo", icon: Play, shortLabel: "Estilo" },
  performance: { label: "📊 Painel", icon: BarChart3, shortLabel: "Painel" },
  lesson: { label: "📚 Aula", icon: BookOpen, shortLabel: "Aula" },
  "active-recall": { label: "🧠 Recall", icon: Brain, shortLabel: "Recall" },
  questions: { label: "📝 Questões", icon: HelpCircle, shortLabel: "MCQ" },
  discussion: { label: "🔬 Discussão", icon: MessageSquare, shortLabel: "Discussão" },
  discursive: { label: "🏥 Caso Discursivo", icon: Stethoscope, shortLabel: "Discursivo" },
  scoring: { label: "📈 Pontuação", icon: TrendingUp, shortLabel: "Score" },
  reinforcement: { label: "💡 Reforço", icon: AlertTriangle, shortLabel: "Reforço" },
};

const FLOW_PHASES: Phase[] = ["performance", "lesson", "active-recall", "questions", "discussion", "discursive", "scoring"];

const INITIAL_PERFORMANCE: PerformanceData = {
  totalQuestions: 0,
  correctAnswers: 0,
  level: "Iniciante",
  readiness: 0,
  specialties: [
    { name: "Cardiologia", score: 0, total: 0 },
    { name: "Pneumologia", score: 0, total: 0 },
    { name: "Neurologia", score: 0, total: 0 },
    { name: "Endocrinologia", score: 0, total: 0 },
    { name: "Gastroenterologia", score: 0, total: 0 },
    { name: "Pediatria", score: 0, total: 0 },
    { name: "Ginecologia/Obstetrícia", score: 0, total: 0 },
    { name: "Cirurgia", score: 0, total: 0 },
    { name: "Medicina Preventiva", score: 0, total: 0 },
  ],
  weakTopics: [],
  studiedTopics: [],
};

const SUGGESTED_TOPICS = [
  "Insuficiência Cardíaca", "TEP", "AVC", "Diabetes Mellitus",
  "Pneumonia", "Asma", "Apendicite", "Pré-eclâmpsia",
  "IAM", "DPOC", "Sepse", "Meningite",
];

const StudySession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { trackAction } = useTelemetry();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("full");
  const [phase, setPhase] = useState<Phase>("start");
  const [topic, setTopic] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [performance, setPerformance] = useState<PerformanceData>(INITIAL_PERFORMANCE);
  // Painel de Desempenho fechado por padrão — abre como drawer sob demanda.
  // Reduz a poluição visual e dá foco total ao conteúdo da sessão.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [professorContext, setProfessorContext] = useState<{ topics: string; materialUrl?: string; assignmentId?: string } | null>(null);
  const [reinforcementCycles, setReinforcementCycles] = useState<Record<string, number>>({});
  const [preReinforcementPhase, setPreReinforcementPhase] = useState<Phase>("questions");
  const [targetExam, setTargetExam] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const streamAbortRef = useRef<AbortController | null>(null);
  const reinforcementAbortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstQuestionTrackedRef = useRef(false);
  const sessionCompleteTrackedRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const getStudySessionHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }, []);

  // Load target exam from profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("target_exam").eq("user_id", user.id).single()
      .then(({ data }) => {
        const d = data as any;
        if (Array.isArray(d?.target_exams) && d.target_exams.length > 0) {
          setTargetExam(d.target_exams[0]);
        } else if (d?.target_exam) {
          setTargetExam(d.target_exam as string);
        }
      });
  }, [user]);

  // Read query params (professor context + cockpit deep-link)
  useEffect(() => {
    const paramTopic = searchParams.get("topic");
    const paramProfessorTopics = searchParams.get("professorTopics");
    const paramMaterialUrl = searchParams.get("materialUrl");
    const paramAssignmentId = searchParams.get("assignmentId");

    if (paramTopic && paramProfessorTopics) {
      setTopicInput(paramTopic);
      setProfessorContext({
        topics: paramProfessorTopics,
        materialUrl: paramMaterialUrl || undefined,
        assignmentId: paramAssignmentId || undefined,
      });
    } else if (paramTopic) {
      // Deep-link from cockpit / weakness — preload topic field
      setTopicInput(paramTopic);
      setTopic(paramTopic);
    }
  }, [searchParams]);

  // Auto-start study when arriving via cockpit deep-link (?topic=...&auto=1 or origin=cockpit)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    const paramTopic = searchParams.get("topic");
    const paramAuto = searchParams.get("auto");
    const paramOrigin = searchParams.get("origin");
    const paramFocus = searchParams.get("focus");
    const shouldAuto =
      paramTopic &&
      phase === "start" &&
      (paramAuto === "1" || paramAuto === "true" || paramOrigin === "cockpit" || paramOrigin === "guided");

    if (shouldAuto) {
      autoStartedRef.current = true;
      setTopic(paramTopic);
      setTopicInput(paramTopic);
      // If focused on review/errors, jump straight to a "review" or "correction" mode
      const mode: StudyMode = paramFocus === "reviews" ? "review" : paramFocus === "errors" ? "correction" : "full";
      // Tiny delay so state settles before triggering
      trackAction('study_session_started', { topic: paramTopic, mode });
      const t = setTimeout(() => {
        handleStyleSelect(mode, paramTopic);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [searchParams, phase]);

  const {
    pendingSession, checked: sessionChecked, saveSession: persistSession,
    completeSession, abandonSession, registerAutoSave, clearPending,
  } = useSessionPersistence({ moduleKey: "study-session" });

  // Register auto-save
  useEffect(() => {
    registerAutoSave(() => {
      if (phase === "start" || messages.length === 0) return {};
      return { messages, phase, topic, performance };
    });
  }, [registerAutoSave, messages, phase, topic, performance]);

  const handleRestoreSession = () => {
    if (!pendingSession) return;
    const data = pendingSession.session_data as any;
    if (data.messages) setMessages(data.messages);
    if (data.phase) setPhase(data.phase);
    if (data.topic) { setTopic(data.topic); setTopicInput(data.topic); }
    if (data.performance) setPerformance(data.performance);
    clearPending();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamAbortRef.current?.abort();
      reinforcementAbortRef.current?.abort();
      if (firstQuestionTrackedRef.current && !sessionCompleteTrackedRef.current) {
        const duration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
        const completed = performance.totalQuestions >= 3;
        try {
          telemetry.track(completed ? 'study_session_completed' : 'study_session_abandoned', {
            topic, mode: studyMode, duration_seconds: duration, questions_answered: performance.totalQuestions, correct_answers: performance.correctAnswers,
          });
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drain any pending study-complete retries from past failures (network, reload).
  useEffect(() => {
    if (!user) return;
    flushStudyCompleteQueue()
      .then((r) => {
        if (r.flushed > 0) console.info(`[StudySession] flushed ${r.flushed} pending study-complete retries`);
      })
      .catch(() => {});
  }, [user]);

  // Load performance from real database
  useEffect(() => {
    if (!user) return;
    const loadPerformance = async () => {
      try {
        // Load practice attempts stats
        const { count: totalCount } = await supabase
          .from("practice_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        const { count: correctCount } = await supabase
          .from("practice_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("correct", true);

        const total = totalCount || 0;
        const correct = correctCount || 0;
        const accuracy = total > 0 ? (correct / total) * 100 : 0;
        const level = accuracy < 30 ? "Iniciante" : accuracy < 70 ? "Intermediário" : "Avançado";
        const readiness = Math.min(100, Math.round(accuracy * 0.7 + Math.min(total, 100) * 0.3));

        // Load domain map
        const { data: domains } = await supabase
          .from("medical_domain_map")
          .select("specialty, domain_score, questions_answered, correct_answers")
          .eq("user_id", user.id);

        const specialties: SpecialtyScore[] = (domains || []).map((d) => ({
          name: d.specialty,
          score: d.correct_answers,
          total: d.questions_answered,
        }));

        // Fill missing specialties
        const defaultSpecialties = ["Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia", "Gastroenterologia", "Pediatria", "Ginecologia/Obstetrícia", "Cirurgia", "Medicina Preventiva"];
        for (const s of defaultSpecialties) {
          if (!specialties.find((sp) => sp.name === s)) {
            specialties.push({ name: s, score: 0, total: 0 });
          }
        }

        // Load weak topics from error_bank
        const { data: errors } = await supabase
          .from("error_bank")
          .select("tema")
          .eq("user_id", user.id)
          .eq("dominado", false)
          .order("vezes_errado", { ascending: false })
          .limit(10);
        const weakTopics = (errors || []).map((e) => e.tema);

        // Load studied topics from database
        const { data: studiedData } = await supabase
          .from("temas_estudados")
          .select("tema")
          .eq("user_id", user.id)
          .eq("fonte", "tutor-ia")
          .order("created_at", { ascending: false })
          .limit(50);
        const studiedTopics = (studiedData || []).map((t) => t.tema);

        setPerformance({ totalQuestions: total, correctAnswers: correct, level, readiness, specialties, weakTopics, studiedTopics });
      } catch (err) {
        console.error("Error loading performance:", err);
      }
    };
    loadPerformance();
  }, [user]);

  const savePerformance = useCallback(async (data: PerformanceData) => {
    setPerformance(data);
    if (user && data.studiedTopics.length > 0) {
      const latestTopic = data.studiedTopics[data.studiedTopics.length - 1];
      try {
        // Check if topic already exists
        const { data: existing } = await supabase
          .from("temas_estudados")
          .select("id")
          .eq("user_id", user.id)
          .eq("tema", latestTopic)
          .eq("fonte", "tutor-ia")
          .maybeSingle();
        if (!existing) {
          await supabase.from("temas_estudados").insert({
            user_id: user.id,
            tema: latestTopic,
            especialidade: "Geral",
            fonte: "tutor-ia",
            status: "ativo",
          });
        }
      } catch (err) {
        console.error("Error saving studied topic:", err);
      }
    }
  }, [user]);

  // Detect MCQ answers using STRUCTURED SIGNAL (no more emoji/regex).
  // The edge function `study-session` injects a <!--SIGNAL-->{...}<!--/SIGNAL--> block
  // at the end of correction messages. We trust ONLY that block.
  const detectAndRegisterMCQ = useCallback(async (assistantContent: string, userAnswer: string) => {
    if (!user || !topic) return;

    const signal: StudySignal | null = parseStudySignal(assistantContent);
    if (!signal) {
      // No structured signal → don't fabricate a pedagogical signal from text.
      // We log the miss so we can audit prompt drift later.
      const looksLikeAnswer = /^[A-Ea-e]$/.test(userAnswer.trim());
      if (looksLikeAnswer) {
        console.warn("[StudySession] missing SIGNAL block on correction message");
      }
      return;
    }
    if (signal.confidence < 0.4) {
      console.warn("[StudySession] SIGNAL confidence too low — skipping persistence", signal);
      return;
    }

    const correct = signal.wasCorrect;
    const subtopic = signal.subtopic || searchParams.get("subtopic") || undefined;
    const errorCategory = signal.errorCategory;
    trackAction('first_answer_submitted', { topic, correct, subtopic, error_category: errorCategory, confidence: signal.confidence });

    // Rastreamento pedagógico para automação ENAFLIX
    try {
      const { trackStudyActivity } = await import("@/lib/educationalEngine");
      trackStudyActivity({
        userId: user.id,
        topic,
        questionsCount: 1,
        errorsCount: correct ? 0 : 1,
        interactionCount: 1,
        studyTimeSeconds: 120, // Sessão de tutor é mais profunda
      });
    } catch (err) {
      console.error("ENAFLIX tracking failed:", err);
    }

    try {
      // Update local domain map (lightweight; not adaptive critical-path)
      const { updateDomainMap } = await import("@/lib/updateDomainMap");
      await updateDomainMap(user.id, [{ topic, correct }]);

      // ── SINGLE point of persistence: study-complete ──
      // Feeds error_bank, FSRS card, temas_estudados AND orchestrator_outcomes
      // (when decisionId is present). Has its own retry queue on failure.
      const decisionId = searchParams.get("did") || undefined;
      await invokeStudyCompleteWithRetry({
        actionType: "free_study",
        topicId: topic,
        themeId: topic,
        wasCorrect: correct,
        metadata: {
          originModule: "study-session",
          source: "tutor-ia-mcq",
          subtopic,
          decisionId,
          errorCategory: correct ? undefined : errorCategory,
          questionText: signal.feedbackShort,
          confidence: signal.confidence,
          correctLetter: signal.correctLetter,
          detectedAnswer: signal.detectedAnswer,
        },
      });

      if (!correct && signal.shouldReinforce) {
        // Trigger reinforcement loop if under max cycles
        const currentCycles = reinforcementCycles[topic] || 0;
        if (currentCycles < 2 && phase !== "reinforcement") {
          const nextCycle = currentCycles + 1;
          setReinforcementCycles(prev => ({ ...prev, [topic]: nextCycle }));
          setPreReinforcementPhase(phase);

          setTimeout(async () => {
            setPhase("reinforcement");
            const reinforceMsg: Msg = {
              role: "user",
              content: `Errei a questão sobre ${topic}. Preciso de reforço rápido.`,
            };
            const newMsgs = [...messages, { role: "assistant" as const, content: assistantContent }, reinforceMsg];
            setMessages(newMsgs);

            const reinforcementPerf = {
              ...performance,
              reinforcement: {
                topic,
                categoriaErro: errorCategory,
                content: (signal.feedbackDetailed || assistantContent).slice(0, 500),
                cycle: nextCycle,
              },
            };
            setIsLoading(true);
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-session`;
            try {
              const headers = await getStudySessionHeaders();
              const resp = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  messages: newMsgs,
                  phase: "reinforcement",
                  topic,
                  performanceData: reinforcementPerf,
                  studyMode,
                  targetExam,
                }),
              });
              if (resp.ok) {
                const reader = resp.body!.getReader();
                const decoder = new TextDecoder();
                let buf = "";
                let content = "";
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += decoder.decode(value, { stream: true });
                  let idx2: number;
                  while ((idx2 = buf.indexOf("\n")) !== -1) {
                    let line = buf.slice(0, idx2);
                    buf = buf.slice(idx2 + 1);
                    if (line.endsWith("\r")) line = line.slice(0, -1);
                    if (!line.startsWith("data: ")) continue;
                    const json = line.slice(6).trim();
                    if (json === "[DONE]") break;
                    try {
                      const parsed = JSON.parse(json);
                      const delta = parsed.choices?.[0]?.delta?.content;
                      if (delta) {
                        content += delta;
                        setMessages(prev => {
                          const last = prev[prev.length - 1];
                          if (last?.role === "assistant") {
                            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
                          }
                          return [...prev, { role: "assistant", content }];
                        });
                      }
                    } catch {}
                  }
                }
              }
            } catch (e) {
              console.error("Reinforcement error:", e);
            }
            setIsLoading(false);
          }, 1500);
        }
      }

      // Update local performance
      setPerformance(prev => {
        const newTotal = prev.totalQuestions + 1;
        const newCorrect = prev.correctAnswers + (correct ? 1 : 0);
        const accuracy = (newCorrect / newTotal) * 100;
        return {
          ...prev,
          totalQuestions: newTotal,
          correctAnswers: newCorrect,
          level: accuracy < 30 ? "Iniciante" : accuracy < 70 ? "Intermediário" : "Avançado",
          readiness: Math.min(100, Math.round(accuracy * 0.7 + Math.min(newTotal, 100) * 0.3)),
          weakTopics: !correct && !prev.weakTopics.includes(topic) ? [...prev.weakTopics, topic] : prev.weakTopics,
        };
      });
    } catch (err) {
      console.error("Error registering MCQ attempt:", err);
    }
  }, [user, topic, reinforcementCycles, phase, messages, performance, studyMode, searchParams, getStudySessionHeaders, targetExam]);

  const streamChat = async (msgs: Msg[], currentPhase: Phase, currentTopic: string) => {
    if (!mountedRef.current) return;
    console.debug("[StudySession] streamChat called", { currentPhase, currentTopic, msgsCount: msgs.length });
    
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setIsLoading(true);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-session`;

    try {
      const headers = await getStudySessionHeaders();
      if (!mountedRef.current) return;
      console.debug("[StudySession] invoking study-session function...");
      
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: msgs,
          phase: currentPhase,
          topic: currentTopic,
          performanceData: performance,
          studyMode,
          targetExam,
        }),
        signal: controller.signal,
      });

      console.debug("[StudySession] study-session response received", { status: resp.status, ok: resp.ok });

      if (!resp.ok) {
        const contentType = resp.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
          console.error("[StudySession] study-session function error JSON:", err);
          if (!mountedRef.current) return;
          
          if (err.isFallbackActive) {
            console.info("[StudySession] Fallback active via JSON response");
            if (err.fallbackContent) {
              const assistantMsg: Msg = { role: "assistant", content: err.fallbackContent };
              setMessages(prev => [...prev, assistantMsg]);
            }
            return;
          }

          if (resp.status === 429) {
            toast({ title: "Limite atingido", description: "Aguarde alguns segundos e tente novamente.", variant: "destructive" });
          } else if (resp.status === 402) {
            toast({ title: "Créditos esgotados", description: "Adicione créditos ao workspace.", variant: "destructive" });
          } else {
            toast({ title: "Erro no Tutor", description: err.error || "Ocorreu uma falha na IA.", variant: "destructive" });
          }
        } else {
          if (!mountedRef.current) return;
          toast({ title: "Erro de Conexão", description: `Falha na comunicação com o servidor (${resp.status})`, variant: "destructive" });
        }
        return;
      }

      if (!resp.body) {
        throw new Error("No response body received from study-session function");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let hasReceivedChunks = false;

      console.debug("[StudySession] starting stream read...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        hasReceivedChunks = true;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            console.debug("[StudySession] stream read [DONE]");
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > msgs.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                
                if (!firstQuestionTrackedRef.current && assistantContent.length > 50) {
                  firstQuestionTrackedRef.current = true;
                  trackAction('first_question_loaded', { topic, mode: studyMode, phase: currentPhase });
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch (e) {
            // Ignore parse errors for partial JSON lines
          }
        }
      }

      console.debug("[StudySession] assistant message completed", { length: assistantContent.length });

      if (!assistantContent && hasReceivedChunks) {
         console.warn("[StudySession] received chunks but assistantContent is empty");
      } else if (!hasReceivedChunks) {
         console.warn("[StudySession] no chunks received at all");
      }

      // After streaming completes, check if this was an MCQ answer.
      const lastUserMsg = msgs[msgs.length - 1];
      if (lastUserMsg?.role === "user" && assistantContent) {
        if (currentPhase === "reinforcement") {
          const signal = parseStudySignal(assistantContent);
          if (signal && signal.wasCorrect && signal.confidence >= 0.5) {
            toast({ title: "✅ Conceito corrigido!", description: "Você fixou o ponto. Continuando..." });
            setTimeout(() => setPhase(preReinforcementPhase), 2000);
          }
          detectAndRegisterMCQ(assistantContent, lastUserMsg.content);
        } else if (currentPhase === "questions" || currentPhase === "discussion") {
          detectAndRegisterMCQ(assistantContent, lastUserMsg.content);
        }
      }
    } catch (err: any) {
      console.error("[StudySession] connection error in streamChat:", err);
      if (currentPhase === "questions") {
        toast({ 
          title: "Instabilidade na IA", 
          description: "Carregando questão alternativa do banco de dados...", 
          variant: "default" 
        });
      } else {
        toast({ 
          title: "Erro de conexão", 
          description: "Não foi possível conectar ao servidor. Tente novamente.", 
          variant: "destructive" 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startStudy = async () => {
    if (!topicInput.trim()) return;
    const t = topicInput.trim();
    setTopic(t);
    // Go to style selection instead of directly to lesson
    setPhase("style-select");
  };

  const handleStyleSelect = async (mode: StudyMode, topicOverride?: string) => {
    setStudyMode(mode);
    const t = topicOverride?.trim() || topic;
    if (!t) return;
    sessionStartTimeRef.current = Date.now();
    firstQuestionTrackedRef.current = false;
    sessionCompleteTrackedRef.current = false;
    trackAction('study_session_started', { topic: t, mode, origin: 'style_select' });

    // Map mode to initial phase
    const phaseMap: Record<StudyMode, Phase> = {
      compact: "lesson",
      full: "lesson",
      review: "lesson",
      correction: "lesson",
      practice: "questions",
    };
    const targetPhase = phaseMap[mode];
    setPhase(targetPhase);

    const updated = { ...performance, studiedTopics: [...new Set([...performance.studiedTopics, t])] };
    savePerformance(updated);

    // Build user message based on mode
    const modeMessages: Record<StudyMode, string> = {
      compact: `Quero estudar: ${t}. Modo RÁPIDO: explicação curta e direta (300-400 palavras), estilo Feynman + aplicação + ponto-chave + pergunta.`,
      full: `Quero estudar: ${t}. Comece pela aula completa.`,
      review: `Quero estudar: ${t}. Modo REVISÃO PARA PROVA: foque em pegadinhas, pontos cobrados em residência e diagnósticos diferenciais.`,
      correction: `Quero estudar: ${t}. Modo CORREÇÃO DE ERROS: foque nos meus erros anteriores nesse tema e reforce os conceitos que errei.`,
      practice: `Quero estudar: ${t}. Modo QUESTÃO DIRETA: gere uma questão de caso clínico com 5 alternativas imediatamente.`,
    };

    let userContent = modeMessages[mode];
    if (professorContext) {
      userContent += `\n\n[CONTEXTO DO PROFESSOR - TÓPICOS OBRIGATÓRIOS]\n${professorContext.topics}`;
      if (professorContext.materialUrl) {
        userContent += `\n[Material de apoio disponível no storage: ${professorContext.materialUrl}]`;
      }
    }

    const userMsg: Msg = { role: "user", content: userContent };
    setMessages([userMsg]);

    if (professorContext?.assignmentId && user) {
      supabase
        .from("teacher_study_assignment_results")
        .update({ status: "studying", started_at: new Date().toISOString() })
        .eq("id", professorContext.assignmentId)
        .eq("student_id", user.id)
        .then(() => {});
    }

    await streamChat([userMsg], targetPhase, t);
  };

  const goToPhase = async (targetPhase: Phase) => {
    if (isLoading) return;
    console.debug("[StudySession] goToPhase called", { targetPhase });
    setPhase(targetPhase);
    const label = PHASE_META[targetPhase].label;
    const userMsg: Msg = { role: "user", content: `Avançar para: ${label}` };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    console.debug("[StudySession] mission step advanced", { targetPhase, label });
    await streamChat(newMsgs, targetPhase, topic);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    console.debug("[StudySession] sendMessage called", { input: input.trim(), phase, topic });
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    console.debug("[StudySession] message sent local", { role: "user", content: userMsg.content });
    await streamChat(newMsgs, phase, topic);
  };

  const resetSession = () => {
    setMessages([]);
    setPhase("start");
    setTopic("");
    setTopicInput("");
  };

  const currentIdx = FLOW_PHASES.indexOf(phase);
  const progressPercent = phase === "start" ? 0 : Math.round(((currentIdx + 1) / FLOW_PHASES.length) * 100);
  const acuracyPercent = performance.totalQuestions > 0
    ? Math.round((performance.correctAnswers / performance.totalQuestions) * 100) : 0;

  // Painel de Desempenho como conteúdo reusável (renderizado dentro de Sheet)
  const performancePanel = (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Performance Summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Painel de Desempenho
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="text-lg font-bold text-foreground">{performance.totalQuestions}</div>
            <div className="text-[10px] text-muted-foreground">Questões</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="text-lg font-bold text-foreground">{acuracyPercent}%</div>
            <div className="text-[10px] text-muted-foreground">Acerto</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="text-lg font-bold text-foreground">{performance.level}</div>
            <div className="text-[10px] text-muted-foreground">Nível</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="text-lg font-bold text-primary">{performance.readiness}%</div>
            <div className="text-[10px] text-muted-foreground">Preparo</div>
          </div>
        </div>
      </div>

      {/* Specialty Map */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <Target className="h-4 w-4 text-primary" />
          Domínio por Especialidade
        </h3>
        <div className="space-y-1.5">
          {performance.specialties.map((s) => {
            const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
            return (
              <div key={s.name}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-muted-foreground truncate">{s.name}</span>
                  <span className="text-foreground font-medium">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weak Topics */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Temas Fracos
        </h3>
        {performance.weakTopics.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {performance.weakTopics.map((t) => (
              <Badge key={t} variant="destructive" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Nenhum tema fraco identificado ainda.</p>
        )}
      </div>

      {/* Studied Topics */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          Temas Estudados
        </h3>
        {performance.studiedTopics.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {performance.studiedTopics.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Comece a estudar para ver o progresso.</p>
        )}
      </div>
    </div>
  );

  const content = (
    <div className={`flex animate-fade-in ${isFullscreen ? "fixed inset-0 z-[100] bg-background" : "h-[calc(100vh-4rem)]"}`}>
      {/* Painel de Desempenho — drawer (não rouba largura do conteúdo principal) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xs p-0">
          {performancePanel}
        </SheetContent>
      </Sheet>

      {/* Main Content — agora ocupa 100% da largura */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Panorama Navigation (Só aparece na fase start) ── */}
        {phase === "start" && (
          <div className="px-4 py-2 border-b border-border/40">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="gap-2 text-muted-foreground hover:text-foreground h-7"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar ao Início ENAFLIX
            </Button>
          </div>
        )}

        {/* Cinematic Top Bar — cockpit de foco (hue: simulado/verde performance) */}
        <div
          className="relative overflow-hidden border-b border-border"
          style={{ ["--module-hue" as never]: "var(--hue-simulado)" } as React.CSSProperties}
        >
          {/* Ambient glow — calmo, focado */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse at 0% 50%, hsl(var(--module-hue) / 0.12), transparent 55%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 right-1/3 h-24 w-24 rounded-full blur-3xl opacity-30"
            style={{ background: "hsl(var(--module-hue) / 0.4)" }}
          />

          <div className="relative flex items-center justify-between px-4 py-2.5 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl hover:bg-white/5 flex-shrink-0 transition-all active:scale-90"
                onClick={() => setSidebarOpen(true)}
                title="Painel de Desempenho"
                aria-label="Abrir painel de desempenho"
              >
                <BarChart3 className="h-4.5 w-4.5" />
              </Button>

              {/* Identidade premium — Estilo Cockpit 2.0 */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="relative h-9 w-9 rounded-xl flex items-center justify-center bg-module-tint border border-module/20 flex-shrink-0"
                  style={{
                    boxShadow: "0 0 20px -5px hsl(var(--module-hue) / 0.5)",
                  }}
                >
                  <GraduationCap
                    className="h-5 w-5"
                    style={{ color: "hsl(var(--module-hue))" }}
                  />
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-black text-foreground leading-none tracking-tight uppercase">
                    Missão de Estudo
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-bold text-muted-foreground/80 leading-none uppercase tracking-wider">
                      Foco Máximo • Conectado
                    </p>
                  </div>
                </div>
                {topic && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] font-black truncate max-w-[160px] ml-2 hidden sm:inline-flex bg-white/5 border-0 rounded-lg px-2"
                  >
                    {topic}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {phase !== "start" && phase !== "style-select" && topic && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                      title="Pedir ajuda contextual ao Tutor IA sem sair da sessão"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Pedir ajuda ao Tutor</span>
                      <span className="sm:hidden">Tutor</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                    <TutorChatPanel
                      context={{
                        topic,
                        specialty: searchParams.get("sc_specialty") || undefined,
                        phase: PHASE_META[phase].label,
                        focus: studyMode,
                        mode: "mission",
                        origin: "study-session",
                      }}
                    />
                  </SheetContent>
                </Sheet>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {phase !== "start" && phase !== "style-select" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Mais opções">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-premium">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {PHASE_META[phase].label} • {progressPercent}%
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={resetSession}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Nova sessão
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Phase Progress — versão enxuta: progresso + chips menores e silenciosos */}
        {phase !== "start" && phase !== "style-select" && (
          <div className="px-4 py-1.5 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {PHASE_META[phase].shortLabel}
                <span className="text-muted-foreground/50 font-normal ml-1.5">
                  · etapa {currentIdx + 1} de {FLOW_PHASES.length}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground/70">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1" />
            <div className="flex gap-0.5 mt-1.5 overflow-x-auto pb-0.5 opacity-80 hover:opacity-100 transition-opacity">
              {FLOW_PHASES.map((p, i) => {
                const isActive = p === phase;
                const isDone = i < currentIdx;
                const isNext = i === currentIdx + 1;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      if ((isDone || isNext) && !isLoading) goToPhase(p);
                    }}
                    disabled={!isDone && !isNext && !isActive}
                    title={PHASE_META[p].label}
                    aria-label={PHASE_META[p].label}
                    className={`h-1.5 rounded-full transition-all ${
                      isActive
                        ? "bg-primary w-6"
                        : isDone
                        ? "bg-primary/50 w-3 cursor-pointer hover:bg-primary/70"
                        : isNext
                        ? "bg-muted-foreground/30 w-3 cursor-pointer hover:bg-muted-foreground/50"
                        : "bg-muted-foreground/15 w-3 cursor-not-allowed"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Resume Session Banner */}
        {sessionChecked && pendingSession && phase === "start" && (
          <div className="px-4 pt-4">
            <ResumeSessionBanner
              updatedAt={pendingSession.updated_at}
              onResume={handleRestoreSession}
              onDiscard={abandonSession}
            />
          </div>
        )}

        {/* Start Screen — Hub Operacional (4 áreas) substitui o input minimalista */}
        {phase === "start" && (
          <OperationalHub
            topicInput={topicInput}
            onTopicChange={setTopicInput}
            onStartStudy={startStudy}
          />
        )}

        {/* Style Select Screen */}
        {phase === "style-select" && (
          <div className="flex-1 flex items-center justify-center p-6">
            <StudyStyleSelector
              topic={topic}
              onSelect={handleStyleSelect}
              hasErrors={performance.weakTopics.some(w => w.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(w.toLowerCase()))}
            />
          </div>
        )}

        {/* Chat */}
        {phase !== "start" && phase !== "style-select" && (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "glass-card"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
                        <ReactMarkdown>{stripStudySignal(m.content)}</ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="glass-card rounded-2xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Phase Action Buttons & Error Handling */}
            <div className="border-t border-border px-3 pt-2 space-y-2">
              {!isLoading && phase !== "scoring" && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {/* Botão de "Tentar Novamente" se não houver resposta do assistente para a fase atual */}
                  {messages.length > 0 && messages[messages.length - 1].role !== "assistant" && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="text-xs whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white" 
                      onClick={() => streamChat(messages, phase, topic)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Tentar novamente {PHASE_META[phase].shortLabel}
                    </Button>
                  )}

                  {phase === "lesson" && messages.some(m => m.role === "assistant" && m.content.length > 100) && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => goToPhase("active-recall")}>
                      <Brain className="h-3.5 w-3.5 mr-1" /> Active Recall
                    </Button>
                  )}
                  {(phase === "active-recall" || phase === "lesson") && messages.some(m => m.role === "assistant" && m.content.length > 50) && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={() => goToPhase("questions")}>
                      <HelpCircle className="h-3.5 w-3.5 mr-1" /> Questões MCQ
                    </Button>
                  )}
                  {(phase === "questions") && messages.some(m => m.role === "assistant" && m.content.length > 50) && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => goToPhase("discussion")}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Discussão Clínica
                    </Button>
                  )}
                  {(phase === "discussion" || phase === "questions") && messages.some(m => m.role === "assistant" && m.content.length > 50) && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10" onClick={() => goToPhase("discursive")}>
                      <Stethoscope className="h-3.5 w-3.5 mr-1" /> Caso Discursivo
                    </Button>
                  )}
                  {(phase === "discursive" || phase === "discussion") && messages.some(m => m.role === "assistant" && m.content.length > 50) && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-primary/30 text-primary hover:bg-primary/10" onClick={() => goToPhase("scoring")}>
                      <TrendingUp className="h-3.5 w-3.5 mr-1" /> Pontuar Sessão
                    </Button>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 pb-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua resposta ou dúvida..."
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (isFullscreen) return createPortal(content, document.body);
  return content;
};

export default memo(StudySession);
