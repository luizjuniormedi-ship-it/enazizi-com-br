import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";

const AnamnesisRadarChart = lazy(() => import("@/components/anamnesis/AnamnesisRadarChart"));
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { useQueryClient } from "@tanstack/react-query";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionTracking, SessionOrigin } from "@/hooks/useSessionTracking";
import { useToast } from "@/hooks/use-toast";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import { useIsMobile } from "@/hooks/use-mobile";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import {
  MessageCircle, Send, Loader2, Clock, Award, RotateCcw,
  CheckCircle, XCircle, Star, Trophy, Target, ClipboardCheck,
  User, Heart, Pill, AlertTriangle, Users as UsersIcon, Activity,
  Stethoscope, Baby, Brain, ListChecks, FileText, ChevronDown, ChevronUp, Sparkles, History,
  Eye, Lightbulb, BookOpen, ClipboardList
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import { exportToPdf } from "@/lib/exportPdf";

const SPECIALTIES = [
  "Clínica Médica", "Cardiologia", "Pneumologia", "Gastroenterologia", "Neurologia",
  "Nefrologia", "Infectologia", "Pediatria", "Cirurgia", "Ginecologia e Obstetrícia",
  "Ortopedia", "Psiquiatria", "Emergência", "Dermatologia", "Semiologia", "Oncologia",
];

const PEDIATRIC_AGE_RANGES = [
  { key: "neonato", label: "Neonato (0-28 dias)" },
  { key: "lactente", label: "Lactente (1-24 meses)" },
  { key: "pre_escolar", label: "Pré-escolar (2-6 anos)" },
  { key: "escolar", label: "Escolar (7-12 anos)" },
  { key: "adolescente", label: "Adolescente (13-17 anos)" },
  { key: "aleatorio", label: "Aleatório" },
];

const BASE_CATEGORIES = [
  { key: "identification", label: "Identificação", icon: User },
  { key: "chief_complaint", label: "Queixa Principal", icon: MessageCircle },
  { key: "hda", label: "HDA", icon: Activity },
  { key: "past_medical", label: "Antecedentes", icon: ClipboardCheck },
  { key: "medications", label: "Medicações", icon: Pill },
  { key: "allergies", label: "Alergias", icon: AlertTriangle },
  { key: "family_history", label: "Hist. Familiar", icon: UsersIcon },
  { key: "social_history", label: "Hábitos de Vida", icon: Heart },
  { key: "review_of_systems", label: "Rev. Sistemas", icon: Stethoscope },
  { key: "gynecological", label: "Ginecológica", icon: Baby },
];

const PEDIATRIC_EXTRA_CATEGORIES = [
  { key: "gestational_history", label: "Hist. Gestacional", icon: Heart },
  { key: "birth_history", label: "Hist. Neonatal", icon: Baby },
  { key: "development", label: "DNPM", icon: Activity },
  { key: "vaccination", label: "Vacinação", icon: ClipboardCheck },
  { key: "feeding", label: "Alimentação", icon: Stethoscope },
];

const DIAGNOSIS_CATEGORIES = [
  { key: "hypothesis", label: "Hipótese Diagnóstica", icon: Brain },
  { key: "differentials", label: "Diferenciais", icon: ListChecks },
  { key: "conduct", label: "Conduta", icon: FileText },
];

// Contextual quick-question suggestions — ADAPTIVE by difficulty
const SUGGESTION_MAP_BASICO: Record<string, string[]> = {
  _start: ["Qual o seu nome completo?", "O que o trouxe aqui hoje?", "Há quanto tempo sente isso?"],
  identification: ["Qual sua idade?", "O que o trouxe aqui?", "Há quanto tempo está assim?"],
  chief_complaint: ["Quando começou?", "Como é a dor?", "O que piora ou melhora?"],
  hda: ["Tem alguma doença crônica?", "Já fez alguma cirurgia?", "Toma algum remédio?"],
  past_medical: ["Quais remédios toma?", "Tem alergia a algum medicamento?", "Alguém na família tem doença parecida?"],
  medications: ["Tem alergia a algum medicamento?", "Tem alergias alimentares?", "Alguma reação a remédios?"],
  allergies: ["Alguém na família tem doenças semelhantes?", "Seus pais são vivos?", "Tem histórico de câncer na família?"],
  family_history: ["Fuma? Bebe?", "Pratica exercícios?", "Como é sua alimentação?"],
  social_history: ["Tem sentido febre?", "Perdeu peso recentemente?", "Algum sintoma urinário?"],
};

const SUGGESTION_MAP_INTERMEDIARIO: Record<string, string[]> = {
  _start: ["Identificação do paciente", "Investigue a queixa principal", "Caracterize a cronologia"],
  identification: ["Explore a queixa principal", "Pergunte sobre início dos sintomas"],
  chief_complaint: ["Aprofunde a HDA", "Caractere LIQCTSDA", "Fatores de melhora/piora"],
  hda: ["Investigue antecedentes patológicos", "Pergunte sobre comorbidades"],
  past_medical: ["Investigue medicações em uso", "Explore alergias"],
  medications: ["Investigue alergias", "Pergunte reações adversas prévias"],
  allergies: ["Explore história familiar", "Doenças hereditárias relevantes"],
  family_history: ["Investigue hábitos de vida", "Explore fatores de risco"],
  social_history: ["Faça revisão de sistemas", "Investigue sintomas associados"],
};

const SUGGESTION_MAP_AVANCADO: Record<string, string[]> = {
  _start: ["💡 Inicie pela identificação", "💡 Explore a queixa"],
  identification: ["💡 Siga para a QP"],
  chief_complaint: ["💡 Aprofunde com HDA"],
  hda: ["💡 Antecedentes relevantes?"],
  past_medical: ["💡 Medicações e alergias"],
  medications: ["💡 Alergias?"],
  allergies: ["💡 Hist. familiar"],
  family_history: ["💡 Hábitos de vida"],
  social_history: ["💡 Revisão de sistemas"],
};

// Mini-caso gatilho templates per specialty
const MINI_CASES: Record<string, string[]> = {
  "Clínica Médica": ["Paciente 58a, dispneia aos esforços há 3 semanas", "Homem 42a, cefaleia intensa há 2 dias com rigidez de nuca"],
  "Cardiologia": ["Mulher 65a, dor torácica em aperto há 4 horas irradiando para MSE", "Homem 50a, palpitações e síncope ao esforço"],
  "Pneumologia": ["Paciente 30a, tosse produtiva há 3 semanas com hemoptise", "Idoso 70a, dispneia progressiva e chiado no peito"],
  "Gastroenterologia": ["Mulher 35a, dor epigástrica pós-prandial há 2 meses", "Homem 55a, icterícia progressiva e perda ponderal"],
  "Neurologia": ["Paciente 28a, cefaleia pulsátil unilateral com aura visual", "Mulher 60a, fraqueza súbita em hemicorpo direito"],
  "Pediatria": ["Lactente 8m, febre há 3 dias e irritabilidade", "Criança 5a, dor abdominal recorrente e vômitos"],
  "Cirurgia": ["Homem 40a, dor em FID há 12h com náusea e febre", "Mulher 65a, massa palpável em mama direita"],
  "Ginecologia e Obstetrícia": ["Gestante 32s, pressão alta e edema de membros inferiores", "Mulher 45a, sangramento uterino anormal há 2 meses"],
  "Emergência": ["Paciente 25a, trauma torácico em acidente automobilístico", "Homem 55a, rebaixamento de consciência súbito"],
};

// Coaching feedback based on quality
const COACHING_TIPS: Record<number, { text: string; color: string }> = {
  0: { text: "💡 Tente ser mais específico na sua pergunta — use termos semiológicos", color: "text-red-400" },
  1: { text: "📝 Pergunta razoável — tente explorar mais detalhes (início, duração, fatores)", color: "text-yellow-400" },
  2: { text: "👍 Boa pergunta! Continue investigando essa linha", color: "text-blue-400" },
  3: { text: "⭐ Excelente técnica semiológica! Pergunta precisa e relevante", color: "text-green-400" },
};

type Phase = "lobby" | "active" | "diagnosis" | "finishing" | "result" | "review";

interface ChatMessage {
  role: "doctor" | "patient" | "system";
  content: string;
  categories?: string[];
  quality?: number;
  timestamp: number;
}

// Track recently animated categories for bounce effect
const useRecentlyCompleted = () => {
  const [recent, setRecent] = useState<Set<string>>(new Set());
  const addRecent = (keys: string[]) => {
    setRecent(prev => new Set([...prev, ...keys]));
    setTimeout(() => {
      setRecent(prev => {
        const next = new Set(prev);
        keys.forEach(k => next.delete(k));
        return next;
      });
    }, 1500);
  };
  return { recent, addRecent };
};

interface EvalCategory {
  score: number;
  covered?: boolean;
  correct?: boolean;
  appropriate?: boolean;
  relevant_count?: number;
  feedback: string;
}

interface DifferentialDiagnosis {
  diagnosis: string;
  reasoning: string;
  how_to_rule_out: string;
  student_considered: boolean;
}

interface FinalEval {
  final_score: number;
  grade: string;
  time_total_minutes: number;
  evaluation: Record<string, EvalCategory>;
  categories_summary: { covered: string[]; missed: string[]; partially_covered: string[] };
  ideal_anamnesis: string;
  clinical_reasoning: string;
  correct_diagnosis: string;
  differential_diagnosis?: DifferentialDiagnosis[];
  ideal_conduct: string;
  diagnostic_reasoning: string;
  strengths: string[];
  improvements: string[];
  xp_earned: number;
}

interface PastCase {
  id: string;
  specialty: string;
  final_score: number | null;
  grade: string | null;
  created_at: string;
  difficulty: string;
}

const QualityStars = ({ quality }: { quality?: number }) => {
  if (quality === undefined || quality === null) return null;
  const stars = Math.min(3, Math.max(0, Math.round(quality)));
  const labels = ["Fraca", "Regular", "Boa", "Excelente"];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 mt-1">
            {[0, 1, 2].map(i => (
              <Star key={i} className={`h-3 w-3 ${i < stars ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">{labels[stars]} — técnica semiológica</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TypingDots = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
);

const AnamnesisTrainer = () => {
  useEffect(() => {
    console.log("Anamnesis Trainer mounted");
  }, []);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const queryClient = useQueryClient();
  const { refreshAll } = useRefreshUserState();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const studyCtx = useStudyContext();
  const paramOrigin = (searchParams.get("origin") as SessionOrigin) || "manual";
  const { startSession: startTrackedSession, completeSession: completeTrackedSession } = useSessionTracking();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [specialty, setSpecialty] = useState(studyCtx?.specialty || "Clínica Médica");
  const [subtopic, setSubtopic] = useState(studyCtx?.subtopic || "");
  const [difficulty, setDifficulty] = useState(studyCtx?.difficulty || "intermediário");
  const [pediatricAge, setPediatricAge] = useState("aleatorio");

  const { recent: recentlyCompleted, addRecent: addRecentlyCompleted } = useRecentlyCompleted();
  const isPediatrics = specialty === "Pediatria";
  const CATEGORIES = isPediatrics
    ? [...BASE_CATEGORIES.filter(c => c.key !== "gynecological" && c.key !== "social_history"), ...PEDIATRIC_EXTRA_CATEGORIES]
    : BASE_CATEGORIES;
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [coveredCategories, setCoveredCategories] = useState<Set<string>>(new Set());
  const [patientData, setPatientData] = useState<any>(null);
  const [evalData, setEvalData] = useState<FinalEval | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [pastCases, setPastCases] = useState<PastCase[]>([]);

  // Diagnosis phase fields
  const [hypothesis, setHypothesis] = useState("");
  const [differentials, setDifferentials] = useState("");
  const [proposedConduct, setProposedConduct] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Session persistence
  const { pendingSession, checked, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "anamnesis" });

  // Load past cases for lobby
  useEffect(() => {
    if (!user) return;
    supabase
      .from("anamnesis_results" as any)
      .select("id, specialty, final_score, grade, created_at, difficulty")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setPastCases(data as any);
      });
  }, [user, phase]);

  const getAnamnesisState = useCallback(() => {
    if (phase !== "active" && phase !== "diagnosis") return {};
    return { phase, specialty, difficulty, messages: messages.map(m => ({ ...m })), coveredCategories: Array.from(coveredCategories), startTime, hypothesis, differentials, proposedConduct };
  }, [phase, specialty, difficulty, messages, coveredCategories, startTime, hypothesis, differentials, proposedConduct]);

  useEffect(() => { registerAutoSave(getAnamnesisState); }, [getAnamnesisState, registerAutoSave]);

  // Telemetry: module opened (Fase A baseline)
  useEffect(() => { telemetry.track('anamnese_opened'); }, []);

  const restoreAnamnesisSession = useCallback((data: Record<string, any>) => {
    if (data.specialty) setSpecialty(data.specialty);
    if (data.difficulty) setDifficulty(data.difficulty);
    if (data.messages) setMessages(data.messages);
    if (data.coveredCategories) setCoveredCategories(new Set(data.coveredCategories));
    if (data.startTime) setStartTime(data.startTime);
    if (data.hypothesis) setHypothesis(data.hypothesis);
    if (data.differentials) setDifferentials(data.differentials);
    if (data.proposedConduct) setProposedConduct(data.proposedConduct);
    setPhase(data.phase || "active");
    clearPending();
  }, [clearPending]);

  useEffect(() => {
    if (phase !== "active") return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [phase, startTime]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const getTimerColor = () => {
    const mins = elapsed / 60;
    if (mins < 15) return "text-green-400";
    if (mins < 25) return "text-yellow-400";
    return "text-red-400";
  };

  const getTimerBarColor = () => {
    const mins = elapsed / 60;
    if (mins < 15) return "bg-green-500";
    if (mins < 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Contextual suggestions based on covered categories AND difficulty level
  const getSuggestions = (): string[] => {
    const map = difficulty === "básico" ? SUGGESTION_MAP_BASICO
      : difficulty === "avançado" ? SUGGESTION_MAP_AVANCADO
      : SUGGESTION_MAP_INTERMEDIARIO;
    if (coveredCategories.size === 0) return map._start;
    const catKeys = Array.from(coveredCategories);
    const lastCovered = catKeys[catKeys.length - 1];
    return map[lastCovered] || map._start;
  };

  // Get mini-case for lobby
  const getMiniCase = (): string => {
    const cases = MINI_CASES[specialty] || MINI_CASES["Clínica Médica"];
    return cases[Math.floor(Math.random() * cases.length)];
  };
  const [miniCase] = useState(() => getMiniCase());

  const callEdgeFunction = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("anamnesis-trainer", { body });
    if (error) throw new Error(error.message);
    return data;
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const data = await callEdgeFunction({
        action: "start",
        specialty,
        subtopic: subtopic.trim() || undefined,
        difficulty,
        ...(isPediatrics && pediatricAge !== "aleatorio" ? { pediatric_age_range: pediatricAge } : {}),
      });
      setPatientData(data);
      setMessages([{
        role: "patient",
        content: data.patient_presentation || "Doutor, eu tô passando mal...",
        timestamp: Date.now(),
      }]);
      setStartTime(Date.now());
      setCoveredCategories(new Set());
      setHypothesis("");
      setDifferentials("");
      setProposedConduct("");
      setPhase("active");

      // Track session
      if (user) {
        startTrackedSession({ type: "anamnesis", userId: user.id, specialty, difficulty, origin: paramOrigin });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput ?? input;
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "doctor", content: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const allMessages = [...messages, userMsg];
      const data = await callEdgeFunction({
        action: "interact",
        messages: [{ role: "user", content: userMsg.content }],
        conversationHistory: allMessages.map(m => ({ role: m.role, content: m.content })),
      });

      // Sanitize: if data.response is missing or looks like raw JSON, extract text
      let patientContent = data.response || "";
      if (!patientContent || patientContent.trim().startsWith("{") || patientContent.trim().startsWith('"')) {
        // Try to extract response from raw JSON string
        try {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          patientContent = parsed.response || "Hmm... pode repetir a pergunta?";
        } catch {
          patientContent = "Hmm... pode repetir a pergunta?";
        }
      }

      const patientMsg: ChatMessage = {
        role: "patient",
        content: patientContent,
        categories: data.categories_touched || [],
        quality: data.question_quality,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, patientMsg]);

      if (data.categories_touched?.length) {
        setCoveredCategories(prev => {
          const next = new Set(prev);
          const newlyAdded: string[] = [];
          data.categories_touched.forEach((c: string) => {
            if (!prev.has(c)) newlyAdded.push(c);
            next.add(c);
          });

          // Insert system messages for newly completed categories
          if (newlyAdded.length > 0) {
            addRecentlyCompleted(newlyAdded);
            const systemMessages: ChatMessage[] = newlyAdded.map(catKey => {
              const catLabel = CATEGORIES.find(cat => cat.key === catKey)?.label || catKey;
              return {
                role: "system" as const,
                content: `✅ ${catLabel} concluída!`,
                timestamp: Date.now(),
              };
            });

            // Check milestones
            const totalCats = CATEGORIES.length;
            const newSize = next.size;
            const prevSize = prev.size;
            const halfMark = Math.ceil(totalCats / 2);
            const threeQuarterMark = Math.ceil(totalCats * 0.75);

            if (prevSize < halfMark && newSize >= halfMark) {
              systemMessages.push({
                role: "system",
                content: "🏅 Metade da anamnese coberta! Continue assim!",
                timestamp: Date.now() + 1,
              });
            }
            if (prevSize < threeQuarterMark && newSize >= threeQuarterMark) {
              const remaining = totalCats - newSize;
              systemMessages.push({
                role: "system",
                content: `🔥 Quase lá! ${remaining > 0 ? `Faltam ${remaining} categorias` : "Todas cobertas!"}`,
                timestamp: Date.now() + 1,
              });
            }
            if (newSize >= totalCats && prevSize < totalCats) {
              systemMessages.push({
                role: "system",
                content: "🎉 Anamnese completa! Todas as categorias foram abordadas. Hora do diagnóstico!",
                timestamp: Date.now() + 2,
              });
            }

            setMessages(prevMsgs => [...prevMsgs, ...systemMessages]);
          }

          return next;
        });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleGoToDiagnosis = () => setPhase("diagnosis");

  const handleSubmitDiagnosis = async () => {
    setPhase("finishing");
    setLoading(true);
    try {
      const data = await callEdgeFunction({
        action: "finish",
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        hypothesis,
        differentials,
        proposed_conduct: proposedConduct,
      });
      setEvalData(data);

      if (user) {
        await supabase.from("anamnesis_results" as any).insert({
          user_id: user.id,
          specialty,
          difficulty,
          categories_covered: data.categories_summary || {},
          final_score: data.final_score || 0,
          grade: data.grade || "F",
          ideal_anamnesis: data.ideal_anamnesis || "",
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
          time_total_minutes: Math.round(elapsed / 60),
          xp_earned: data.xp_earned || 0,
        } as any);

        // Complete tracked session
        await completeTrackedSession("anamnesis", {
          finalScore: data.final_score || 0,
          categoriesCovered: Object.keys(data.categories_summary || {}),
        });

        if ((data.final_score || 0) < 70) {
          const missedCategories = Object.entries(data.categories_summary || {})
            .filter(([, v]: [string, any]) => !v)
            .map(([k]) => k);
          logErrorToBank({
            userId: user.id,
            tema: specialty,
            tipoQuestao: "active-recall",
            conteudo: `Anamnese ${specialty} - Score: ${data.final_score}%`,
            motivoErro: missedCategories.length > 0
              ? `Categorias não cobertas: ${missedCategories.join(", ")}`
              : "Score abaixo de 70%",
            categoriaErro: "conceito",
          });
        }

        if (data.xp_earned) addXp(data.xp_earned);
      }

      await completeSession();
      telemetry.track('anamnese_completed', { specialty: specialty || null });
      if (user?.id) {
        await completeStudyAction({
          userId: user.id,
          taskType: "anamnesis",
          topic: specialty || "Anamnese",
          source: "auto",
          originModule: "anamnesis",
        });
      }
      refreshAll();
      setPhase("result");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setPhase("diagnosis");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhase("lobby");
    setMessages([]);
    setCoveredCategories(new Set());
    setPatientData(null);
    setEvalData(null);
    setElapsed(0);
    setHypothesis("");
    setDifferentials("");
    setProposedConduct("");
  };

  const handleExportPdf = () => {
    if (!evalData) return;
    const items = [
      { title: "Nota", content: `${evalData.grade} — ${evalData.final_score}/100` },
      ...(evalData.ideal_anamnesis ? [{ title: "Anamnese Ideal", content: evalData.ideal_anamnesis }] : []),
      ...(evalData.clinical_reasoning ? [{ title: "Raciocínio Clínico", content: evalData.clinical_reasoning }] : []),
      ...(evalData.strengths?.length ? [{ title: "Pontos Fortes", content: evalData.strengths.join("\n") }] : []),
      ...(evalData.improvements?.length ? [{ title: "Pontos a Melhorar", content: evalData.improvements.join("\n") }] : []),
    ];
    exportToPdf(items, `Anamnese_${specialty}_${evalData.grade}`);
  };

  // === LOBBY ===
  if (phase === "lobby") {
    try {
      const gradeColor: Record<string, string> = { A: "text-green-400", B: "text-blue-400", C: "text-yellow-400", D: "text-orange-400", F: "text-red-400" };
      return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <StudyContextBanner />
        {checked && pendingSession && (
          <ResumeSessionBanner
            updatedAt={pendingSession.updated_at}
            onResume={() => restoreAnamnesisSession(pendingSession.session_data)}
            onDiscard={() => abandonSession()}
          />
        )}

        {/* Hero header with gradient */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 p-6 sm:p-8 bg-gradient-to-br from-primary/5 via-card to-accent/5 gradient-shift">
          <div className="absolute inset-0 pattern-dots opacity-20 pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center tutor-glow float-gentle border border-primary/15">
                <Stethoscope className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Treino de Anamnese</h1>
                <p className="text-sm text-muted-foreground">Pratique entrevista clínica com pacientes simulados por IA</p>
              </div>
            </div>
          </div>
        </div>

        {/* Past cases history */}
        {pastCases.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              Últimos Casos
            </h3>
            <div className="space-y-1.5">
              {pastCases.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/30">
                  <span className="text-foreground truncate mr-2">{c.specialty}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                    <span className={`font-bold text-sm ${gradeColor[c.grade || "F"] || "text-foreground"}`}>{c.grade || "—"}</span>
                    <span className="text-muted-foreground">{c.final_score ?? "—"}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Card className="glass-card border-primary/10">
          <CardContent className="p-6 space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Especialidade</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map(s => (
                  <Badge
                    key={s}
                    variant={specialty === s ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => setSpecialty(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
              <Input
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                placeholder="Ex: IC descompensada, Meningite, Pré-eclâmpsia..."
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">Subassunto (opcional): direcione o caso do paciente</p>
            </div>

            {isPediatrics && (
              <div className="animate-fade-in">
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Baby className="h-4 w-4 text-primary" />
                  Faixa Etária Pediátrica
                </label>
                <div className="flex flex-wrap gap-2">
                  {PEDIATRIC_AGE_RANGES.map(a => (
                    <Badge
                      key={a.key}
                      variant={pediatricAge === a.key ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => setPediatricAge(a.key)}
                    >
                      {a.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  🩺 Categorias extras: História Gestacional, Neonatal, DNPM, Vacinação e Alimentação
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Dificuldade</label>
              <div className="flex gap-2">
                {["básico", "intermediário", "avançado"].map(d => (
                  <Badge
                    key={d}
                    variant={difficulty === d ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20 transition-colors capitalize"
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Mini-caso gatilho */}
            <div className="rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-accent mb-1">🏥 Cenário Clínico</p>
                  <p className="text-sm text-foreground">{miniCase}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Você receberá um caso similar ao iniciar a consulta</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">📋 Como funciona:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• A IA simula um paciente real — só responde ao que você perguntar</li>
                <li>• Conduza a anamnese completa: identificação, QP, HDA, antecedentes...</li>
                <li>• Receba coaching em tempo real sobre a qualidade das suas perguntas</li>
                <li>• Sugestões adaptativas ao seu nível de dificuldade</li>
                <li>• Após avaliação, revise a conversa com anotações do professor IA</li>
              </ul>
            </div>

            <Button onClick={handleStart} disabled={loading} className="w-full glow bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Stethoscope className="h-4 w-4 mr-2" />}
              Iniciar Consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
    } catch (e) {
      console.error("ANAMNESE LOBBY ERROR:", e);
      return <div className="p-8 text-center">Algo deu errado no Lobby da Anamnese. <Button onClick={() => window.location.reload()}>Recarregar</Button></div>;
    }
  }

  // === DIAGNOSIS PHASE ===
  if (phase === "diagnosis" || phase === "finishing") {
    try {
      return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 p-4 sm:p-6 bg-gradient-to-br from-primary/5 via-card to-accent/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold">Raciocínio Clínico</h1>
              <p className="text-xs text-muted-foreground">Proponha diagnóstico e conduta com base na anamnese</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm flex-wrap">
          <Badge variant="outline">{specialty}</Badge>
          <Badge variant="outline" className="capitalize">{difficulty}</Badge>
          <div className={`flex items-center gap-1 font-mono ${getTimerColor()}`}>
            <Clock className="h-4 w-4" />
            {formatTime(elapsed)}
          </div>
          <Badge variant="secondary">{coveredCategories.size}/{CATEGORIES.length} categorias</Badge>
        </div>

        <Card className="glass-card border-primary/10">
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Hipótese Diagnóstica Principal *
              </label>
              <Textarea
                value={hypothesis}
                onChange={e => setHypothesis(e.target.value)}
                placeholder="Ex: Infarto Agudo do Miocárdio com supradesnivelamento de ST..."
                className="min-h-[80px]"
                disabled={phase === "finishing"}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                Diagnósticos Diferenciais (até 3)
              </label>
              <Textarea
                value={differentials}
                onChange={e => setDifferentials(e.target.value)}
                placeholder="Ex: 1. Angina instável 2. Dissecção aórtica 3. Pericardite aguda..."
                className="min-h-[80px]"
                disabled={phase === "finishing"}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Conduta Proposta
              </label>
              <Textarea
                value={proposedConduct}
                onChange={e => setProposedConduct(e.target.value)}
                placeholder="Ex: Solicitar ECG 12 derivações, troponina, hemograma..."
                className="min-h-[100px]"
                disabled={phase === "finishing"}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPhase("active")} disabled={phase === "finishing"}>
                Voltar à Anamnese
              </Button>
              <Button onClick={handleSubmitDiagnosis} disabled={phase === "finishing" || !hypothesis.trim()} className="flex-1 glow">
                {phase === "finishing" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Avaliando...</>
                ) : (
                  <><Award className="h-4 w-4 mr-2" /> Enviar para Avaliação</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
    } catch (e) {
      console.error("ANAMNESE DIAGNOSIS ERROR:", e);
      return <div className="p-8 text-center">Algo deu errado no Diagnóstico da Anamnese. <Button onClick={() => setPhase("active")}>Voltar</Button></div>;
    }
  }

  // === RESULT ===
  if (phase === "result" && evalData) {
    try {
      const gradeColor: Record<string, string> = { A: "text-green-400", B: "text-blue-400", C: "text-yellow-400", D: "text-orange-400", F: "text-red-400" };

    // Radar chart data
    const radarData = CATEGORIES.map(cat => {
      const evalCat = evalData.evaluation?.[cat.key];
      return {
        category: cat.label.length > 10 ? cat.label.slice(0, 9) + "…" : cat.label,
        score: evalCat?.score ?? 0,
      };
    }).filter(d => d.score > 0 || true);

    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" /> Resultado da Anamnese
          </h1>
          <div className="flex gap-2">
            <Button onClick={() => setPhase("review")} variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" /> Revisar Conversa
            </Button>
            <Button onClick={handleExportPdf} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass-card text-center p-4 card-3d">
            <div className={`text-4xl font-bold ${gradeColor[evalData.grade] || "text-foreground"}`}>{evalData.grade}</div>
            <p className="text-xs text-muted-foreground mt-1">Nota</p>
          </Card>
          <Card className="glass-card text-center p-4 card-3d">
            <div className="text-4xl font-bold text-primary">{evalData.final_score}</div>
            <p className="text-xs text-muted-foreground mt-1">Pontuação</p>
          </Card>
          <Card className="glass-card text-center p-4 card-3d">
            <div className="text-4xl font-bold text-foreground">{Math.round(elapsed / 60)}min</div>
            <p className="text-xs text-muted-foreground mt-1">Tempo</p>
          </Card>
          <Card className="glass-card text-center p-4 card-3d">
            <div className="text-4xl font-bold text-yellow-400">+{evalData.xp_earned}</div>
            <p className="text-xs text-muted-foreground mt-1">XP</p>
          </Card>
        </div>

        {/* Radar Chart */}
        {radarData.length >= 3 && (
          <Card className="glass-card">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Radar de Desempenho</h2>
              <Suspense fallback={<div className="h-[280px] animate-pulse rounded-md bg-muted/30" />}>
                <AnamnesisRadarChart data={radarData} />
              </Suspense>
            </CardContent>
          </Card>
        )}

        {/* Anamnese Categories */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Avaliação da Anamnese</h2>
            <div className="space-y-3">
              {CATEGORIES.map(cat => {
                const evalCat = evalData.evaluation?.[cat.key];
                if (!evalCat) return null;
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{cat.label}</span>
                        {evalCat.covered ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                      </div>
                      <span className="text-sm font-bold">{evalCat.score}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{evalCat.feedback}</p>
                  </div>
                );
              })}
              {evalData.evaluation?.communication && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Comunicação</span>
                    </div>
                    <span className="text-sm font-bold">{evalData.evaluation.communication.score}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{evalData.evaluation.communication.feedback}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Diagnosis/Conduct Evaluation */}
        <Card className="glass-card border-primary/20">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Avaliação do Raciocínio Clínico</h2>
            <div className="space-y-4">
              {DIAGNOSIS_CATEGORIES.map(cat => {
                const evalCat = evalData.evaluation?.[cat.key];
                if (!evalCat) return null;
                const Icon = cat.icon;
                const isCorrect = evalCat.correct ?? evalCat.appropriate;
                return (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{cat.label}</span>
                        {isCorrect !== undefined && (
                          isCorrect ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <span className="text-sm font-bold">{evalCat.score}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{evalCat.feedback}</p>
                  </div>
                );
              })}
            </div>

            {evalData.correct_diagnosis && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-1">✅ Diagnóstico Correto</h3>
                  <p className="text-sm bg-muted/30 rounded-lg p-3">{evalData.correct_diagnosis}</p>
                </div>
                {evalData.diagnostic_reasoning && (
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-1">🧠 Raciocínio Diagnóstico</h3>
                    <div className="text-sm bg-muted/30 rounded-lg p-3 prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{evalData.diagnostic_reasoning}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {evalData.ideal_conduct && (
                  <div>
                    <h3 className="text-sm font-semibold text-blue-400 mb-1">📋 Conduta Ideal</h3>
                    <div className="text-sm bg-muted/30 rounded-lg p-3 prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{evalData.ideal_conduct}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Differential Diagnosis */}
        {evalData.differential_diagnosis && evalData.differential_diagnosis.length > 0 && (
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-purple-400" /> Diagnósticos Diferenciais
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Diagnósticos que deveriam ser considerados neste caso.
              </p>
              <div className="space-y-3">
                {evalData.differential_diagnosis.map((dd, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      dd.student_considered
                        ? "bg-green-500/5 border-green-500/30"
                        : "bg-muted/30 border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {dd.student_considered ? (
                        <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-bold">{dd.diagnosis}</span>
                      <Badge
                        variant={dd.student_considered ? "default" : "outline"}
                        className={`text-[10px] ml-auto ${dd.student_considered ? "bg-green-500/20 text-green-400" : ""}`}
                      >
                        {dd.student_considered ? "Considerado" : "Não considerado"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6 mb-1">
                      <span className="font-semibold">Por que considerar:</span> {dd.reasoning}
                    </p>
                    <p className="text-xs text-muted-foreground ml-6">
                      <span className="font-semibold">Como descartar:</span> {dd.how_to_rule_out}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tutor IA Link */}
        {evalData.correct_diagnosis && (
          <Button
            onClick={() => {
              const missed = evalData.differential_diagnosis
                ?.filter(d => !d.student_considered)
                .map(d => d.diagnosis)
                .join(", ") || "N/A";
              navigate("/dashboard/mentor", {
                state: {
                  initialMessage: `🔬 MODO REVISÃO CLÍNICA\n\nO aluno teve dificuldade no seguinte caso de anamnese:\n- Especialidade: ${specialty}\n- Diagnóstico correto: ${evalData.correct_diagnosis}\n- Diferenciais não considerados: ${missed}\n- Pontos fracos: ${evalData.improvements?.join(", ") || "N/A"}\n\nExplique detalhadamente o raciocínio clínico, os diagnósticos diferenciais e como chegar ao diagnóstico correto.`,
                },
              });
            }}
            variant="outline"
            className="w-full border-primary/30 hover:bg-primary/10 gap-2"
          >
            <BookOpen className="h-4 w-4 text-primary" />
            📚 Aprofundar no Tutor IA
          </Button>
        )}

        {/* Missed / Strengths / Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evalData.categories_summary?.missed?.length > 0 && (
            <Card className="glass-card border-red-500/20">
              <CardContent className="p-4">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2"><XCircle className="h-4 w-4" /> Categorias Não Abordadas</h3>
                <ul className="text-sm space-y-1">{evalData.categories_summary.missed.map((c, i) => <li key={i}>• {c}</li>)}</ul>
              </CardContent>
            </Card>
          )}
          {evalData.strengths?.length > 0 && (
            <Card className="glass-card border-green-500/20">
              <CardContent className="p-4">
                <h3 className="font-semibold text-green-400 mb-2 flex items-center gap-2"><Star className="h-4 w-4" /> Pontos Fortes</h3>
                <ul className="text-sm space-y-1">{evalData.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
              </CardContent>
            </Card>
          )}
          {evalData.improvements?.length > 0 && (
            <Card className="glass-card border-yellow-500/20">
              <CardContent className="p-4">
                <h3 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2"><Target className="h-4 w-4" /> Pontos a Melhorar</h3>
                <ul className="text-sm space-y-1">{evalData.improvements.map((s, i) => <li key={i}>• {s}</li>)}</ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ideal Anamnesis */}
        {evalData.ideal_anamnesis && (
          <Card className="glass-card">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Anamnese Ideal</h2>
              <div className="prose prose-sm prose-invert max-w-none text-sm bg-muted/30 rounded-lg p-4">
                <ReactMarkdown>{evalData.ideal_anamnesis}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 🩺 Exame Físico Esperado */}
        {(evalData as any).physical_exam_expected && (() => {
          const pe = (evalData as any).physical_exam_expected;
          return (
            <Card className="glass-card border-emerald-500/20">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-emerald-400" /> Exame Físico Esperado
                </h2>

                <div className="space-y-4">
                  {/* Inspeção */}
                  {pe.inspection?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> Inspeção
                      </h3>
                      <ul className="text-sm space-y-1 pl-5 list-disc">
                        {pe.inspection.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Palpação */}
                  {pe.palpation?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-1">🖐️ Palpação</h3>
                      <ul className="text-sm space-y-1 pl-5 list-disc">
                        {pe.palpation.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Ausculta */}
                  {pe.auscultation?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-1">🔊 Ausculta</h3>
                      <ul className="text-sm space-y-1 pl-5 list-disc">
                        {pe.auscultation.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Sinais Vitais */}
                  {pe.vital_signs_expected && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-1">📊 Sinais Vitais Esperados</h3>
                      <p className="text-sm bg-muted/30 rounded-lg p-3">{pe.vital_signs_expected}</p>
                    </div>
                  )}

                  {/* Manobras */}
                  {pe.maneuvers?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-2">🔨 Manobras Diagnósticas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pe.maneuvers.map((m: any, i: number) => (
                          <Card key={i} className="bg-muted/20 border-emerald-500/10">
                            <CardContent className="p-3 space-y-1">
                              <p className="text-sm font-bold text-emerald-400">{m.name}</p>
                              <p className="text-xs"><span className="text-muted-foreground">Técnica:</span> {m.technique}</p>
                              <p className="text-xs"><span className="text-muted-foreground">Achado positivo:</span> {m.positive_finding}</p>
                              <p className="text-xs"><span className="text-muted-foreground">Indica:</span> {m.indicates}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {evalData.clinical_reasoning && (
          <Card className="glass-card">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Raciocínio Clínico Completo</h2>
              <div className="prose prose-sm prose-invert max-w-none text-sm">
                <ReactMarkdown>{evalData.clinical_reasoning}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        <TaskCompletionCard
          title="Anamnese concluída!"
          subtitle={`Nota: ${evalData.grade} — ${evalData.final_score} pontos. Progresso atualizado.`}
          secondaryLabel="Nova Consulta"
          onSecondary={handleReset}
        />
      </div>
    );
    } catch (e) {
      console.error("ANAMNESE RESULT ERROR:", e);
      return <div className="p-8 text-center">Algo deu errado no Resultado da Anamnese. <Button onClick={() => handleReset()}>Reiniciar</Button></div>;
    }
  }

  // === REVIEW MODE ===
  if (phase === "review" && evalData) {
    try {
      return (
      <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Revisão com Anotações
          </h1>
          <div className="flex gap-2">
            <Button onClick={() => setPhase("result")} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" /> Voltar ao Resultado
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Revise cada pergunta e resposta com feedback do professor IA sobre técnica semiológica.
        </p>

        <div className="space-y-3">
          {messages.map((msg, i) => {
            const qualityLevel = msg.quality !== undefined ? Math.min(3, Math.max(0, Math.round(msg.quality))) : null;
            const coaching = qualityLevel !== null ? COACHING_TIPS[qualityLevel] : null;
            const touchedCats = msg.categories || [];
            return (
              <div key={i} className={`rounded-xl border p-4 space-y-2 ${
                msg.role === "doctor"
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-card"
              }`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {msg.role === "doctor" ? (
                    <><Stethoscope className="h-3.5 w-3.5 text-primary" /> <span className="font-medium text-primary">Você (Médico)</span></>
                  ) : (
                    <><User className="h-3.5 w-3.5 text-accent" /> <span className="font-medium text-accent">Paciente</span></>
                  )}
                  <span className="ml-auto">{new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm">{msg.content}</p>

                {/* Annotations for patient messages */}
                {msg.role === "patient" && (
                  <div className="border-t pt-2 mt-2 space-y-1.5">
                    {touchedCats.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">Categorias tocadas:</span>
                        {touchedCats.map((c, j) => (
                          <Badge key={j} variant="secondary" className="text-[10px] py-0">
                            {CATEGORIES.find(cat => cat.key === c)?.label || c}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {coaching && (
                      <div className="flex items-start gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
                        <p className={`text-[11px] ${coaching.color}`}>{coaching.text}</p>
                      </div>
                    )}
                    {qualityLevel !== null && <QualityStars quality={msg.quality} />}
                  </div>
                )}

                {/* Annotation for doctor: what category they were targeting */}
                {msg.role === "doctor" && i + 1 < messages.length && messages[i + 1].categories && messages[i + 1].categories!.length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-400" />
                      Esta pergunta cobriu: {messages[i + 1].categories!.map(c => CATEGORIES.find(cat => cat.key === c)?.label || c).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary at bottom */}
        <Card className="glass-card border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-primary">{evalData.final_score}/100</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Categorias cobertas: {coveredCategories.size}/{CATEGORIES.length}</p>
                <p className="text-xs text-muted-foreground">Tempo total: {Math.round(elapsed / 60)} minutos</p>
              </div>
              <Button onClick={handleReset} size="sm" className="glow">
                <RotateCcw className="h-4 w-4 mr-1" /> Novo Caso
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
    } catch (e) {
      console.error("ANAMNESE REVIEW ERROR:", e);
      return <div className="p-8 text-center">Algo deu errado na Revisão da Anamnese. <Button onClick={() => setPhase("result")}>Voltar</Button></div>;
    }
  }

  const progressPercent = (coveredCategories.size / CATEGORIES.length) * 100;
  const suggestions = getSuggestions();
  const timerMins = elapsed / 60;

  const doctorQuestions = messages.filter(m => m.role === "doctor");

  try {
    return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Compact header bar */}
      <div className="glass-card rounded-xl p-3 mb-2 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {specialty} • {patientData?.patient_name || "Paciente"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-sm font-mono ${getTimerColor()}`}>
              <Clock className="h-3.5 w-3.5" />
              {formatTime(elapsed)}
            </div>
            <Badge variant="secondary" className="text-[10px]">{coveredCategories.size}/{CATEGORIES.length}</Badge>
            <Button onClick={handleGoToDiagnosis} disabled={loading || messages.length < 4} size="sm" className="text-xs">
              <Brain className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Finalizar e Diagnosticar</span>
              <span className="sm:hidden">Diagnosticar</span>
            </Button>
          </div>
        </div>

        {/* Timer color bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${getTimerBarColor()}`}
            style={{ width: `${Math.min(100, (timerMins / 30) * 100)}%` }}
          />
        </div>

        {/* Compact checklist - mobile: collapsible horizontal, desktop: always visible horizontal */}
        {isMobile ? (
          <div>
            <button
              onClick={() => setChecklistOpen(!checklistOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Checklist</span>
              <Progress value={progressPercent} className="h-1.5 flex-1 mx-1" />
              <span className="text-[10px] font-mono">{Math.round(progressPercent)}%</span>
              {checklistOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {checklistOpen && (
              <div className="flex flex-wrap gap-1.5 mt-2 animate-fade-in">
                {CATEGORIES.map(cat => {
                  const covered = coveredCategories.has(cat.key);
                  const Icon = cat.icon;
                  return (
                    <TooltipProvider key={cat.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${
                            covered ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                          } ${recentlyCompleted.has(cat.key) ? "animate-bounce scale-110" : ""}`}>
                            {covered ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3 opacity-50" />}
                            <span>{cat.label}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">{covered ? "✅ Coberto" : "⬜ Pendente"}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => {
              const covered = coveredCategories.has(cat.key);
              const Icon = cat.icon;
              return (
                <TooltipProvider key={cat.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${
                        covered ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                      } ${recentlyCompleted.has(cat.key) ? "animate-bounce scale-110" : ""}`}>
                        {covered ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3 opacity-50" />}
                        <span>{cat.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">{covered ? "✅ Coberto" : "⬜ Pendente"}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        )}
      </div>

      {/* Doctor Questions Panel */}
      {doctorQuestions.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full px-2 py-1.5 rounded-lg bg-muted/30">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Suas perguntas ({doctorQuestions.length})</span>
              <ChevronDown className="h-3 w-3 ml-auto" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-32 overflow-y-auto mt-1 space-y-1 px-1">
              {doctorQuestions.map((msg, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground py-1 px-2 rounded bg-muted/20">
                  <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                  <span className="line-clamp-2">{msg.content}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-3 rounded-xl p-3 sm:p-4 mb-2 bg-gradient-to-b from-muted/10 to-muted/20">
        {messages.map((msg, i) => {
          // System message (category completion / milestone)
          if (msg.role === "system") {
            return (
              <div key={i} className="flex justify-center animate-fade-in">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{msg.content}</span>
                </div>
              </div>
            );
          }

          return (
          <div key={i} className={`flex gap-2 ${msg.role === "doctor" ? "justify-end" : "justify-start"}`}>
            {msg.role === "patient" && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="h-4 w-4 text-accent" />
              </div>
            )}
            <div className="max-w-[80%] space-y-1">
              <div className={`rounded-2xl px-4 py-3 ${
                msg.role === "doctor"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "glass-card rounded-bl-md"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.categories && msg.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.categories.map((c, j) => (
                      <Badge key={j} variant="secondary" className="text-[10px] py-0">
                        {CATEGORIES.find(cat => cat.key === c)?.label || c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {/* Quality stars + coaching feedback */}
              {msg.role === "patient" && (
                <div className="space-y-0.5">
                  <QualityStars quality={msg.quality} />
                  {msg.quality !== undefined && msg.quality !== null && COACHING_TIPS[Math.min(3, Math.max(0, Math.round(msg.quality)))] && (
                    <p className={`text-[10px] ${COACHING_TIPS[Math.min(3, Math.max(0, Math.round(msg.quality)))].color} animate-fade-in`}>
                      {COACHING_TIPS[Math.min(3, Math.max(0, Math.round(msg.quality)))].text}
                    </p>
                  )}
                </div>
              )}
            </div>
            {msg.role === "doctor" && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Stethoscope className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>
          );
        })}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-accent" />
            </div>
            <div className="glass-card rounded-2xl rounded-bl-md">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick suggestions */}
      {!loading && suggestions.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide mb-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Sparkles className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Faça sua pergunta ao paciente..."
          disabled={loading}
          className="flex-1 rounded-xl"
        />
        <Button onClick={() => handleSend()} disabled={loading || !input.trim()} size="icon" className="rounded-xl glow">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
    );
  } catch (e) {
    console.error("ANAMNESE ACTIVE ERROR:", e);
    return <div className="p-8 text-center">Algo deu errado na Consulta da Anamnese. <Button onClick={() => setPhase("lobby")}>Voltar ao Início</Button></div>;
  }
};

export default AnamnesisTrainer;
