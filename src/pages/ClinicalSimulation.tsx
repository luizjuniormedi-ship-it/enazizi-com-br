import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useStudyContext } from "@/lib/studyContext";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTracking, SessionOrigin } from "@/hooks/useSessionTracking";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import {
  Activity, Loader2, Send, Users, ClipboardCheck, Maximize2, Minimize2,
} from "lucide-react";
import { parseVitalsToSnapshot } from "@/components/plantao/VitalsChart";
import VitalsChart from "@/components/plantao/VitalsChart";
import VitalsMonitor from "@/components/plantao/VitalsMonitor";
import ShiftHeader from "@/components/plantao/ShiftHeader";
import ExamsPanel from "@/components/plantao/ExamsPanel";
import PrescriptionDialog from "@/components/plantao/PrescriptionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { HeartPulse } from "lucide-react";
import { ALL_SPECIALTIES as SPECIALTIES } from "@/constants/specialties";
import LobbyPanel from "@/components/clinical-simulation/LobbyPanel";
import HistoryDetailDialog from "@/components/clinical-simulation/HistoryDetailDialog";
import ResultPanel, { type FinalEval } from "@/components/clinical-simulation/ResultPanel";
import SidePanel, { ABCDE_STEPS, type CategoryScores } from "@/components/clinical-simulation/SidePanel";
import QuickActionsBar from "@/components/clinical-simulation/QuickActionsBar";
import MessageList from "@/components/clinical-simulation/MessageList";
import type { ChatMessage, ManeuverPerformed } from "@/components/clinical-simulation/MessageBubble";
import { exportToPdf } from "@/lib/exportPdf";
import { useClinicalSimulation as useClinicalSimulationModule } from "@/modules/clinical-simulation/hooks/useClinicalSimulation";
import { usePhaseMachine } from "@/modules/clinical-simulation/state/usePhaseMachine";

const EVAL_LABELS: Record<string, string> = {
  anamnesis: "Anamnese", physical_exam: "Exame Físico", complementary_exams: "Exames Complementares",
  diagnosis: "Diagnóstico", prescription: "Prescrição", management: "Conduta", referral: "Parecer/Encaminhamento",
};
const EVAL_MAX_SCORES: Record<string, number> = {
  anamnesis: 15, physical_exam: 15, complementary_exams: 15, diagnosis: 15, prescription: 15, management: 15, referral: 10,
};

const DIFFICULTY_TIMER: Record<string, number> = {
  "básico": 30 * 60, "intermediário": 20 * 60, "avançado": 15 * 60,
};

type Phase = "lobby" | "active" | "finishing" | "result";

interface Vitals { PA: string; FC: string; FR: string; Temp: string; SpO2: string }

interface MedicalRecordEntry {
  category: "anamnesis" | "physical_exam" | "lab" | "imaging" | "prescription" | "other";
  summary: string;
  system?: string;
  timestamp: number;
}

interface ActionTimelineEntry { label: string; icon: string; timestamp: number }

// Reusable AudioContext — browsers cap ~6 concurrent contexts; previous code
// created a new one per beep, eventually throwing and silently breaking audio.
let _sharedAudioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  try {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
      _sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_sharedAudioCtx.state === "suspended") _sharedAudioCtx.resume().catch(() => {});
    return _sharedAudioCtx;
  } catch { return null; }
};
const playSound = (type: "response" | "worsened" | "positive" | "negative") => {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.value = 0.15;
    switch (type) {
      case "response": osc.frequency.value = 520; osc.start(); osc.stop(ctx.currentTime + 0.08); break;
      case "worsened": osc.frequency.value = 220; osc.type = "sawtooth"; osc.start(); osc.stop(ctx.currentTime + 0.3); break;
      case "positive": osc.frequency.value = 660; osc.start(); osc.stop(ctx.currentTime + 0.12); break;
      case "negative": osc.frequency.value = 330; osc.type = "square"; osc.start(); osc.stop(ctx.currentTime + 0.15); break;
    }
  } catch {}
};


const getTriageEmoji = (color: string) => {
  const map: Record<string, string> = { vermelho: "🔴 Vermelho (Emergência)", laranja: "🟠 Laranja (Muito Urgente)", amarelo: "🟡 Amarelo (Urgente)", verde: "🟢 Verde (Pouco Urgente)" };
  return map[color] || color;
};

const ClinicalSimulation = () => {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshUserState();
  const [searchParams] = useSearchParams();
  const studyCtx = useStudyContext();
  const teacherCaseId = searchParams.get("teacher_case_id");
  const paramOrigin = (searchParams.get("origin") as SessionOrigin) || "manual";
  const { startSession: startTrackedSession, completeSession: completeTrackedSession } = useSessionTracking();
  // Wave 1.0 — módulo clinical-simulation (audioRuntime + clinicalTelemetry).
  // Coexiste com a lógica legada; será expandido nas sub-waves 1.1–1.6.
  const cs = useClinicalSimulationModule({ specialty: studyCtx?.specialty, difficulty: "intermediário", teacherCaseId });

  // ─── SETUP STATE (lobby only) ───
  const [specialty, setSpecialty] = useState(studyCtx?.specialty || "Clínica Médica");
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [subtopic, setSubtopic] = useState(studyCtx?.subtopic || "");
  const [difficulty, setDifficulty] = useState("intermediário");
  const [pediatricAge, setPediatricAge] = useState("aleatorio");
  const [realisticMode, setRealisticMode] = useState(false);
  const [learnerMode, setLearnerMode] = useState(false);

  // ─── ORCHESTRATION STATE ───
  const [phase, setPhase] = useState<Phase>("lobby");
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ─── EXECUTION STATE (active session) ───
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
  const [actionTimeline, setActionTimeline] = useState<ActionTimelineEntry[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [examResults, setExamResults] = useState<Array<{ type: "lab" | "imaging"; content: string; timestamp: number }>>([]);
  const [vitalsSnapshots, setVitalsSnapshots] = useState<any[]>([]);
  const [statusAlert, setStatusAlert] = useState(false);
  const [abcdeChecklist, setAbcdeChecklist] = useState<Record<string, boolean>>({ A: false, B: false, C: false, D: false, E: false });
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecordEntry[]>([]);
  const [categoryScores, setCategoryScores] = useState<CategoryScores>({ anamnesis: 0, physical_exam: 0, complementary_exams: 0, management: 0 });

  // ─── TIMER / DETERIORATION ───
  const [countdown, setCountdown] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deteriorationCount, setDeteriorationCount] = useState(0);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const lastActionTimeRef = useRef<number>(Date.now());
  const deteriorationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── UI / DIALOGS STATE ───
  const [specialistDialogOpen, setSpecialistDialogOpen] = useState(false);
  const [specialistArea, setSpecialistArea] = useState("");
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [mobileVitalsOpen, setMobileVitalsOpen] = useState(false);
  const [medRecordOpen, setMedRecordOpen] = useState(false);

  // ─── RESULT STATE ───
  const [finalEval, setFinalEval] = useState<FinalEval | null>(null);

  // ─── HISTORY STATE ───
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const isPediatrics = specialty === "Pediatria";

  const { pendingSession, checked, completeSession: completePersistedSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "clinical-simulation" });

  const getClinicalState = useCallback(() => {
    if (phase !== "active") return {};
    return { phase, specialty, difficulty, realisticMode, learnerMode, messages: messages.map(m => ({ ...m })), vitals, setting, triageColor, patientStatus, score, timeElapsed, conversationHistory, actionTimeline, examResults, vitalsSnapshots, countdown, abcdeChecklist, medicalRecord, categoryScores };
  }, [phase, specialty, difficulty, realisticMode, learnerMode, messages, vitals, setting, triageColor, patientStatus, score, timeElapsed, conversationHistory, actionTimeline, examResults, vitalsSnapshots, countdown, abcdeChecklist, medicalRecord, categoryScores]);

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

  // Telemetry: module opened (Fase A baseline)
  useEffect(() => {
    telemetry.track('plantao_opened', { teacher_case_id: teacherCaseId || null });
  }, []);

  const restoreClinicalSession = useCallback((data: Record<string, any>) => {
    if (data.specialty) setSpecialty(data.specialty);
    if (data.difficulty) setDifficulty(data.difficulty);
    if (data.realisticMode !== undefined) setRealisticMode(data.realisticMode);
    if (data.learnerMode !== undefined) setLearnerMode(data.learnerMode);
    if (data.messages) setMessages(data.messages);
    if (data.vitals) setVitals(data.vitals);
    if (data.setting) setSetting(data.setting);
    if (data.triageColor) setTriageColor(data.triageColor);
    if (data.patientStatus) { setPatientStatus(data.patientStatus); setPrevPatientStatus(data.patientStatus); }
    if (typeof data.score === "number") { setScore(data.score); setPrevScore(data.score); }
    if (typeof data.timeElapsed === "number") setTimeElapsed(data.timeElapsed);
    if (data.conversationHistory) setConversationHistory(data.conversationHistory);
    if (data.actionTimeline) setActionTimeline(data.actionTimeline);
    if (data.examResults) setExamResults(data.examResults);
    if (data.vitalsSnapshots) setVitalsSnapshots(data.vitalsSnapshots);
    if (typeof data.countdown === "number") setCountdown(data.countdown);
    if (data.abcdeChecklist) setAbcdeChecklist(data.abcdeChecklist);
    if (data.medicalRecord) setMedicalRecord(data.medicalRecord);
    if (data.categoryScores) setCategoryScores(data.categoryScores);
    setPhase("active");
    clearPending();
  }, [clearPending]);


  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clinical-simulation`;

  // Score flash
  useEffect(() => {
    if (scoreFlash) {
      const t = setTimeout(() => setScoreFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [scoreFlash]);

  // Status alert
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

  // Countdown timer
  useEffect(() => {
    if (phase === "active" && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setTimerExpired(true);
            toast({ title: "⏰ Tempo esgotado!", description: "O tempo do plantão acabou! Encerre o atendimento agora.", variant: "destructive" });
            try {
              cs.sound("timeout");
              cs.track("plantao_time_expired", { phase: "active" });
            } catch {}
            return 0;
          }
          if (prev === 121) toast({ title: "⚠️ 2 minutos restantes!", description: "Finalize seu atendimento rapidamente." });
          if (prev === 301) toast({ title: "⏱️ 5 minutos restantes", description: "Considere fechar seu diagnóstico e prescrição." });
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

  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro");
    return data;
  }, [session, API_URL]);

  const addToTimeline = useCallback((label: string, icon: string) => {
    setActionTimeline((prev) => [...prev, { label, icon, timestamp: Date.now() }]);
  }, []);

  const saveSimulationToHistory = async (evalData: FinalEval) => {
    if (!user) return;
    try {
      await supabase.from("simulation_history").insert({
        user_id: user.id, specialty, difficulty,
        final_score: evalData.final_score, grade: evalData.grade,
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
      await completeTrackedSession("simulation", {
        finalScore: evalData.final_score,
        sessionData: { grade: evalData.grade, correct_diagnosis: evalData.correct_diagnosis },
      });
    } catch (e) {
      console.error("Error saving simulation:", e);
    }
  };

  const triggerDeterioration = useCallback(async (level: number) => {
    if (loading || phase !== "active") return;
    setLoading(true); setIsTyping(true); setInactivityWarning(false);

    setMessages((prev) => [...prev, { role: "doctor", content: `⚠️ [Sistema] Paciente aguardou sem conduta — deterioração automática (nível ${level})`, timestamp: Date.now() }]);
    try {
      const updatedHistory = [...conversationHistory, { role: "user", content: `[SISTEMA: O aluno ficou inativo por 90 segundos. Nível de deterioração: ${level}/3. Piore o paciente proporcionalmente.]` }];
      const res = await callAPI({ action: "deteriorate", deterioration_level: level, conversation_history: updatedHistory, triage_color: triageColor, patient_status: patientStatus });
      setIsTyping(false);
      playSound("worsened");
      setMessages((prev) => [...prev, { role: "simulation", content: res.response, type: "deterioration", scoreDelta: res.score_delta, timestamp: Date.now() }]);
      addToTimeline(`⚠️ Paciente piorou (inatividade nível ${level})`, "🔻");
      const newScore = Math.max(0, Math.min(100, score + (res.score_delta || -3)));
      setScoreFlash("red"); setPrevScore(score); setScore(newScore);
      if (res.vitals) {
        setVitals(res.vitals);
        const newTime = res.time_elapsed_minutes || timeElapsed + 2;
        setTimeElapsed(newTime);
        setVitalsSnapshots((prev) => [...prev, parseVitalsToSnapshot(res.vitals, newTime)]);
      }
      if (res.patient_status) setPatientStatus(res.patient_status);
      setConversationHistory([...updatedHistory, { role: "assistant", content: JSON.stringify(res) }]);
      if (level >= 3) {
        toast({ title: "💀 Paciente em parada cardíaca!", description: "O paciente evoluiu para parada por falta de conduta. O caso será encerrado.", variant: "destructive" });
        setTimeout(() => finishSimulation(), 2000);
      }
    } catch (e) {
      setIsTyping(false);
      console.error("Deterioration error:", e);
    } finally {
      setLoading(false);
    }
  }, [loading, phase, conversationHistory, callAPI, score, timeElapsed, vitals, triageColor, patientStatus, addToTimeline, toast]);

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
      if (elapsed >= 60 && elapsed < 90) setInactivityWarning(true);
      else if (elapsed < 60) setInactivityWarning(false);
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
          const specLower = (specialty || "").toLowerCase();
          const relevantErrors = errorsRes.data.filter((e: any) => {
            const tema = (e.tema || "").toLowerCase();
            return tema.includes(specLower) || specLower.includes(tema) || true;
          });
          if (relevantErrors.length > 0) {
            const errorTypes = [...new Set(relevantErrors.map((e: any) => e.categoria_erro).filter(Boolean))] as string[];
            const themes = [...new Set(relevantErrors.slice(0, 5).map((e: any) => e.tema).filter(Boolean))] as string[];
            recentErrors = { has_errors: true, error_types: errorTypes, themes };
          }
        }
      }

      const res = await callAPI({
        action: "start", specialty,
        subtopic: subtopic.trim() || undefined,
        difficulty, learner_mode: learnerMode,
        ...(teacherCaseId ? { teacher_case_id: teacherCaseId } : {}),
        ...(isPediatrics && pediatricAge !== "aleatorio" ? { pediatric_age_range: pediatricAge } : {}),
        ...(targetExams.length > 0 ? { target_exams: targetExams } : {}),
        ...(recentErrors.has_errors ? { recent_errors: recentErrors } : {}),
        ...(examProximityDays !== null ? { exam_proximity_days: examProximityDays } : {}),
      });

      setVitals(res.vitals);
      setSetting(res.setting || "Pronto-Socorro");
      setTriageColor(res.triage_color || "amarelo");
      setPatientStatus("estável"); setPrevPatientStatus("estável");
      setScore(50); setPrevScore(50); setTimeElapsed(0);
      setTimerExpired(false);
      setCountdown(DIFFICULTY_TIMER[difficulty] || 20 * 60);
      setExamResults([]); setActionTimeline([]); setStatusAlert(false);
      if (res.vitals) setVitalsSnapshots([parseVitalsToSnapshot(res.vitals, 0)]);

      const simMsg: ChatMessage = {
        role: "simulation",
        content: `📍 **${res.setting || "Pronto-Socorro"}** | Triagem: ${getTriageEmoji(res.triage_color)}\n\n${res.patient_presentation}`,
        type: "presentation", timestamp: Date.now(),
      };
      setMessages([simMsg]);
      setConversationHistory([{ role: "assistant", content: JSON.stringify(res) }]);
      setPhase("active");
      addToTimeline("Caso iniciado", "🏥");

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

  useEffect(() => {
    if (teacherCaseId && phase === "lobby" && !loading) {
      startSimulation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherCaseId]);

  const sendMessage = useCallback(async (text?: string, timelineLabel?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    lastActionTimeRef.current = Date.now();
    setInactivityWarning(false);

    setMessages((prev) => [...prev, { role: "doctor", content: msg, timestamp: Date.now() }]);
    setLoading(true); setIsTyping(true);
    if (timelineLabel) addToTimeline(timelineLabel, "📋");

    try {
      const updatedHistory = [...conversationHistory, { role: "user", content: msg }];
      const res = await callAPI({ action: "interact", message: msg, conversation_history: updatedHistory, learner_mode: learnerMode });
      detectABCDE(msg);
      setIsTyping(false);
      playSound("response");

      const simMsg: ChatMessage = {
        role: "simulation", content: res.response, type: res.response_type,
        scoreDelta: res.score_delta, timestamp: Date.now(),
        teachingTip: res.teaching_tip || undefined,
        maneuversPerformed: res.maneuvers_performed || undefined,
      };
      setMessages((prev) => [...prev, simMsg]);

      if (res.score_delta && res.score_delta !== 0) {
        setScoreFlash(res.score_delta > 0 ? "green" : "red");
        playSound(res.score_delta > 0 ? "positive" : "negative");
      }
      // Functional updater avoids race when multiple replies arrive close together
      setScore((prev) => {
        setPrevScore(prev);
        return Math.max(0, Math.min(100, prev + (res.score_delta || 0)));
      });


      const newTimeElapsed = res.time_elapsed_minutes || timeElapsed + 5;
      setTimeElapsed(newTimeElapsed);
      if (res.patient_status) setPatientStatus(res.patient_status);

      const rt = (res.response_type || "").toLowerCase();
      const responseText = (res.response || "").toLowerCase();
      const isLabResult = rt === "lab_result" || rt === "lab_results" || rt === "lab" ||
        (responseText.includes("g/dl") || responseText.includes("mg/dl") || responseText.includes("mm³") ||
         responseText.includes("ref:") || responseText.includes("referência") || responseText.includes("hemograma") && responseText.includes("leucócitos"));
      const isImagingResult = rt === "imaging" || rt === "imaging_result" || rt === "image" ||
        (responseText.includes("laudo") && (responseText.includes("tomografia") || responseText.includes("radiografia") || responseText.includes("ultrassonografia") || responseText.includes("ressonância")));

      if (isLabResult && res.response) setExamResults((prev) => [...prev, { type: "lab", content: res.response, timestamp: Date.now() }]);
      if (isImagingResult && res.response) setExamResults((prev) => [...prev, { type: "imaging", content: res.response, timestamp: Date.now() }]);

      if (res.vitals) {
        setVitals(res.vitals);
        setVitalsSnapshots((prev) => [...prev, parseVitalsToSnapshot(res.vitals, newTimeElapsed)]);
      } else if (vitals && res.patient_status && res.patient_status !== patientStatus) {
        setVitalsSnapshots((prev) => [...prev, parseVitalsToSnapshot(vitals as any, newTimeElapsed)]);
      }

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

      if (res.critical_action_needed) {
        toast({ title: "🚨 ALERTA CRÍTICO", description: res.critical_action_needed, variant: "destructive" });
        playSound("worsened");
      }

      if (res.category_scores) setCategoryScores(res.category_scores);

      if (res.structured_data?.summary) {
        const sd = res.structured_data;
        const categoryMap: Record<string, MedicalRecordEntry["category"]> = {
          anamnesis: "anamnesis", physical_exam: "physical_exam", lab: "lab",
          imaging: "imaging", prescription: "prescription",
        };
        setMedicalRecord(prev => [...prev, {
          category: categoryMap[sd.type] || "other",
          summary: sd.summary, system: sd.system || undefined, timestamp: Date.now(),
        }]);
      }

      setConversationHistory([...updatedHistory, { role: "assistant", content: JSON.stringify(res) }]);
    } catch (e) {
      setIsTyping(false);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, conversationHistory, callAPI, learnerMode, detectABCDE, score, timeElapsed, vitals, patientStatus, addToTimeline, toast]);

  const requestPreceptorHint = useCallback(async () => {
    if (loading) return;
    setLoading(true); setIsTyping(true);
    addToTimeline("Ajuda preceptor", "🆘");
    setMessages((prev) => [...prev, { role: "doctor", content: "🆘 Solicitando ajuda do preceptor...", timestamp: Date.now() }]);
    try {
      const res = await callAPI({ action: "hint", conversation_history: conversationHistory });
      setIsTyping(false);
      let content = res.response || "";
      if (res.clinical_reasoning_tips?.length) content += "\n\n💡 **Dicas de raciocínio clínico:**\n" + res.clinical_reasoning_tips.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n");
      if (res.suggested_next_steps?.length) content += "\n\n➡️ **Próximos passos sugeridos:**\n" + res.suggested_next_steps.map((s: string) => `• ${s}`).join("\n");
      setMessages((prev) => [...prev, { role: "simulation", content, type: "preceptor_hint", scoreDelta: res.score_delta || 0, timestamp: Date.now() }]);
      setConversationHistory([...conversationHistory, { role: "user", content: "Solicito ajuda do preceptor" }, { role: "assistant", content: JSON.stringify(res) }]);
    } catch (e) {
      setIsTyping(false);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [loading, conversationHistory, callAPI, addToTimeline, toast]);

  const requestSpecialistOpinion = async () => {
    if (loading || !specialistArea.trim()) return;
    setSpecialistDialogOpen(false);
    setLoading(true); setIsTyping(true);
    addToTimeline(`Parecer: ${specialistArea}`, "📋");
    setMessages((prev) => [...prev, { role: "doctor", content: `📋 Solicitando parecer de ${specialistArea}...`, timestamp: Date.now() }]);
    try {
      const res = await callAPI({ action: "specialist", specialist_area: specialistArea, conversation_history: conversationHistory });
      setIsTyping(false);
      let content = `**Parecer - ${res.specialist || specialistArea}**\n\n${res.response || ""}`;
      if (res.recommendations?.length) content += "\n\n📌 **Recomendações:**\n" + res.recommendations.map((r: string) => `• ${r}`).join("\n");
      if (res.relevance) {
        const relevanceMap: Record<string, string> = {
          alta: "✅ Parecer altamente relevante",
          média: "⚠️ Parecer de relevância moderada",
          baixa: "❌ Especialidade pouco relevante para este caso",
        };
        content += `\n\n${relevanceMap[res.relevance] || ""}`;
      }
      setMessages((prev) => [...prev, { role: "simulation", content, type: "specialist_opinion", scoreDelta: res.score_delta || 0, timestamp: Date.now() }]);
      setScore((prev) => Math.max(0, Math.min(100, prev + (res.score_delta || 0))));
      setConversationHistory([...conversationHistory, { role: "user", content: `Solicito parecer de ${specialistArea}` }, { role: "assistant", content: JSON.stringify(res) }]);
      setSpecialistArea("");
    } catch (e) {
      setIsTyping(false);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const finishSimulation = useCallback(async () => {
    setLoading(true); setPhase("finishing");
    try {
      const res = await callAPI({ action: "finish", conversation_history: conversationHistory, ...(teacherCaseId ? { teacher_case_id: teacherCaseId } : {}) });
      setFinalEval(res);
      setPhase("result");
      await completePersistedSession();
      await addXp(XP_REWARDS.plantao_completed);
      telemetry.track('plantao_completed', { specialty: specialty || null, difficulty, final_score: res?.final_score ?? null });
      if (user?.id) {
        await completeStudyAction({
          userId: user.id, taskType: "clinical",
          topic: specialty || "Simulação Clínica",
          source: "auto", originModule: "clinical-simulation",
        });
      }
      refresh("session");
      await saveSimulationToHistory(res);
      if (user && res.final_score < 70) {
        const weakAreas = res.weak_areas || res.areas_to_improve || [];
        await logErrorToBank({
          userId: user.id, tema: specialty, tipoQuestao: "simulado",
          conteudo: `Modo Plantão - ${specialty} (${difficulty})`,
          motivoErro: weakAreas.length > 0 ? `Áreas fracas: ${Array.isArray(weakAreas) ? weakAreas.join("; ") : weakAreas}` : `Nota ${res.final_score}/100 - Conceito ${res.grade}`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callAPI, conversationHistory, teacherCaseId, completePersistedSession, addXp, user, specialty, difficulty, refresh, toast]);

  const reset = useCallback(() => {
    setPhase("lobby");
    setMessages([]); setConversationHistory([]);
    setScore(50); setPrevScore(50); setTimeElapsed(0);
    setFinalEval(null); setVitals(null); setCountdown(0);
    setTimerExpired(false); setVitalsSnapshots([]); setExamResults([]);
    setActionTimeline([]); setStatusAlert(false); setDeteriorationCount(0);
    setInactivityWarning(false);
    setAbcdeChecklist({ A: false, B: false, C: false, D: false, E: false });
    setMedicalRecord([]);
    setCategoryScores({ anamnesis: 0, physical_exam: 0, complementary_exams: 0, management: 0 });
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (deteriorationIntervalRef.current) clearInterval(deteriorationIntervalRef.current);
    fetchHistory();
  }, [fetchHistory]);

  const exportCasePdf = useCallback(() => {
    if (!finalEval) return;
    const items = [
      { title: "Diagnóstico Correto", content: finalEval.correct_diagnosis, subtitle: finalEval.student_got_diagnosis ? "✅ Você acertou" : "❌ Você não acertou" },
      ...Object.entries(finalEval.evaluation).map(([key, val]) => ({
        title: EVAL_LABELS[key] || key, content: val.feedback,
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
  }, [finalEval, specialty, toast]);

  const shareResult = useCallback(() => {
    if (!finalEval) return;
    const text = `🏥 Plantão Clínico - ${specialty}\n📊 Nota: ${finalEval.final_score}/100 (${finalEval.grade})\n🎯 Diagnóstico: ${finalEval.correct_diagnosis}\n${finalEval.student_got_diagnosis ? "✅ Acertei!" : "❌ Errei"}\n⏱️ ${finalEval.time_total_minutes} min\n✨ +${finalEval.xp_earned} XP`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Resultado copiado para a área de transferência." });
  }, [finalEval, specialty, toast]);

  const retryWithSameConfig = useCallback(() => {
    // Reuse the same full-reset to avoid state leaks (abcde, medicalRecord, categoryScores, etc.)
    reset();
    setTimeout(() => startSimulation(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);


  const openTutorReview = useCallback(() => {
    if (!finalEval) return;
    const missed = finalEval.differential_diagnosis?.filter(d => !d.student_considered).map(d => d.diagnosis).join(", ") || "N/A";
    navigate("/dashboard/mentor", {
      state: {
        initialMessage: `🔬 MODO REVISÃO CLÍNICA\n\nO aluno teve dificuldade no seguinte caso clínico:\n- Especialidade: ${specialty}\n- Diagnóstico correto: ${finalEval.correct_diagnosis}\n- Diferenciais não considerados: ${missed}\n- Pontos fracos: ${finalEval.improvements?.join(", ") || "N/A"}\n\nExplique detalhadamente o raciocínio clínico, os diagnósticos diferenciais e como chegar ao diagnóstico correto.`,
      },
    });
  }, [finalEval, navigate, specialty]);

  // Stable callbacks for QuickActions
  const handleSendAction = useCallback((prompt: string, label: string) => sendMessage(prompt, label), [sendMessage]);
  const handleSendDiagnosis = useCallback(() => sendMessage("Com base nos achados clínicos e exames, meu diagnóstico é:", "Diagnóstico"), [sendMessage]);
  const handleOpenMobileVitals = useCallback(() => setMobileVitalsOpen(true), []);
  const handleOpenPrescription = useCallback(() => setPrescriptionDialogOpen(true), []);
  const handleOpenSpecialist = useCallback(() => setSpecialistDialogOpen(true), []);
  const handlePrescriptionSubmit = useCallback((text: string) => sendMessage(text, "Prescrição"), [sendMessage]);

  // Memoized derived values for stable Active region
  const recentTimeline = useMemo(() => actionTimeline.slice(-8), [actionTimeline]);

  const initialCountdown = DIFFICULTY_TIMER[difficulty] || 20 * 60;
  const isActiveLike = phase === "active" || phase === "finishing";

  const content = (
    <div className={`animate-fade-in ${isFullscreen ? "fixed inset-0 z-[100] bg-background overflow-auto flex flex-col" : "max-w-6xl mx-auto space-y-4"}`}>
      {/* Outer header — hidden while a case is running to avoid duplicating ShiftHeader */}
      {!isActiveLike && (
        <div className={`flex items-center justify-between ${isFullscreen ? "px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm shrink-0" : "mb-4 lg:pr-[320px]"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-5 w-5 text-destructive shrink-0" />
            <h1 className="text-lg font-bold truncate">Modo Plantão</h1>
            {!isFullscreen && (
              <p className="text-xs text-muted-foreground hidden md:block">Simulação interativa de atendimento clínico</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className={isFullscreen ? "flex-1 overflow-auto p-2 sm:p-4" : ""}>


      {/* LOBBY */}
      {phase === "lobby" && (
        <LobbyPanel
          specialty={specialty}
          cycleFilter={cycleFilter}
          subtopic={subtopic}
          difficulty={difficulty}
          pediatricAge={pediatricAge}
          realisticMode={realisticMode}
          learnerMode={learnerMode}
          loading={loading}
          onSpecialtyChange={setSpecialty}
          onCycleChange={setCycleFilter}
          onSubtopicChange={setSubtopic}
          onDifficultyChange={setDifficulty}
          onPediatricAgeChange={setPediatricAge}
          onRealisticChange={setRealisticMode}
          onLearnerChange={setLearnerMode}
          onStart={startSimulation}
          pendingSession={pendingSession as any}
          resumeChecked={checked}
          onResume={restoreClinicalSession}
          onAbandon={abandonSession}
          history={history}
          historyLoading={historyLoading}
          onRefreshHistory={fetchHistory}
          onSelectHistory={setSelectedHistory}
          onDeleteHistory={deleteHistoryItem}
        />
      )}

      <HistoryDetailDialog selected={selectedHistory} onClose={() => setSelectedHistory(null)} />

      {/* ACTIVE SIMULATION */}
      {(phase === "active" || phase === "finishing") && (
        <div className="flex flex-col" style={{ height: isFullscreen ? "calc(100vh - 8px)" : "calc(100vh - 80px)" }}>
          <div className="shrink-0 flex items-stretch">
            <div className="flex-1 min-w-0">
              <ShiftHeader
                patientStatus={patientStatus}
                statusAlert={statusAlert}
                countdown={countdown}
                initialCountdown={initialCountdown}
                timerExpired={timerExpired}
                score={score}
                scoreFlash={scoreFlash}
                triageColor={triageColor}
                setting={setting}
                inactivityWarning={inactivityWarning}
                abcdeChecklist={abcdeChecklist}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              className="px-2 border-b border-border/50 bg-background/95 backdrop-blur-sm hover:bg-muted/40 text-muted-foreground"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>


          {recentTimeline.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-1.5 px-3 border-b border-border/30 bg-muted/5 shrink-0">
              {recentTimeline.map((entry, i) => (
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

          {/* 3-column layout */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-0 min-h-0 overflow-hidden shrink">
            {/* SidePanel: hidden on mobile (vitals available via QuickActions → Sheet) to keep chat the primary surface */}
            <div className="hidden lg:block min-h-0">
              <SidePanel
                vitalsSnapshots={vitalsSnapshots}
                patientStatus={patientStatus}
                statusAlert={statusAlert}
                abcdeChecklist={abcdeChecklist}
                categoryScores={categoryScores}
                medicalRecord={medicalRecord}
                medRecordOpen={medRecordOpen}
                onMedRecordOpenChange={setMedRecordOpen}
              />
            </div>

            {/* CENTER: Chat */}
            <Card className="overflow-hidden flex flex-col min-h-0 border-0 rounded-none lg:border lg:rounded-xl">

              <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
                <MessageList messages={messages} isTyping={isTyping && phase === "active"} isFinishing={phase === "finishing"} />

                {phase === "active" && (
                  <QuickActionsBar
                    loading={loading}
                    onSendAction={handleSendAction}
                    onOpenMobileVitals={handleOpenMobileVitals}
                    onOpenPrescription={handleOpenPrescription}
                    onSendDiagnosis={handleSendDiagnosis}
                    onPreceptor={requestPreceptorHint}
                    onSpecialist={handleOpenSpecialist}
                    onFinish={finishSimulation}
                  />
                )}

                {phase === "active" && (
                  <div className="border-t border-border/50 p-3 flex gap-2 shrink-0">
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

            {/* RIGHT */}
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
        onSubmit={handlePrescriptionSubmit}
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
        <ResultPanel
          finalEval={finalEval}
          specialty={specialty}
          difficulty={difficulty}
          onReset={reset}
          onRetry={retryWithSameConfig}
          onExportPdf={exportCasePdf}
          onShare={shareResult}
          onOpenTutor={openTutorReview}
        />
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
