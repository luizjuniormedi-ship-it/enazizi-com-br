import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen, Brain, HelpCircle, MessageSquare, BarChart3,
  Send, Loader2, GraduationCap, Play, RotateCcw, Stethoscope,
  FileText, AlertTriangle, TrendingUp, Target, Maximize2, Minimize2, MoreVertical
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";

import StudyStyleSelector, { type StudyMode } from "@/components/tutor/StudyStyleSelector";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("full");
  const [phase, setPhase] = useState<Phase>("start");
  const [topic, setTopic] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [performance, setPerformance] = useState<PerformanceData>(INITIAL_PERFORMANCE);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [professorContext, setProfessorContext] = useState<{ topics: string; materialUrl?: string; assignmentId?: string } | null>(null);
  const [reinforcementCycles, setReinforcementCycles] = useState<Record<string, number>>({});
  const [preReinforcementPhase, setPreReinforcementPhase] = useState<Phase>("questions");
  const [targetExam, setTargetExam] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const t = setTimeout(() => {
        handleStyleSelect(mode);
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

  // Detect MCQ answers in assistant responses and register practice_attempts
  const detectAndRegisterMCQ = useCallback(async (assistantContent: string, userAnswer: string) => {
    if (!user || !topic) return;
    // Check if user sent a single letter answer (A-E)
    const answerMatch = userAnswer.trim().match(/^[A-Ea-e]$/);
    if (!answerMatch) return;

    // Check if assistant response contains correction indicators
    const content = assistantContent.toLowerCase();
    const isCorrect = content.includes("✅") || content.includes("correta") || content.includes("acertou") || content.includes("parabéns");
    const isWrong = content.includes("❌") || content.includes("incorreta") || content.includes("errou") || content.includes("não é a alternativa");

    if (!isCorrect && !isWrong) return;
    const correct = isCorrect && !isWrong;

    try {
      // We need a question_id — use a generated one based on conversation context
      // Instead, update domain map and error bank directly
      const { updateDomainMap } = await import("@/lib/updateDomainMap");
      await updateDomainMap(user.id, [{ topic, correct }]);

      if (!correct) {
        const errorCategory = "conceito";
        await logErrorToBank({
          userId: user.id,
          tema: topic,
          tipoQuestao: "objetiva",
          conteudo: `Questão MCQ do Tutor IA sobre ${topic}`,
          motivoErro: "Erro em questão objetiva durante sessão de estudo",
          categoriaErro: errorCategory,
        });

        // Trigger reinforcement loop if under max cycles
        const currentCycles = reinforcementCycles[topic] || 0;
        if (currentCycles < 2 && phase !== "reinforcement") {
          const nextCycle = currentCycles + 1;
          setReinforcementCycles(prev => ({ ...prev, [topic]: nextCycle }));
          setPreReinforcementPhase(phase);

          // Short delay so the user reads the correction first
          setTimeout(async () => {
            setPhase("reinforcement");
            const reinforceMsg: Msg = {
              role: "user",
              content: `Errei a questão sobre ${topic}. Preciso de reforço rápido.`,
            };
            const newMsgs = [...messages, { role: "assistant" as const, content: assistantContent }, reinforceMsg];
            setMessages(newMsgs);

            // Pass reinforcement context in performanceData
            const reinforcementPerf = {
              ...performance,
              reinforcement: {
                topic,
                categoriaErro: errorCategory,
                content: assistantContent.slice(0, 500),
                cycle: nextCycle,
              },
            };
            setIsLoading(true);
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-session`;
            try {
              const resp = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
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
  }, [user, topic, reinforcementCycles, phase, messages, performance, studyMode]);

  const streamChat = async (msgs: Msg[], currentPhase: Phase, currentTopic: string) => {
    setIsLoading(true);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-session`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: msgs,
          phase: currentPhase,
          topic: currentTopic,
          performanceData: performance,
          studyMode,
          targetExam,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (resp.status === 429) {
          toast({ title: "Limite atingido", description: "Aguarde alguns segundos e tente novamente.", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "Créditos esgotados", description: "Adicione créditos ao workspace.", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: err.error, variant: "destructive" });
        }
        setIsLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {}
        }
      }
      // After streaming completes, check if this was an MCQ answer
      const lastUserMsg = msgs[msgs.length - 1];
      if (lastUserMsg?.role === "user" && assistantContent) {
        if (currentPhase === "reinforcement") {
          // Check if reinforcement question was answered correctly
          const answerMatch = lastUserMsg.content.trim().match(/^[A-Ea-e]$/);
          if (answerMatch) {
            const lower = assistantContent.toLowerCase();
            const wasCorrect = (lower.includes("✅") || lower.includes("correta") || lower.includes("acertou")) && !(lower.includes("❌") || lower.includes("incorreta"));
            if (wasCorrect) {
              // Success! Return to previous phase after a beat
              toast({ title: "✅ Conceito corrigido!", description: "Você fixou o ponto. Continuando..." });
              setTimeout(() => setPhase(preReinforcementPhase), 2000);
            }
            // If wrong again and under limit, detectAndRegisterMCQ will trigger another cycle
            detectAndRegisterMCQ(assistantContent, lastUserMsg.content);
          }
        } else if (currentPhase === "questions" || currentPhase === "discussion") {
          detectAndRegisterMCQ(assistantContent, lastUserMsg.content);
        }
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível conectar ao servidor.", variant: "destructive" });
    }
    setIsLoading(false);
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
    setPhase(targetPhase);
    const label = PHASE_META[targetPhase].label;
    const userMsg: Msg = { role: "user", content: `Avançar para: ${label}` };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    await streamChat(newMsgs, targetPhase, topic);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
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

  const content = (
    <div className={`flex animate-fade-in ${isFullscreen ? "fixed inset-0 z-[100] bg-background" : "h-[calc(100vh-4rem)]"}`}>
      {/* Left Sidebar — Performance Panel */}
      <aside className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden border-r border-border flex-shrink-0 bg-card/50`}>
        <div className="w-72 h-full overflow-y-auto p-4 space-y-4">
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h1 className="text-base font-bold">ENAZIZI</h1>
              {topic && (
                <Badge variant="secondary" className="text-xs">{topic}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8" title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {phase !== "start" && phase !== "style-select" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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

        {/* Phase Progress Bar */}
        {phase !== "start" && phase !== "style-select" && (
          <div className="px-4 py-1.5 border-b border-border">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex gap-1 mt-1.5 overflow-x-auto pb-0.5">
              {FLOW_PHASES.map((p, i) => {
                const meta = PHASE_META[p];
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
                    className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold"
                        : isDone
                        ? "bg-secondary text-secondary-foreground cursor-pointer hover:bg-secondary/80"
                        : isNext
                        ? "bg-secondary/50 text-muted-foreground cursor-pointer hover:bg-secondary/80 border border-primary/30"
                        : "bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
                    }`}
                  >
                    {meta.shortLabel}
                  </button>
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

        {/* Start Screen */}
        {phase === "start" && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-xl w-full space-y-6">
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Vamos estudar! 🎯</h2>
                <p className="text-muted-foreground text-sm">
                  O ENAZIZI segue o protocolo pedagógico completo:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 text-xs">
                  {FLOW_PHASES.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">
                      {PHASE_META[p].label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="Digite o tema: Ex: Insuficiência Cardíaca, TEP..."
                  onKeyDown={(e) => e.key === "Enter" && startStudy()}
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={startStudy} disabled={!topicInput.trim()}>
                  <Play className="h-4 w-4 mr-1" /> Estudar
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTED_TOPICS.map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="text-[11px] h-7"
                    onClick={() => setTopicInput(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
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
                        <ReactMarkdown>{m.content}</ReactMarkdown>
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

            {/* Phase Action Buttons */}
            <div className="border-t border-border px-3 pt-2 space-y-2">
              {!isLoading && phase !== "scoring" && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {phase === "lesson" && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => goToPhase("active-recall")}>
                      <Brain className="h-3.5 w-3.5 mr-1" /> Active Recall
                    </Button>
                  )}
                  {(phase === "active-recall" || phase === "lesson") && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={() => goToPhase("questions")}>
                      <HelpCircle className="h-3.5 w-3.5 mr-1" /> Questões MCQ
                    </Button>
                  )}
                  {(phase === "questions") && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => goToPhase("discussion")}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Discussão Clínica
                    </Button>
                  )}
                  {(phase === "discussion" || phase === "questions") && (
                    <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10" onClick={() => goToPhase("discursive")}>
                      <Stethoscope className="h-3.5 w-3.5 mr-1" /> Caso Discursivo
                    </Button>
                  )}
                  {(phase === "discursive" || phase === "discussion") && (
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

export default StudySession;
