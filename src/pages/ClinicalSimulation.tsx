import React, { useState, useRef, useEffect, useCallback } from "react";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { useQueryClient } from "@tanstack/react-query";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTracking, SessionOrigin } from "@/hooks/useSessionTracking";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { exportToPdf } from "@/lib/exportPdf";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import ReactMarkdown from "react-markdown";
import {
  Activity, Loader2, Send, Stethoscope, Syringe, FileSearch,
  Clock, Heart, AlertTriangle, Award, ArrowRight, RotateCcw,
  MessageCircle, Thermometer, Zap, Star, CheckCircle, XCircle,
  Trophy, Target, HelpCircle, Users, ClipboardCheck, ShieldAlert, History, Eye, Maximize2, Minimize2,
  User, Brain, Pill, MonitorCheck, Bone, Scan, HeartPulse, Ear, Hand,
  Wind, Droplets, Shield, BookOpen, FileText, ChevronDown, ChevronUp, GraduationCap, Download, Clipboard, Trash2
} from "lucide-react";
import VitalsChart, { parseVitalsToSnapshot } from "@/components/plantao/VitalsChart";
import VitalsMonitor from "@/components/plantao/VitalsMonitor";
import ShiftHeader from "@/components/plantao/ShiftHeader";
import ExamsPanel from "@/components/plantao/ExamsPanel";
import PrescriptionDialog from "@/components/plantao/PrescriptionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ALL_SPECIALTIES as SPECIALTIES } from "@/constants/specialties";
import CycleFilter, { getFilteredSpecialties } from "@/components/CycleFilter";

const PEDIATRIC_AGE_RANGES = [
  { key: "neonato", label: "Neonato (0-28 dias)", vitalRef: "FC 120-160, FR 40-60, PA 60-80/30-45, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "lactente", label: "Lactente (1-24 meses)", vitalRef: "FC 100-150, FR 25-40, PA 80-100/50-65, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "pre_escolar", label: "Pré-escolar (2-6 anos)", vitalRef: "FC 80-120, FR 20-30, PA 85-110/50-70, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "escolar", label: "Escolar (7-12 anos)", vitalRef: "FC 70-110, FR 18-25, PA 90-120/55-75, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "adolescente", label: "Adolescente (13-17 anos)", vitalRef: "FC 60-100, FR 12-20, PA 100-130/60-80, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "aleatorio", label: "Aleatório", vitalRef: "" },
];

// Expanded contextual quick actions organized by category
const QUICK_ACTION_CATEGORIES = [
  {
    label: "Anamnese",
    icon: MessageCircle,
    color: "text-blue-500",
    actions: [
      { label: "HDA", prompt: "Gostaria de saber mais sobre a história da doença atual. Quando começaram os sintomas? Como evoluíram?" },
      { label: "Ant. Pessoais", prompt: "Quais são seus antecedentes pessoais? Doenças prévias, cirurgias, internações?" },
      { label: "Ant. Familiares", prompt: "Há doenças na família? Pais, irmãos?" },
      { label: "Hábitos de Vida", prompt: "Quais são seus hábitos? Tabagismo, etilismo, atividade física, alimentação?" },
      { label: "Medicamentos", prompt: "Faz uso de algum medicamento? Quais?" },
      { label: "Alergias", prompt: "Tem alergia a algum medicamento ou substância?" },
      { label: "Rev. de Sistemas", prompt: "Gostaria de fazer uma revisão de sistemas. Tem sentido algo diferente em outros órgãos? Febre, perda de peso, alterações urinárias, intestinais?" },
    ],
  },
  {
    label: "Exame Físico",
    icon: Stethoscope,
    color: "text-green-500",
    actions: [
      { label: "Cardiovascular", prompt: "Gostaria de realizar exame físico cardiovascular: ausculta cardíaca, pulsos, pressão venosa jugular, perfusão periférica." },
      { label: "Respiratório", prompt: "Gostaria de realizar exame físico respiratório: inspeção, palpação, percussão e ausculta pulmonar." },
      { label: "Abdome", prompt: "Gostaria de realizar exame físico abdominal: inspeção, ausculta, palpação superficial e profunda, percussão." },
      { label: "Neurológico", prompt: "Gostaria de realizar exame neurológico: nível de consciência, pupilas, força muscular, reflexos, sensibilidade, sinais meníngeos." },
      { label: "Musculoesq.", prompt: "Gostaria de realizar exame do sistema musculoesquelético: inspeção, palpação, amplitude de movimento, testes especiais." },
      { label: "Cabeça/Pescoço", prompt: "Gostaria de examinar cabeça e pescoço: orofaringe, otoscopia, linfonodos cervicais, tireoide, rigidez de nuca." },
      { label: "Pele/Mucosas", prompt: "Gostaria de examinar pele e mucosas: coloração, hidratação, lesões, edema, turgor." },
    ],
  },
  {
    label: "Exames",
    icon: FileSearch,
    color: "text-purple-500",
    actions: [
      { label: "Hemograma", prompt: "Solicito hemograma completo." },
      { label: "Bioquímica", prompt: "Solicito exames bioquímicos: glicemia, ureia, creatinina, sódio, potássio, TGO, TGP, bilirrubinas." },
      { label: "Gasometria", prompt: "Solicito gasometria arterial." },
      { label: "ECG", prompt: "Solicito eletrocardiograma de 12 derivações." },
      { label: "Rx Tórax", prompt: "Solicito radiografia de tórax PA e perfil." },
      { label: "TC", prompt: "Solicito tomografia computadorizada." },
      { label: "USG", prompt: "Solicito ultrassonografia." },
      { label: "RM", prompt: "Solicito ressonância magnética." },
    ],
  },
  {
    label: "Conduta",
    icon: Syringe,
    color: "text-red-500",
    actions: [
      { label: "Acesso Venoso", prompt: "Providenciar acesso venoso periférico calibroso e iniciar hidratação venosa." },
      { label: "Monitorização", prompt: "Solicito monitorização cardíaca contínua, oximetria de pulso e PA não-invasiva." },
      { label: "Oxigenoterapia", prompt: "Iniciar oxigenoterapia suplementar." },
      { label: "Sonda", prompt: "Solicitar passagem de sonda (nasogástrica/vesical conforme indicação)." },
      { label: "IOT", prompt: "Preparo para intubação orotraqueal: kit de via aérea, drogas de sequência rápida, posicionamento." },
    ],
  },
  {
    label: "Tratamento",
    icon: Pill,
    color: "text-orange-500",
    actions: [
      { label: "Analgesia", prompt: "Prescrevo analgesia: dipirona 1g EV ou tramadol 100mg EV, conforme intensidade da dor. Avaliar escala de dor." },
      { label: "Antibiótico", prompt: "Inicio antibioticoterapia empírica. Qual o esquema mais adequado para a suspeita clínica? Prescrevo conforme protocolo institucional." },
      { label: "Anticoagulação", prompt: "Avalio indicação de anticoagulação. Prescrevo heparina conforme peso e indicação clínica." },
      { label: "Corticoide", prompt: "Prescrevo corticoterapia: hidrocortisona/metilprednisolona EV conforme indicação." },
      { label: "Droga Vasoativa", prompt: "Inicio noradrenalina 0,1 mcg/kg/min em BIC, titular conforme PAM alvo ≥ 65 mmHg." },
      { label: "Sedação", prompt: "Prescrevo sedação: midazolam + fentanil em BIC para paciente intubado, ou diazepam EV para agitação." },
      { label: "Cristaloide", prompt: "Prescrevo expansão volêmica com SF 0,9% 500-1000ml EV rápido, reavaliar resposta hemodinâmica." },
      { label: "Alta/Internação", prompt: "Defino destino do paciente: alta hospitalar com orientações, ou internação em enfermaria/UTI. Justifico a decisão." },
    ],
  },
];

const DIFFICULTY_TIMER: Record<string, number> = {
  "básico": 30 * 60,
  "intermediário": 20 * 60,
  "avançado": 15 * 60,
};

type Phase = "lobby" | "active" | "finishing" | "result";

// ABCDE Checklist definitions
const ABCDE_STEPS = [
  { key: "A", label: "Vias Aéreas", icon: Wind, keywords: ["via aérea", "vias aéreas", "airway", "orofaringe", "cânula", "guedel", "intub", "iot", "traqueo", "aspirar via"] },
  { key: "B", label: "Respiração", icon: Wind, keywords: ["ausculta pulmonar", "respiratório", "pulmão", "pulmões", "murmúrio", "sibilos", "estertores", "crepitações", "oxigên", "spo2", "ventil", "ambu", "nebuliz"] },
  { key: "C", label: "Circulação", icon: Droplets, keywords: ["acesso venoso", "hidratação", "soro", "cristaloide", "volume", "pulso", "perfusão", "enchimento capilar", "hemorrag", "sangr", "droga vasoativa", "noradrenalina", "ausculta cardíaca", "cardiovascular"] },
  { key: "D", label: "Neurológico", icon: Brain, keywords: ["neurológico", "consciência", "glasgow", "pupilas", "reflexo", "força muscular", "sensibilidade", "meníngeo", "nível de consciência", "confuso", "orientado"] },
  { key: "E", label: "Exposição", icon: Eye, keywords: ["exposição", "despir", "temperatura", "hipotermia", "pele", "mucosa", "dorso", "região lombar", "extremidades", "membros", "edema", "cianose", "turgor"] },
] as const;

// Medical record types
interface MedicalRecordEntry {
  category: "anamnesis" | "physical_exam" | "lab" | "imaging" | "prescription" | "other";
  summary: string;
  system?: string;
  timestamp: number;
}

interface CategoryScores {
  anamnesis: number;
  physical_exam: number;
  complementary_exams: number;
  management: number;
}

interface Vitals {
  PA: string;
  FC: string;
  FR: string;
  Temp: string;
  SpO2: string;
}

interface ManeuverPerformed {
  name: string;
  technique: string;
  finding: string;
  interpretation: string;
}

interface ChatMessage {
  role: "doctor" | "simulation";
  content: string;
  type?: string;
  scoreDelta?: number;
  timestamp: number;
  teachingTip?: string;
  maneuversPerformed?: ManeuverPerformed[];
}

interface ActionTimelineEntry {
  label: string;
  icon: string;
  timestamp: number;
}

interface EvalCategory {
  score: number;
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
  correct_diagnosis: string;
  student_got_diagnosis: boolean;
  time_total_minutes: number;
  evaluation: Record<string, EvalCategory>;
  differential_diagnosis?: DifferentialDiagnosis[];
  strengths: string[];
  improvements: string[];
  ideal_approach: string;
  ideal_prescription?: string;
  physical_exam_expected?: {
    inspection?: string[];
    palpation?: string[];
    auscultation?: string[];
    vital_signs_expected?: string;
    maneuvers?: { name: string; technique: string; positive_finding: string; indicates: string }[];
  };
  xp_earned: number;
}

const EVAL_LABELS: Record<string, string> = {
  anamnesis: "Anamnese",
  physical_exam: "Exame Físico",
  complementary_exams: "Exames Complementares",
  diagnosis: "Diagnóstico",
  prescription: "Prescrição",
  management: "Conduta",
  referral: "Parecer/Encaminhamento",
};

const EVAL_MAX_SCORES: Record<string, number> = {
  anamnesis: 15,
  physical_exam: 15,
  complementary_exams: 15,
  diagnosis: 15,
  prescription: 15,
  management: 15,
  referral: 10,
};

// Sound feedback helper
const playSound = (type: "response" | "worsened" | "positive" | "negative") => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;

    switch (type) {
      case "response":
        osc.frequency.value = 520;
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        break;
      case "worsened":
        osc.frequency.value = 220;
        osc.type = "sawtooth";
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        break;
      case "positive":
        osc.frequency.value = 660;
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        break;
      case "negative":
        osc.frequency.value = 330;
        osc.type = "square";
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        break;
    }
  } catch {}
};

// Highlight vital signs inline as badges
const VITAL_REGEX = /\b(PA|PAS|PAD|FC|FR|SpO2|Temp|Sat)\s*[:=]?\s*(\d{2,3}(?:[\/x]\d{2,3})?)\s*(mmHg|bpm|irpm|rpm|%|°C|ºC)?/gi;

const highlightVitals = (children: React.ReactNode): React.ReactNode => {
  if (!children) return children;
  if (typeof children === "string") {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(VITAL_REGEX.source, "gi");
    while ((match = regex.exec(children)) !== null) {
      if (match.index > lastIndex) parts.push(children.slice(lastIndex, match.index));
      const label = match[1].toUpperCase();
      const value = match[2];
      const unit = match[3] || "";
      parts.push(
        <span key={match.index} className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-semibold not-prose">
          <HeartPulse className="h-3 w-3" />
          {label} {value}{unit}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (parts.length === 0) return children;
    if (lastIndex < children.length) parts.push(children.slice(lastIndex));
    return <>{parts}</>;
  }
  if (Array.isArray(children)) return children.map((c, i) => <React.Fragment key={i}>{highlightVitals(c)}</React.Fragment>);
  return children;
};

const ClinicalSimulation = () => {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const queryClient = useQueryClient();
  const { refreshAll } = useRefreshUserState();
  const [searchParams] = useSearchParams();
  const studyCtx = useStudyContext();
  const teacherCaseId = searchParams.get("teacher_case_id");
  const paramOrigin = (searchParams.get("origin") as SessionOrigin) || "manual";
  const { startSession: startTrackedSession, completeSession: completeTrackedSession, abandonSession: abandonTrackedSession } = useSessionTracking();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [specialty, setSpecialty] = useState(studyCtx?.specialty || "Clínica Médica");
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [subtopic, setSubtopic] = useState(studyCtx?.subtopic || "");
  const [difficulty, setDifficulty] = useState("intermediário");
  const [pediatricAge, setPediatricAge] = useState("aleatorio");
  const [realisticMode, setRealisticMode] = useState(false);

  const isPediatrics = specialty === "Pediatria";
  const [loading, setLoading] = useState(false);

  // Simulation state
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [setting, setSetting] = useState("");
  const [triageColor, setTriageColor] = useState("");
  const [patientStatus, setPatientStatus] = useState("estável");
  const [prevPatientStatus, setPrevPatientStatus] = useState("estável");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(50);
  const [prevScore, setPrevScore] = useState(50);
  const [scoreFlash, setScoreFlash] = useState<"green" | "red" | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [finalEval, setFinalEval] = useState<FinalEval | null>(null);
  const [actionTimeline, setActionTimeline] = useState<ActionTimelineEntry[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Countdown timer
  const [countdown, setCountdown] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Specialist dialog
  const [specialistDialogOpen, setSpecialistDialogOpen] = useState(false);
  const [specialistArea, setSpecialistArea] = useState("");

  // Prescription dialog
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);

  // Vitals snapshots for chart
  const [vitalsSnapshots, setVitalsSnapshots] = useState<any[]>([]);

  // Exam results panel
  const [examResults, setExamResults] = useState<Array<{ type: "lab" | "imaging"; content: string; timestamp: number }>>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mobile vitals sheet
  const [mobileVitalsOpen, setMobileVitalsOpen] = useState(false);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  // Patient status alert animation
  const [statusAlert, setStatusAlert] = useState(false);
  // Inactivity / realistic mode
  const [deteriorationCount, setDeteriorationCount] = useState(0);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const lastActionTimeRef = useRef<number>(Date.now());
  const deteriorationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // NEW: ABCDE Checklist
  const [abcdeChecklist, setAbcdeChecklist] = useState<Record<string, boolean>>({ A: false, B: false, C: false, D: false, E: false });

  // NEW: Mini-Prontuário
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecordEntry[]>([]);
  const [medRecordOpen, setMedRecordOpen] = useState(false);

  // NEW: Learner Mode
  const [learnerMode, setLearnerMode] = useState(false);

  // NEW: Category Scores (real-time)
  const [categoryScores, setCategoryScores] = useState<CategoryScores>({ anamnesis: 0, physical_exam: 0, complementary_exams: 0, management: 0 });

  // NEW: ABCDE panel open
  const [abcdeOpen, setAbcdeOpen] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Session persistence
  const { pendingSession, checked, completeSession: completePersistedSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "clinical-simulation" });

  const getClinicalState = useCallback(() => {
    if (phase !== "active") return {};
    return { phase, specialty, difficulty, realisticMode, learnerMode, messages: messages.map(m => ({ ...m })), vitals, setting, triageColor, patientStatus, score, timeElapsed, conversationHistory, actionTimeline, examResults, vitalsSnapshots, countdown, abcdeChecklist, medicalRecord, categoryScores };
  }, [phase, specialty, difficulty, realisticMode, learnerMode, messages, vitals, setting, triageColor, patientStatus, score, timeElapsed, conversationHistory, actionTimeline, examResults, vitalsSnapshots, countdown, abcdeChecklist, medicalRecord, categoryScores]);

  // ABCDE auto-detection
  const detectABCDE = useCallback((text: string) => {
    const lower = text.toLowerCase();
    setAbcdeChecklist(prev => {
      const next = { ...prev };
      ABCDE_STEPS.forEach(step => {
        if (!next[step.key] && step.keywords.some(kw => lower.includes(kw))) {
          next[step.key] = true;
        }
      });
      return next;
    });
  }, []);

  useEffect(() => { registerAutoSave(getClinicalState); }, [getClinicalState, registerAutoSave]);

  const restoreClinicalSession = useCallback((data: Record<string, any>) => {
    if (data.specialty) setSpecialty(data.specialty);
    if (data.difficulty) setDifficulty(data.difficulty);
    if (data.realisticMode !== undefined) setRealisticMode(data.realisticMode);
    if (data.messages) setMessages(data.messages);
    if (data.vitals) setVitals(data.vitals);
    if (data.setting) setSetting(data.setting);
    if (data.triageColor) setTriageColor(data.triageColor);
    if (data.patientStatus) setPatientStatus(data.patientStatus);
    if (typeof data.score === "number") setScore(data.score);
    if (typeof data.timeElapsed === "number") setTimeElapsed(data.timeElapsed);
    if (data.conversationHistory) setConversationHistory(data.conversationHistory);
    if (data.actionTimeline) setActionTimeline(data.actionTimeline);
    if (data.examResults) setExamResults(data.examResults);
    if (data.vitalsSnapshots) setVitalsSnapshots(data.vitalsSnapshots);
    if (typeof data.countdown === "number") setCountdown(data.countdown);
    setPhase("active");
    clearPending();
  }, [clearPending]);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clinical-simulation`;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Score flash effect
  useEffect(() => {
    if (scoreFlash) {
      const t = setTimeout(() => setScoreFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [scoreFlash]);

  // Status alert effect
  useEffect(() => {
    if (patientStatus !== prevPatientStatus && phase === "active") {
      const severity = ["estável", "instável", "grave", "crítico"];
      const oldIdx = severity.indexOf(prevPatientStatus);
      const newIdx = severity.indexOf(patientStatus);
      if (newIdx > oldIdx) {
        setStatusAlert(true);
        playSound("worsened");
        toast({
          title: `⚠️ Paciente ${patientStatus}!`,
          description: `Status mudou de ${prevPatientStatus} para ${patientStatus}`,
          variant: "destructive",
        });
        setTimeout(() => setStatusAlert(false), 2000);
      }
      setPrevPatientStatus(patientStatus);
    }
  }, [patientStatus]);

  // Countdown timer effect
  useEffect(() => {
    if (phase === "active" && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setTimerExpired(true);
            toast({
              title: "⏰ Tempo esgotado!",
              description: "O tempo do plantão acabou! Encerre o atendimento agora.",
              variant: "destructive",
            });
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              gain.gain.value = 0.3;
              osc.start();
              osc.stop(ctx.currentTime + 0.5);
            } catch {}
            return 0;
          }
          if (prev === 121) {
            toast({ title: "⚠️ 2 minutos restantes!", description: "Finalize seu atendimento rapidamente." });
          }
          if (prev === 301) {
            toast({ title: "⏱️ 5 minutos restantes", description: "Considere fechar seu diagnóstico e prescrição." });
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [phase, countdown > 0]);


  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  const deleteHistoryItem = useCallback(async (id: string) => {
    try {
      await supabase.from("simulation_history").delete().eq("id", id).eq("user_id", user!.id);
      setHistory(prev => prev.filter(h => h.id !== id));
      toast({ title: "Plantão removido do histórico" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }, [user, toast]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (teacherCaseId && phase === "lobby" && !loading) {
      startSimulation();
    }
  }, [teacherCaseId]);

  const saveSimulationToHistory = async (evalData: FinalEval) => {
    if (!user) return;
    try {
      await supabase.from("simulation_history").insert({
        user_id: user.id,
        specialty,
        difficulty,
        final_score: evalData.final_score,
        grade: evalData.grade,
        correct_diagnosis: evalData.correct_diagnosis,
        student_got_diagnosis: evalData.student_got_diagnosis,
        time_total_minutes: evalData.time_total_minutes,
        evaluation: evalData.evaluation as any,
        differential_diagnosis: (evalData.differential_diagnosis || []) as any,
        strengths: evalData.strengths as any,
        improvements: evalData.improvements as any,
        ideal_approach: evalData.ideal_approach,
        ideal_prescription: evalData.ideal_prescription || null,
        xp_earned: evalData.xp_earned,
      });
      // Complete tracked session
      await completeTrackedSession("simulation", {
        finalScore: evalData.final_score,
        sessionData: { grade: evalData.grade, correct_diagnosis: evalData.correct_diagnosis },
      });
    } catch (e) {
      console.error("Error saving simulation:", e);
    }
  };

  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro");
    return data;
  }, [session, API_URL]);

  const addToTimeline = (label: string, icon: string) => {
    setActionTimeline((prev) => [...prev, { label, icon, timestamp: Date.now() }]);
  };

  // --- Realistic mode: inactivity deterioration ---
  const triggerDeterioration = useCallback(async (level: number) => {
    if (loading || phase !== "active") return;
    setLoading(true);
    setIsTyping(true);
    setInactivityWarning(false);

    const doctorMsg: ChatMessage = {
      role: "doctor",
      content: `⚠️ [Sistema] Paciente aguardou sem conduta — deterioração automática (nível ${level})`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, doctorMsg]);

    try {
      const updatedHistory = [...conversationHistory, { role: "user", content: `[SISTEMA: O aluno ficou inativo por 90 segundos. Nível de deterioração: ${level}/3. Piore o paciente proporcionalmente.]` }];
      const res = await callAPI({
        action: "deteriorate",
        deterioration_level: level,
        conversation_history: updatedHistory,
        triage_color: triageColor,
        patient_status: patientStatus,
      });

      setIsTyping(false);
      playSound("worsened");

      const simMsg: ChatMessage = {
        role: "simulation",
        content: res.response,
        type: "deterioration",
        scoreDelta: res.score_delta,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, simMsg]);
      addToTimeline(`⚠️ Paciente piorou (inatividade nível ${level})`, "🔻");

      const newScore = Math.max(0, Math.min(100, score + (res.score_delta || -3)));
      setScoreFlash("red");
      setPrevScore(score);
      setScore(newScore);

      if (res.vitals) {
        setVitals(res.vitals);
        const newTime = res.time_elapsed_minutes || timeElapsed + 2;
        setTimeElapsed(newTime);
        setVitalsSnapshots((prev) => [...prev, parseVitalsToSnapshot(res.vitals, newTime)]);
      }
      if (res.patient_status) setPatientStatus(res.patient_status);

      setConversationHistory([
        ...updatedHistory,
        { role: "assistant", content: JSON.stringify(res) },
      ]);

      if (level >= 3) {
        toast({
          title: "💀 Paciente em parada cardíaca!",
          description: "O paciente evoluiu para parada por falta de conduta. O caso será encerrado.",
          variant: "destructive",
        });
        setTimeout(() => finishSimulation(), 2000);
      }
    } catch (e) {
      setIsTyping(false);
      console.error("Deterioration error:", e);
    } finally {
      setLoading(false);
    }
  }, [loading, phase, conversationHistory, callAPI, score, timeElapsed, vitals]);

  useEffect(() => {
    if (!realisticMode || phase !== "active") {
      if (deteriorationIntervalRef.current) {
        clearInterval(deteriorationIntervalRef.current);
        deteriorationIntervalRef.current = null;
      }
      setInactivityWarning(false);
      return;
    }

    lastActionTimeRef.current = Date.now();

    deteriorationIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastActionTimeRef.current) / 1000;
      if (elapsed >= 60 && elapsed < 90) {
        setInactivityWarning(true);
      } else if (elapsed < 60) {
        setInactivityWarning(false);
      }
      if (elapsed >= 90) {
        setInactivityWarning(false);
        lastActionTimeRef.current = Date.now();
        setDeteriorationCount((prev) => {
          const next = prev + 1;
          triggerDeterioration(next);
          return next;
        });
      }
    }, 10000);

    return () => {
      if (deteriorationIntervalRef.current) {
        clearInterval(deteriorationIntervalRef.current);
        deteriorationIntervalRef.current = null;
      }
    };
  }, [realisticMode, phase, triggerDeterioration]);

  const startSimulation = async () => {
    setLoading(true);
    setAbcdeChecklist({ A: false, B: false, C: false, D: false, E: false });
    setMedicalRecord([]);
    setCategoryScores({ anamnesis: 0, physical_exam: 0, complementary_exams: 0, management: 0 });
    try {
      // Fetch user profile (target_exams, exam_date) and recent errors for this specialty
      let targetExams: string[] = [];
      let examProximityDays: number | null = null;
      let recentErrors: { has_errors: boolean; error_types: string[]; themes: string[] } = { has_errors: false, error_types: [], themes: [] };

      if (user) {
        const [profileRes, errorsRes] = await Promise.all([
          supabase.from("profiles").select("target_exams, exam_date").eq("user_id", user.id).maybeSingle(),
          supabase.from("error_bank").select("tema, categoria_erro").eq("user_id", user.id).eq("dominado", false).limit(50),
        ]);

        if (profileRes.data) {
          const te = profileRes.data.target_exams;
          if (Array.isArray(te)) targetExams = te as string[];
          if (profileRes.data.exam_date) {
            const diff = Math.ceil((new Date(profileRes.data.exam_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diff > 0) examProximityDays = diff;
          }
        }

        if (errorsRes.data && errorsRes.data.length > 0) {
          // Filter errors related to current specialty via tema mapping
          const specLower = (specialty || "").toLowerCase();
          const relevantErrors = errorsRes.data.filter((e: any) => {
            const tema = (e.tema || "").toLowerCase();
            return tema.includes(specLower) || specLower.includes(tema) || true; // include all for broad context
          });
          if (relevantErrors.length > 0) {
            const errorTypes = [...new Set(relevantErrors.map((e: any) => e.categoria_erro).filter(Boolean))] as string[];
            const themes = [...new Set(relevantErrors.slice(0, 5).map((e: any) => e.tema).filter(Boolean))] as string[];
            recentErrors = { has_errors: true, error_types: errorTypes, themes };
          }
        }
      }

      const res = await callAPI({
        action: "start",
        specialty,
        subtopic: subtopic.trim() || undefined,
        difficulty,
        learner_mode: learnerMode,
        ...(teacherCaseId ? { teacher_case_id: teacherCaseId } : {}),
        ...(isPediatrics && pediatricAge !== "aleatorio" ? { pediatric_age_range: pediatricAge } : {}),
        ...(targetExams.length > 0 ? { target_exams: targetExams } : {}),
        ...(recentErrors.has_errors ? { recent_errors: recentErrors } : {}),
        ...(examProximityDays !== null ? { exam_proximity_days: examProximityDays } : {}),
      });

      setVitals(res.vitals);
      setSetting(res.setting || "Pronto-Socorro");
      setTriageColor(res.triage_color || "amarelo");
      setPatientStatus("estável");
      setPrevPatientStatus("estável");
      setScore(50);
      setPrevScore(50);
      setTimeElapsed(0);
      setTimerExpired(false);
      setCountdown(DIFFICULTY_TIMER[difficulty] || 20 * 60);
      setExamResults([]);
      setActionTimeline([]);
      setStatusAlert(false);

      if (res.vitals) {
        setVitalsSnapshots([parseVitalsToSnapshot(res.vitals, 0)]);
      }

      const patientMsg = res.patient_presentation;
      const simMsg: ChatMessage = {
        role: "simulation",
        content: `📍 **${res.setting || "Pronto-Socorro"}** | Triagem: ${getTriageEmoji(res.triage_color)}\n\n${patientMsg}`,
        type: "presentation",
        timestamp: Date.now(),
      };

      setMessages([simMsg]);
      const startHistory = [{ role: "assistant", content: JSON.stringify(res) }];
      setConversationHistory(startHistory);
      setPhase("active");
      addToTimeline("Caso iniciado", "🏥");

      // Track session origin
      if (user) {
        const origin = teacherCaseId ? "assigned" as SessionOrigin : paramOrigin;
        startTrackedSession({ type: "simulation", userId: user.id, specialty, difficulty, origin });
      }

      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao iniciar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text?: string, timelineLabel?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    lastActionTimeRef.current = Date.now();
    setInactivityWarning(false);

    const doctorMsg: ChatMessage = { role: "doctor", content: msg, timestamp: Date.now() };
    setMessages((prev) => [...prev, doctorMsg]);
    setLoading(true);
    setIsTyping(true);

    if (timelineLabel) {
      addToTimeline(timelineLabel, "📋");
    }

    try {
      const updatedHistory = [...conversationHistory, { role: "user", content: msg }];
      const res = await callAPI({
        action: "interact",
        message: msg,
        conversation_history: updatedHistory,
        learner_mode: learnerMode,
      });

      // ABCDE detection from user message
      detectABCDE(msg);

      setIsTyping(false);
      playSound("response");

      const simMsg: ChatMessage = {
        role: "simulation",
        content: res.response,
        type: res.response_type,
        scoreDelta: res.score_delta,
        timestamp: Date.now(),
        teachingTip: res.teaching_tip || undefined,
        maneuversPerformed: res.maneuvers_performed || undefined,
      };

      setMessages((prev) => [...prev, simMsg]);

      // Score with flash
      const newScore = Math.max(0, Math.min(100, score + (res.score_delta || 0)));
      if (res.score_delta && res.score_delta !== 0) {
        setScoreFlash(res.score_delta > 0 ? "green" : "red");
        playSound(res.score_delta > 0 ? "positive" : "negative");
      }
      setPrevScore(score);
      setScore(newScore);

      const newTimeElapsed = res.time_elapsed_minutes || timeElapsed + 5;
      setTimeElapsed(newTimeElapsed);
      if (res.patient_status) setPatientStatus(res.patient_status);

      // Track exam results
      const rt = (res.response_type || "").toLowerCase();
      const responseText = (res.response || "").toLowerCase();
      const isLabResult = rt === "lab_result" || rt === "lab_results" || rt === "lab" ||
        (responseText.includes("g/dl") || responseText.includes("mg/dl") || responseText.includes("mm³") ||
         responseText.includes("ref:") || responseText.includes("referência") || responseText.includes("hemograma") && responseText.includes("leucócitos"));
      const isImagingResult = rt === "imaging" || rt === "imaging_result" || rt === "image" ||
        (responseText.includes("laudo") && (responseText.includes("tomografia") || responseText.includes("radiografia") || responseText.includes("ultrassonografia") || responseText.includes("ressonância")));

      if (isLabResult && res.response) {
        setExamResults((prev) => [...prev, { type: "lab", content: res.response, timestamp: Date.now() }]);
      }
      if (isImagingResult && res.response) {
        setExamResults((prev) => [...prev, { type: "imaging", content: res.response, timestamp: Date.now() }]);
      }

      // Vitals snapshots
      if (res.vitals) {
        setVitals(res.vitals);
        setVitalsSnapshots((prev) => [...prev, parseVitalsToSnapshot(res.vitals, newTimeElapsed)]);
      } else if (vitals && res.patient_status && res.patient_status !== patientStatus) {
        setVitalsSnapshots((prev) => [...prev, parseVitalsToSnapshot(vitals as any, newTimeElapsed)]);
      }

      // Handle treatment outcome feedback
      if (res.treatment_outcome) {
        const outcomeMap: Record<string, { title: string; desc: string; variant: "default" | "destructive" }> = {
          improved: { title: "✅ Paciente melhorando", desc: "O tratamento prescrito está surtindo efeito positivo.", variant: "default" },
          partial: { title: "⚠️ Melhora parcial", desc: "O tratamento teve efeito parcial. Considere ajustar dose ou adicionar outra intervenção.", variant: "default" },
          worsened: { title: "🚨 Paciente piorou após tratamento", desc: "A medicação prescrita pode estar inadequada ou contraindicada!", variant: "destructive" },
          no_effect: { title: "⏳ Sem efeito observado", desc: "O tratamento não apresentou resultado significativo ainda.", variant: "default" },
        };
        const outcome = outcomeMap[res.treatment_outcome];
        if (outcome) {
          toast({ title: outcome.title, description: outcome.desc, variant: outcome.variant });
          if (res.treatment_outcome === "improved") playSound("positive");
          if (res.treatment_outcome === "worsened") playSound("worsened");
        }
        addToTimeline(`💊 Tratamento: ${res.treatment_outcome === "improved" ? "eficaz" : res.treatment_outcome === "worsened" ? "inadequado" : "parcial"}`, "💊");
      }

      // Handle critical action needed
      if (res.critical_action_needed) {
        toast({
          title: "🚨 ALERTA CRÍTICO",
          description: res.critical_action_needed,
          variant: "destructive",
        });
        playSound("worsened");
      }

      // Update category scores
      if (res.category_scores) {
        setCategoryScores(res.category_scores);
      }

      // Update medical record from structured_data
      if (res.structured_data?.summary) {
        const sd = res.structured_data;
        const categoryMap: Record<string, MedicalRecordEntry["category"]> = {
          anamnesis: "anamnesis", physical_exam: "physical_exam", lab: "lab",
          imaging: "imaging", prescription: "prescription",
        };
        setMedicalRecord(prev => [...prev, {
          category: categoryMap[sd.type] || "other",
          summary: sd.summary,
          system: sd.system || undefined,
          timestamp: Date.now(),
        }]);
      }

      setConversationHistory([
        ...updatedHistory,
        { role: "assistant", content: JSON.stringify(res) },
      ]);
    } catch (e) {
      setIsTyping(false);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const requestPreceptorHint = async () => {
    if (loading) return;
    setLoading(true);
    setIsTyping(true);
    addToTimeline("Ajuda preceptor", "🆘");

    const doctorMsg: ChatMessage = {
      role: "doctor",
      content: "🆘 Solicitando ajuda do preceptor...",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, doctorMsg]);

    try {
      const res = await callAPI({
        action: "hint",
        conversation_history: conversationHistory,
      });

      setIsTyping(false);

      let content = res.response || "";
      if (res.clinical_reasoning_tips?.length) {
        content += "\n\n💡 **Dicas de raciocínio clínico:**\n" + res.clinical_reasoning_tips.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n");
      }
      if (res.suggested_next_steps?.length) {
        content += "\n\n➡️ **Próximos passos sugeridos:**\n" + res.suggested_next_steps.map((s: string) => `• ${s}`).join("\n");
      }

      const simMsg: ChatMessage = {
        role: "simulation",
        content,
        type: "preceptor_hint",
        scoreDelta: res.score_delta || 0,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, simMsg]);
      setConversationHistory([
        ...conversationHistory,
        { role: "user", content: "Solicito ajuda do preceptor" },
        { role: "assistant", content: JSON.stringify(res) },
      ]);
    } catch (e) {
      setIsTyping(false);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const requestSpecialistOpinion = async () => {
    if (loading || !specialistArea.trim()) return;
    setSpecialistDialogOpen(false);
    setLoading(true);
    setIsTyping(true);
    addToTimeline(`Parecer: ${specialistArea}`, "📋");

    const doctorMsg: ChatMessage = {
      role: "doctor",
      content: `📋 Solicitando parecer de ${specialistArea}...`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, doctorMsg]);

    try {
      const res = await callAPI({
        action: "specialist",
        specialist_area: specialistArea,
        conversation_history: conversationHistory,
      });

      setIsTyping(false);

      let content = `**Parecer - ${res.specialist || specialistArea}**\n\n${res.response || ""}`;
      if (res.recommendations?.length) {
        content += "\n\n📌 **Recomendações:**\n" + res.recommendations.map((r: string) => `• ${r}`).join("\n");
      }
      if (res.relevance) {
        const relevanceMap: Record<string, string> = {
          alta: "✅ Parecer altamente relevante",
          média: "⚠️ Parecer de relevância moderada",
          baixa: "❌ Especialidade pouco relevante para este caso",
        };
        content += `\n\n${relevanceMap[res.relevance] || ""}`;
      }

      const simMsg: ChatMessage = {
        role: "simulation",
        content,
        type: "specialist_opinion",
        scoreDelta: res.score_delta || 0,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, simMsg]);
      setScore((prev) => Math.max(0, Math.min(100, prev + (res.score_delta || 0))));
      setConversationHistory([
        ...conversationHistory,
        { role: "user", content: `Solicito parecer de ${specialistArea}` },
        { role: "assistant", content: JSON.stringify(res) },
      ]);
      setSpecialistArea("");
    } catch (e) {
      setIsTyping(false);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const finishSimulation = async () => {
    setLoading(true);
    setPhase("finishing");
    try {
      const res = await callAPI({
        action: "finish",
        conversation_history: conversationHistory,
        ...(teacherCaseId ? { teacher_case_id: teacherCaseId } : {}),
      });
      setFinalEval(res);
      setPhase("result");
      await completePersistedSession();
      await addXp(XP_REWARDS.plantao_completed);
      if (user?.id) {
        await completeStudyAction({
          userId: user.id,
          taskType: "clinical",
          topic: specialty || "Simulação Clínica",
          source: "auto",
          originModule: "clinical-simulation",
        });
      }
      refreshAll();
      await saveSimulationToHistory(res);

      if (user && res.final_score < 70) {
        const weakAreas = res.weak_areas || res.areas_to_improve || [];
        await logErrorToBank({
          userId: user.id,
          tema: specialty,
          tipoQuestao: "simulado",
          conteudo: `Modo Plantão - ${specialty} (${difficulty})`,
          motivoErro: weakAreas.length > 0
            ? `Áreas fracas: ${Array.isArray(weakAreas) ? weakAreas.join("; ") : weakAreas}`
            : `Nota ${res.final_score}/100 - Conceito ${res.grade}`,
          categoriaErro: "conduta",
          dificuldade: difficulty === "avançado" ? 5 : difficulty === "intermediário" ? 3 : 1,
        });
      }
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
      setPhase("active");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhase("lobby");
    setMessages([]);
    setConversationHistory([]);
    setScore(50);
    setPrevScore(50);
    setTimeElapsed(0);
    setFinalEval(null);
    setVitals(null);
    setCountdown(0);
    setTimerExpired(false);
    setVitalsSnapshots([]);
    setExamResults([]);
    setActionTimeline([]);
    setStatusAlert(false);
    setDeteriorationCount(0);
    setInactivityWarning(false);
    setAbcdeChecklist({ A: false, B: false, C: false, D: false, E: false });
    setMedicalRecord([]);
    setCategoryScores({ anamnesis: 0, physical_exam: 0, complementary_exams: 0, management: 0 });
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (deteriorationIntervalRef.current) clearInterval(deteriorationIntervalRef.current);
    fetchHistory();
  };

  // PDF Export
  const exportCasePdf = () => {
    if (!finalEval) return;
    const items = [
      { title: "Diagnóstico Correto", content: finalEval.correct_diagnosis, subtitle: finalEval.student_got_diagnosis ? "✅ Você acertou" : "❌ Você não acertou" },
      ...Object.entries(finalEval.evaluation).map(([key, val]) => ({
        title: EVAL_LABELS[key] || key,
        content: val.feedback,
        subtitle: `Score: ${val.score}/${EVAL_MAX_SCORES[key] || 25}`,
      })),
      ...(finalEval.differential_diagnosis || []).map(dd => ({
        title: `Diferencial: ${dd.diagnosis}`,
        content: `Razão: ${dd.reasoning}\nDescartar: ${dd.how_to_rule_out}`,
        subtitle: dd.student_considered ? "Considerado pelo aluno" : "Não considerado",
      })),
      { title: "Abordagem Ideal", content: finalEval.ideal_approach },
      ...(finalEval.ideal_prescription ? [{ title: "Prescrição Modelo", content: finalEval.ideal_prescription }] : []),
      { title: "Pontos Fortes", content: finalEval.strengths.join("\n") },
      { title: "Pontos a Melhorar", content: finalEval.improvements.join("\n") },
    ];
    exportToPdf(items, `Plantão ${specialty} - ${finalEval.grade} (${finalEval.final_score}pts)`);
    toast({ title: "PDF gerado!", description: "O arquivo foi baixado." });
  };

  const getTriageEmoji = (color: string) => {
    const map: Record<string, string> = { vermelho: "🔴 Vermelho (Emergência)", laranja: "🟠 Laranja (Muito Urgente)", amarelo: "🟡 Amarelo (Urgente)", verde: "🟢 Verde (Pouco Urgente)" };
    return map[color] || color;
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (timerExpired || countdown === 0) return "text-destructive";
    if (countdown <= 120) return "text-destructive animate-pulse";
    if (countdown <= 300) return "text-amber-500";
    return "text-primary";
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      estável: "text-green-500",
      instável: "text-amber-500",
      grave: "text-orange-500",
      crítico: "text-destructive",
    };
    return map[status] || "text-muted-foreground";
  };

  const getGradeColor = (grade: string) => {
    const map: Record<string, string> = { A: "text-green-500", B: "text-blue-500", C: "text-amber-500", D: "text-orange-500", F: "text-destructive" };
    return map[grade] || "text-muted-foreground";
  };

  const getTypeIcon = (type?: string) => {
    const map: Record<string, typeof Stethoscope> = {
      anamnesis: MessageCircle,
      physical_exam: Stethoscope,
      lab_result: FileSearch,
      imaging: FileSearch,
      prescription: Syringe,
      treatment: Pill,
      diagnosis_attempt: Target,
      preceptor_hint: HelpCircle,
      specialist_opinion: Users,
    };
    return map[type || ""] || Activity;
  };

  const shareResult = () => {
    if (!finalEval) return;
    const text = `🏥 Plantão Clínico - ${specialty}\n📊 Nota: ${finalEval.final_score}/100 (${finalEval.grade})\n🎯 Diagnóstico: ${finalEval.correct_diagnosis}\n${finalEval.student_got_diagnosis ? "✅ Acertei!" : "❌ Errei"}\n⏱️ ${finalEval.time_total_minutes} min\n✨ +${finalEval.xp_earned} XP`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Resultado copiado para a área de transferência." });
  };

  const retryWithSameConfig = () => {
    setPhase("lobby");
    setMessages([]);
    setConversationHistory([]);
    setScore(50);
    setPrevScore(50);
    setTimeElapsed(0);
    setFinalEval(null);
    setVitals(null);
    setCountdown(0);
    setTimerExpired(false);
    setVitalsSnapshots([]);
    setExamResults([]);
    setActionTimeline([]);
    // keep specialty and difficulty, auto-start
    setTimeout(() => startSimulation(), 300);
  };

  const content = (
    <div className={`animate-fade-in ${isFullscreen ? "fixed inset-0 z-[100] bg-background overflow-auto flex flex-col" : "max-w-6xl mx-auto space-y-4"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isFullscreen ? "px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm shrink-0" : "mb-4 lg:pr-[320px]"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-5 w-5 text-destructive shrink-0" />
          <h1 className="text-lg font-bold truncate">Modo Plantão</h1>
          {!isFullscreen && (
            <p className="text-xs text-muted-foreground hidden md:block">Simulação interativa de atendimento clínico</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {phase === "active" && (
            <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={finishSimulation} disabled={loading}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Encerrar Plantão</span>
            </Button>
          )}
        </div>
      </div>

      <div className={isFullscreen ? "flex-1 overflow-auto p-2 sm:p-4" : ""}>

      {/* LOBBY */}
      {phase === "lobby" && (
        <div className="space-y-4">
        <StudyContextBanner />
        {checked && pendingSession && (
          <ResumeSessionBanner
            updatedAt={pendingSession.updated_at}
            onResume={() => restoreClinicalSession(pendingSession.session_data)}
            onDiscard={() => abandonSession()}
          />
        )}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
                <Activity className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-bold">🏥 Plantão Clínico</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Atenda um paciente virtual em tempo real. Faça anamnese, peça exames, 
                defina diagnóstico e prescreva o tratamento. Cada decisão afeta sua pontuação!
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { icon: MessageCircle, label: "Anamnese", desc: "Interrogue o paciente" },
                { icon: Stethoscope, label: "Exame Físico", desc: "Examine o paciente" },
                { icon: FileSearch, label: "Exames", desc: "Peça complementares" },
                { icon: Syringe, label: "Conduta", desc: "Prescreva e trate" },
              ].map((step, i) => (
                <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <step.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-xs font-semibold">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Especialidade do Caso</label>
                <CycleFilter activeCycle={cycleFilter} onCycleChange={setCycleFilter} className="mb-2" />
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                   {getFilteredSpecialties(cycleFilter).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Input
                  value={subtopic}
                  onChange={(e) => setSubtopic(e.target.value)}
                  placeholder="Ex: IAM, Dengue Grave, Eclâmpsia..."
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Subassunto (opcional): direcione o caso clínico</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dificuldade</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="básico">Básico</option>
                  <option value="intermediário">Intermediário</option>
                  <option value="avançado">Avançado</option>
                </select>
              </div>
            </div>

            {isPediatrics && (
              <div className="animate-fade-in space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  👶 Faixa Etária Pediátrica
                </label>
                <select
                  value={pediatricAge}
                  onChange={(e) => setPediatricAge(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {PEDIATRIC_AGE_RANGES.map(a => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
                {pediatricAge !== "aleatorio" && (
                  <p className="text-xs text-muted-foreground">
                    📊 Valores de referência: {PEDIATRIC_AGE_RANGES.find(a => a.key === pediatricAge)?.vitalRef}
                  </p>
                )}
              </div>
            )}

            {/* Modo Real toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
              <div className="space-y-1">
                <label className="text-sm font-semibold flex items-center gap-2">
                  🔴 Modo Real
                </label>
                <p className="text-xs text-muted-foreground">
                  Paciente piora automaticamente se você demorar para agir (90s de inatividade)
                </p>
              </div>
              <Switch
                checked={realisticMode}
                onCheckedChange={setRealisticMode}
              />
            </div>

            {/* Modo Aprendiz toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
              <div className="space-y-1">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Modo Aprendiz
                </label>
                <p className="text-xs text-muted-foreground">
                  Receba dicas didáticas contextuais após cada ação clínica
                </p>
              </div>
              <Switch
                checked={learnerMode}
                onCheckedChange={setLearnerMode}
              />
            </div>
            <Button onClick={startSimulation} disabled={loading} className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {loading ? "Preparando plantão..." : "🚨 Iniciar Plantão"}
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Histórico de Plantões
              </h4>
              <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={historyLoading} className="text-xs gap-1">
                <RotateCcw className={`h-3 w-3 ${historyLoading ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>

            {historyLoading && history.length === 0 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum plantão concluído ainda. Inicie seu primeiro plantão!
              </p>
            )}

            {history.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {history.map((h) => {
                  const gradeColor: Record<string, string> = { A: "text-green-500", B: "text-blue-500", C: "text-amber-500", D: "text-orange-500", F: "text-destructive" };
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedHistory(h)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-black ${gradeColor[h.grade] || "text-muted-foreground"}`}>{h.grade}</span>
                          <span className="text-[10px] text-muted-foreground">{h.final_score}/100</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{h.specialty}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{h.difficulty}</span>
                            <span>•</span>
                            <span>{h.time_total_minutes} min</span>
                            <span>•</span>
                            <span>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {h.student_got_diagnosis ? (
                          <Badge className="bg-green-500/20 text-green-500 text-[10px] gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> ✓</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] gap-0.5"><XCircle className="h-2.5 w-2.5" /> ✗</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(h.id); }}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* History detail dialog */}
      <Dialog open={!!selectedHistory} onOpenChange={() => setSelectedHistory(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedHistory && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  {selectedHistory.specialty} — Conceito {selectedHistory.grade}
                </DialogTitle>
                <DialogDescription>
                  {new Date(selectedHistory.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" • "}{selectedHistory.difficulty} • {selectedHistory.time_total_minutes} min • {selectedHistory.final_score}/100 pts • +{selectedHistory.xp_earned} XP
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className={`p-3 rounded-lg border ${selectedHistory.student_got_diagnosis ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                  <p className="text-xs font-semibold mb-1">Diagnóstico Correto</p>
                  <p className="text-sm font-bold">{selectedHistory.correct_diagnosis}</p>
                  <p className="text-xs mt-1">{selectedHistory.student_got_diagnosis ? "✅ Você acertou" : "❌ Você não acertou"}</p>
                </div>

                {selectedHistory.differential_diagnosis?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-purple-500" /> Diferenciais</p>
                    {selectedHistory.differential_diagnosis.map((dd: any, i: number) => (
                      <div key={i} className={`p-2.5 rounded-lg border text-xs ${dd.student_considered ? "bg-green-500/5 border-green-500/30" : "bg-muted/30 border-border/50"}`}>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {dd.student_considered ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                          {dd.diagnosis}
                        </div>
                        <p className="text-muted-foreground mt-1"><strong>Razão:</strong> {dd.reasoning}</p>
                        <p className="text-muted-foreground"><strong>Descartar:</strong> {dd.how_to_rule_out}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedHistory.evaluation && Object.keys(selectedHistory.evaluation).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">📊 Avaliação por Categoria</p>
                    {Object.entries(selectedHistory.evaluation).map(([key, val]: [string, any]) => {
                      const maxScore = EVAL_MAX_SCORES[key] || 25;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{EVAL_LABELS[key] || key}</span>
                            <span className={`font-bold ${val.score >= maxScore * 0.7 ? "text-green-500" : val.score >= maxScore * 0.5 ? "text-amber-500" : "text-destructive"}`}>
                              {val.score}/{maxScore}
                            </span>
                          </div>
                          <Progress value={(val.score / maxScore) * 100} className="h-1" />
                          <p className="text-[10px] text-muted-foreground">{val.feedback}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {selectedHistory.strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold flex items-center gap-1 mb-1"><CheckCircle className="h-3 w-3 text-green-500" /> Pontos Fortes</p>
                      <ul className="space-y-0.5">{selectedHistory.strengths.map((s: string, i: number) => <li key={i} className="text-[10px] text-muted-foreground">• {s}</li>)}</ul>
                    </div>
                  )}
                  {selectedHistory.improvements?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Melhorar</p>
                      <ul className="space-y-0.5">{selectedHistory.improvements.map((s: string, i: number) => <li key={i} className="text-[10px] text-muted-foreground">• {s}</li>)}</ul>
                    </div>
                  )}
                </div>

                {selectedHistory.ideal_approach && (
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1"><Award className="h-3 w-3 text-primary" /> Abordagem Ideal</p>
                    <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg p-3 border border-primary/20">{selectedHistory.ideal_approach}</p>
                  </div>
                )}

                {selectedHistory.ideal_prescription && (
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1"><Syringe className="h-3 w-3 text-blue-500" /> Prescrição Modelo</p>
                    <p className="text-xs text-muted-foreground bg-blue-500/5 rounded-lg p-3 border border-blue-500/20 font-mono whitespace-pre-wrap">{selectedHistory.ideal_prescription}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ACTIVE SIMULATION */}
      {(phase === "active" || phase === "finishing") && (
        <div className="flex flex-col" style={{ height: isFullscreen ? "calc(100vh - 56px)" : "calc(100vh - 120px)" }}>
          {/* Hospital-style shift header */}
          <div className="shrink-0">
            <ShiftHeader
              patientStatus={patientStatus}
              statusAlert={statusAlert}
              countdown={countdown}
              timerExpired={timerExpired}
              score={score}
              scoreFlash={scoreFlash}
              triageColor={triageColor}
              setting={setting}
              inactivityWarning={inactivityWarning}
              abcdeChecklist={abcdeChecklist}
            />
          </div>

          {/* Clinical Timeline */}
          {actionTimeline.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-1.5 px-3 border-b border-border/30 bg-muted/5 shrink-0">
              {actionTimeline.slice(-8).map((entry, i) => (
                <Badge key={i} variant="outline" className="text-[10px] shrink-0 gap-1 font-normal border-border/30">
                  <span>{entry.icon}</span>
                  {entry.label}
                  <span className="text-muted-foreground/50">
                    {new Date(entry.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </Badge>
              ))}
            </div>
          )}

          {/* 3-column hospital layout */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-0 min-h-0 overflow-hidden shrink">

            {/* LEFT: Patient panel - vitals + ABCDE */}
            <div className="hidden lg:flex flex-col border-r border-border/30 bg-muted/5 overflow-y-auto">
              <div className="p-3 space-y-4">
                {/* Vitals Monitor */}
                <VitalsMonitor
                  snapshots={vitalsSnapshots}
                  patientStatus={patientStatus}
                  statusAlert={statusAlert}
                />

                {/* ABCDE Checklist */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ABCDE</span>
                    <span className="text-[10px] text-muted-foreground">{Object.values(abcdeChecklist).filter(Boolean).length}/5</span>
                  </div>
                  <div className="space-y-1">
                    {ABCDE_STEPS.map(step => (
                      <div key={step.key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                        abcdeChecklist[step.key]
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-muted/20 border border-border/20 opacity-40"
                      }`}>
                        <step.icon className={`h-3.5 w-3.5 ${abcdeChecklist[step.key] ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <span className="text-[11px] font-medium flex-1">{step.label}</span>
                        {abcdeChecklist[step.key] && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category Scores */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Desempenho</span>
                  </div>
                  {[
                    { key: "anamnesis", label: "Anamnese", max: 15 },
                    { key: "physical_exam", label: "Ex. Físico", max: 15 },
                    { key: "complementary_exams", label: "Exames", max: 15 },
                    { key: "management", label: "Conduta", max: 15 },
                  ].map(cat => (
                    <div key={cat.key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">{cat.label}</span>
                        <span className="font-mono font-bold">{categoryScores[cat.key as keyof CategoryScores]}/{cat.max}</span>
                      </div>
                      <Progress value={(categoryScores[cat.key as keyof CategoryScores] / cat.max) * 100} className="h-1" />
                    </div>
                  ))}
                </div>

                {/* Prontuário button */}
                <Sheet open={medRecordOpen} onOpenChange={setMedRecordOpen}>
                  <SheetTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
                      <Clipboard className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold block">Prontuário</span>
                        <span className="text-[9px] text-muted-foreground">{medicalRecord.length} registros</span>
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[340px] sm:w-[400px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Clipboard className="h-5 w-5 text-primary" /> Mini-Prontuário
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-3 overflow-y-auto max-h-[80vh]">
                      {medicalRecord.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8">Nenhuma informação coletada ainda.</p>
                      )}
                      {(["anamnesis", "physical_exam", "lab", "imaging", "prescription"] as const).map(cat => {
                        const entries = medicalRecord.filter(e => e.category === cat);
                        if (entries.length === 0) return null;
                        const catLabels: Record<string, string> = { anamnesis: "📋 Anamnese", physical_exam: "🩺 Exame Físico", lab: "🔬 Laboratório", imaging: "📷 Imagem", prescription: "💊 Prescrição" };
                        return (
                          <div key={cat} className="space-y-1">
                            <p className="text-xs font-semibold">{catLabels[cat]}</p>
                            {entries.map((e, i) => (
                              <div key={i} className="text-xs text-muted-foreground p-2 rounded bg-muted/30 border border-border/30">
                                {e.system && <Badge variant="outline" className="text-[10px] mb-1">{e.system}</Badge>}
                                <p>{e.summary}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* CENTER: Chat area */}
           <Card className="overflow-hidden flex flex-col h-full border-0 rounded-none lg:border lg:rounded-xl">
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => {
                  const TypeIcon = getTypeIcon(msg.type);
                  return (
                    <div
                      key={i}
                      className={`flex gap-2 ${msg.role === "doctor" ? "justify-end" : "justify-start"}`}
                    >
                      {/* Patient avatar */}
                      {msg.role === "simulation" && (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                          {msg.type === "preceptor_hint" ? (
                            <Brain className="h-3.5 w-3.5 text-amber-500" />
                          ) : msg.type === "specialist_opinion" ? (
                            <Users className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${
                          msg.role === "doctor"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : msg.type === "preceptor_hint"
                            ? "bg-amber-500/10 border-2 border-amber-500/30 rounded-bl-md"
                            : msg.type === "specialist_opinion"
                            ? "bg-blue-500/10 border-2 border-blue-500/30 rounded-bl-md"
                            : "bg-muted/50 border border-border/50 rounded-bl-md"
                        }`}
                      >
                        {msg.role === "simulation" && msg.type && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <TypeIcon className="h-3.5 w-3.5 opacity-60" />
                            <span className="text-xs opacity-60 capitalize">
                              {msg.type === "preceptor_hint" ? "Preceptor" : msg.type === "specialist_opinion" ? "Parecer Especialista" : msg.type?.replace("_", " ")}
                            </span>
                            {msg.scoreDelta !== undefined && msg.scoreDelta !== 0 && (
                              <Badge
                                variant={msg.scoreDelta > 0 ? "default" : "destructive"}
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                {msg.scoreDelta > 0 ? `+${msg.scoreDelta}` : msg.scoreDelta}
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className={`leading-relaxed ${msg.role === "simulation" ? "prose prose-sm max-w-none dark:prose-invert" : ""}`}>
                          {msg.role === "simulation" ? (
                            <ReactMarkdown components={{
                              p: ({ children }) => <p>{highlightVitals(children)}</p>,
                              li: ({ children }) => <li>{highlightVitals(children)}</li>,
                            }}>{msg.content}</ReactMarkdown>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        {/* Maneuvers Performed (Physical Exam) */}
                        {msg.maneuversPerformed && msg.maneuversPerformed.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                              <Bone className="h-3 w-3" /> Manobras Realizadas
                            </p>
                            {msg.maneuversPerformed.map((m, mi) => (
                              <div key={mi} className="p-2 rounded-lg bg-accent/10 border border-accent/20 space-y-0.5">
                                <p className="text-[11px] font-bold text-accent-foreground">{m.name}</p>
                                <p className="text-[10px] text-muted-foreground"><strong>Técnica:</strong> {m.technique}</p>
                                <p className="text-[10px] text-muted-foreground"><strong>Achado:</strong> {m.finding}</p>
                                <p className="text-[10px] text-muted-foreground"><strong>Significado:</strong> {m.interpretation}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Teaching Tip (Learner Mode) */}
                        {msg.teachingTip && (
                          <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <p className="text-[11px] text-primary/80">{msg.teachingTip}</p>
                          </div>
                        )}
                      </div>
                      {/* Doctor avatar */}
                      {msg.role === "doctor" && (
                        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && phase === "active" && (
                  <div className="flex gap-2 justify-start">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                {phase === "finishing" && (
                  <div className="flex justify-center py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Avaliando seu desempenho...</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Quick actions */}
              {phase === "active" && (
                <div className="border-t border-border/30 p-2 space-y-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Mobile vitals trigger */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0 gap-1.5 h-8 text-red-500 lg:hidden"
                      onClick={() => setMobileVitalsOpen(true)}
                    >
                      <HeartPulse className="h-3.5 w-3.5" />
                      Vitais
                    </Button>
                    {QUICK_ACTION_CATEGORIES.map((cat) => (
                      <Popover key={cat.label}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`text-xs shrink-0 gap-1.5 h-8 ${cat.color}`}
                            disabled={loading}
                          >
                            <cat.icon className="h-3.5 w-3.5" />
                            {cat.label}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="start">
                          <div className="space-y-0.5">
                            {cat.actions.map((action) => (
                              <button
                                key={action.label}
                                className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted/60 transition-colors"
                                onClick={() => {
                                  sendMessage(action.prompt, `${cat.label}: ${action.label}`);
                                }}
                                disabled={loading}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0 gap-1.5 h-8"
                      disabled={loading}
                      onClick={() => setPrescriptionDialogOpen(true)}
                    >
                      <Pill className="h-3.5 w-3.5" />
                      Prescrever
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0 gap-1.5 h-8"
                      disabled={loading}
                      onClick={() => sendMessage("Com base nos achados clínicos e exames, meu diagnóstico é:", "Diagnóstico")}
                    >
                      <Target className="h-3.5 w-3.5" />
                      Diagnóstico
                    </Button>
                  </div>
                  {/* Pedagogical + finish actions */}
                  <div className="flex gap-1.5 flex-wrap border-t border-border/30 pt-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0 gap-1.5 h-8 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                      disabled={loading}
                      onClick={requestPreceptorHint}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Preceptor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0 gap-1.5 h-8 border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                      disabled={loading}
                      onClick={() => setSpecialistDialogOpen(true)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Parecer
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs shrink-0 gap-1.5 h-8"
                      disabled={loading}
                      onClick={finishSimulation}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Encerrar
                    </Button>
                  </div>
                </div>
              )}

              {/* Input */}
              {phase === "active" && (
                <div className="border-t border-border/50 p-3 flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Conduza o atendimento... (pergunte, examine, peça exames, prescreva)"
                    disabled={loading}
                    className="text-sm"
                  />
                  <Button onClick={() => sendMessage()} disabled={!input.trim() || loading} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

            {/* RIGHT: Exams + Vitals Chart panel */}
            <div className="hidden lg:flex flex-col border-l border-border/30 bg-muted/5 overflow-y-auto">
              <div className="p-3 space-y-4">
                <ExamsPanel exams={examResults} />
                <VitalsChart snapshots={vitalsSnapshots} />
              </div>
            </div>
          </div>

          {/* Mobile: vitals sheet */}
          <Sheet open={mobileVitalsOpen} onOpenChange={setMobileVitalsOpen}>
            <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-red-500" /> Sinais Vitais & Exames
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <VitalsMonitor snapshots={vitalsSnapshots} patientStatus={patientStatus} />
                <ExamsPanel exams={examResults} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Prescription Dialog */}
      <PrescriptionDialog
        open={prescriptionDialogOpen}
        onOpenChange={setPrescriptionDialogOpen}
        onSubmit={(text) => { sendMessage(text, "Prescrição"); }}
        disabled={loading}
      />

      {/* Specialist Dialog */}
      <Dialog open={specialistDialogOpen} onOpenChange={setSpecialistDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Solicitar Parecer de Especialista
            </DialogTitle>
            <DialogDescription>
              Escolha a especialidade para a interconsulta. A IA responderá como o médico especialista.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <select
              value={specialistArea}
              onChange={(e) => setSpecialistArea(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione a especialidade...</option>
              {SPECIALTIES.filter((s) => s !== specialty).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="Dermatologia">Dermatologia</option>
              <option value="Hematologia">Hematologia</option>
              <option value="Endocrinologia">Endocrinologia</option>
              <option value="Reumatologia">Reumatologia</option>
              <option value="Urologia">Urologia</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecialistDialogOpen(false)}>Cancelar</Button>
            <Button onClick={requestSpecialistOpinion} disabled={!specialistArea.trim()} className="gap-1.5">
              <Users className="h-4 w-4" />
              Solicitar Parecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESULT */}
      {phase === "result" && finalEval && (
        <div className="space-y-4">
          {/* Score header */}
          <Card className="overflow-hidden">
            <div className={`p-1 ${finalEval.final_score >= 70 ? "bg-green-500/20" : finalEval.final_score >= 50 ? "bg-amber-500/20" : "bg-destructive/20"}`} />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Plantão Encerrado</h3>
                    <p className="text-sm text-muted-foreground">{specialty} • {difficulty}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {finalEval.student_got_diagnosis ? (
                        <Badge className="bg-green-500/20 text-green-500 text-xs gap-1"><CheckCircle className="h-3 w-3" /> Diagnóstico correto</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Diagnóstico incorreto</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">⏱️ {finalEval.time_total_minutes} min</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-black ${getGradeColor(finalEval.grade)}`}>{finalEval.grade}</p>
                  <p className="text-2xl font-bold">{finalEval.final_score}/100</p>
                  <p className="text-xs text-amber-500 font-semibold">+{finalEval.xp_earned} XP</p>
                </div>
              </div>
              <Progress value={finalEval.final_score} className="h-2" />
            </CardContent>
          </Card>

          {/* Correct diagnosis */}
          <Card className="border-2 border-primary/30">
            <CardContent className="p-5 space-y-3">
              <h4 className="text-base font-bold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Correção Diagnóstica
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase">Diagnóstico Correto</p>
                    <p className="text-sm font-bold">{finalEval.correct_diagnosis}</p>
                  </div>
                </div>
                <div className={`flex items-start gap-2 p-3 rounded-lg ${finalEval.student_got_diagnosis ? "bg-green-500/10 border border-green-500/20" : "bg-destructive/10 border border-destructive/20"}`}>
                  {finalEval.student_got_diagnosis ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className={`text-xs font-semibold uppercase ${finalEval.student_got_diagnosis ? "text-green-500" : "text-destructive"}`}>
                      Seu Diagnóstico
                    </p>
                    <p className="text-sm font-medium">
                      {finalEval.student_got_diagnosis
                        ? "✅ Você acertou o diagnóstico!"
                        : "❌ Você não chegou ao diagnóstico correto. Revise a abordagem ideal abaixo."}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Differential Diagnosis */}
          {finalEval.differential_diagnosis && finalEval.differential_diagnosis.length > 0 && (
            <Card className="border border-purple-500/30">
              <CardContent className="p-5 space-y-4">
                <h4 className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-purple-500" /> Diagnósticos Diferenciais
                </h4>
                <p className="text-xs text-muted-foreground">
                  Diagnósticos que deveriam ser considerados neste caso. Verde = você considerou, cinza = não considerado.
                </p>
                <div className="space-y-3">
                  {finalEval.differential_diagnosis.map((dd, i) => (
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
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-bold">{dd.diagnosis}</span>
                        <Badge
                          variant={dd.student_considered ? "default" : "outline"}
                          className={`text-[10px] ml-auto ${dd.student_considered ? "bg-green-500/20 text-green-600" : ""}`}
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

          {/* Category scores */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h4 className="text-sm font-semibold">📊 Avaliação por Categoria</h4>
              {Object.entries(finalEval.evaluation).map(([key, val]) => {
                const maxScore = EVAL_MAX_SCORES[key] || 25;
                const goodThreshold = maxScore * 0.7;
                const midThreshold = maxScore * 0.5;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{EVAL_LABELS[key] || key}</span>
                      <span className={`font-bold ${val.score >= goodThreshold ? "text-green-500" : val.score >= midThreshold ? "text-amber-500" : "text-destructive"}`}>
                        {val.score}/{maxScore}
                      </span>
                    </div>
                    <Progress value={(val.score / maxScore) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{val.feedback}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Ideal Prescription */}
          {finalEval.ideal_prescription && (
            <Card className="border border-blue-500/30">
              <CardContent className="p-5 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Syringe className="h-4 w-4 text-blue-500" /> Prescrição Modelo
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground bg-blue-500/5 rounded-lg p-4 border border-blue-500/20 whitespace-pre-wrap font-mono">
                  {finalEval.ideal_prescription}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Pontos Fortes
                </h4>
                <ul className="space-y-1">
                  {finalEval.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Star className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Pontos a Melhorar
                </h4>
                <ul className="space-y-1">
                  {finalEval.improvements.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Physical Exam Expected */}
          {finalEval.physical_exam_expected && (
            <Card className="border border-teal-500/30">
              <CardContent className="p-5 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Stethoscope className="h-4 w-4 text-teal-500" /> 🩺 Exame Físico Esperado
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {finalEval.physical_exam_expected.inspection?.length > 0 && (
                    <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                      <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Eye className="h-3 w-3 text-teal-500" /> Inspeção</p>
                      <ul className="space-y-1">
                        {finalEval.physical_exam_expected.inspection.map((item: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {finalEval.physical_exam_expected.palpation?.length > 0 && (
                    <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                      <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Hand className="h-3 w-3 text-teal-500" /> Palpação</p>
                      <ul className="space-y-1">
                        {finalEval.physical_exam_expected.palpation.map((item: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {finalEval.physical_exam_expected.auscultation?.length > 0 && (
                    <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                      <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Ear className="h-3 w-3 text-teal-500" /> Ausculta</p>
                      <ul className="space-y-1">
                        {finalEval.physical_exam_expected.auscultation.map((item: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {finalEval.physical_exam_expected.maneuvers?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><Bone className="h-3 w-3 text-teal-500" /> Manobras Diagnósticas</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {finalEval.physical_exam_expected.maneuvers.map((m: any, i: number) => (
                        <div key={i} className="bg-muted/30 rounded-lg p-3 border border-border/50 space-y-1">
                          <p className="text-xs font-bold text-teal-600">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Técnica:</span> {m.technique}</p>
                          <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Achado +:</span> {m.positive_finding}</p>
                          <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Indica:</span> {m.indicates}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {finalEval.physical_exam_expected.vital_signs_expected && (
                  <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1"><HeartPulse className="h-3 w-3 text-teal-500" /> Sinais Vitais Esperados</p>
                    <p className="text-xs text-muted-foreground">{finalEval.physical_exam_expected.vital_signs_expected}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ideal approach */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" /> Abordagem Ideal
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground bg-primary/5 rounded-lg p-4 border border-primary/20">
                {finalEval.ideal_approach}
              </p>
            </CardContent>
          </Card>

          {/* Tutor IA Link */}
          {finalEval.correct_diagnosis && (
            <Button
              onClick={() => {
                const missed = finalEval.differential_diagnosis
                  ?.filter(d => !d.student_considered)
                  .map(d => d.diagnosis)
                  .join(", ") || "N/A";
                navigate("/dashboard/chatgpt", {
                  state: {
                    initialMessage: `🔬 MODO REVISÃO CLÍNICA\n\nO aluno teve dificuldade no seguinte caso clínico:\n- Especialidade: ${specialty}\n- Diagnóstico correto: ${finalEval.correct_diagnosis}\n- Diferenciais não considerados: ${missed}\n- Pontos fracos: ${finalEval.improvements?.join(", ") || "N/A"}\n\nExplique detalhadamente o raciocínio clínico, os diagnósticos diferenciais e como chegar ao diagnóstico correto.`,
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

          {/* Actions */}
          <TaskCompletionCard
            title="Simulação clínica concluída!"
            secondaryLabel="Novo Plantão"
            onSecondary={reset}
            tertiaryLabel="Refazer Mesmo"
            onTertiary={retryWithSameConfig}
          />
          <div className="flex gap-2 justify-center">
            <Button onClick={exportCasePdf} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
            <Button onClick={shareResult} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ClipboardCheck className="h-4 w-4" /> Compartilhar
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(content, document.body);
  }

  return content;
};

export default ClinicalSimulation;
