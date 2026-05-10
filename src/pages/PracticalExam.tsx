import { useState, useEffect, useCallback, useRef } from "react";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { useQueryClient } from "@tanstack/react-query";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { useAuth } from "@/hooks/useAuth";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Stethoscope, Play, Clock, CheckCircle2, XCircle,
  ArrowRight, Loader2, RotateCcw, BookOpen, Trophy,
  AlertTriangle, Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { telemetry } from "@/lib/pedagogicalTelemetry";

const SPECIALTIES = [
  "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia",
  "Emergência", "Neurologia", "Cardiologia", "Pneumologia",
];

const DIFFICULTIES = [
  { value: "básico", label: "Básico", desc: "Casos clássicos" },
  { value: "intermediário", label: "Intermediário", desc: "Apresentações variadas" },
  { value: "avançado", label: "Avançado", desc: "Casos atípicos e complexos" },
];

const PHASE_LABELS: Record<string, string> = {
  anamnese: "Anamnese",
  exame_fisico: "Exame Físico",
  exames_complementares: "Exames Complementares",
  diagnostico: "Diagnóstico",
  conduta: "Conduta",
};

const PHASE_ICONS: Record<string, string> = {
  anamnese: "🗣️",
  exame_fisico: "🩺",
  exames_complementares: "🔬",
  diagnostico: "🎯",
  conduta: "💊",
};

type Step = {
  step_id: number;
  phase: string;
  prompt: string;
  time_limit_seconds: number;
  options: { id: string; text: string }[];
  correct_id: string;
  explanation: string;
  weight: number;
};

type CaseData = {
  case_id: string;
  title: string;
  specialty: string;
  difficulty: string;
  patient_presentation: string;
  steps: Step[];
};

type Evaluation = {
  scores: { raciocinio_clinico: number; conduta: number; priorizacao: number; tempo: number };
  final_score: number;
  grade: string;
  feedback: { step_id: number; correct: boolean; comment: string }[];
  summary: string;
  improvement_tips: string[];
  strong_points: string[];
  weak_points: string[];
};

type Phase = "setup" | "loading" | "exam" | "evaluating" | "result";

export default function PracticalExam() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshUserState();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [specialty, setSpecialty] = useState("Clínica Médica");
  const [difficulty, setDifficulty] = useState("intermediário");
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Telemetry: module opened (Fase A baseline)
  useEffect(() => { telemetry.track('practical_exam_opened'); }, []);

  // Timer countdown
  useEffect(() => {
    if (phase !== "exam" || !caseData) return;
    const step = caseData.steps[currentStep];
    if (!step) return;

    setTimeLeft(step.time_limit_seconds);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, step.time_limit_seconds - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        handleAnswer("timeout");
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentStep, caseData]);

  const handleStart = async () => {
    setPhase("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("practical-exam", {
        body: { action: "generate_case", specialty, difficulty },
      });
      if (res.error) throw res.error;
      setCaseData(res.data);
      setAnswers([]);
      setTimes([]);
      setCurrentStep(0);
      setPhase("exam");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar caso clínico. Tente novamente.");
      setPhase("setup");
    }
  };

  const handleAnswer = useCallback((answerId: string) => {
    if (!caseData) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setAnswers(prev => [...prev, answerId]);
    setTimes(prev => [...prev, elapsed]);

    if (currentStep < caseData.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // All steps done — evaluate
      evaluateExam([...answers, answerId], [...times, elapsed]);
    }
  }, [caseData, currentStep, answers, times]);

  const evaluateExam = async (finalAnswers: string[], finalTimes: number[]) => {
    if (!caseData) return;
    setPhase("evaluating");
    try {
      const res = await supabase.functions.invoke("practical-exam", {
        body: {
          action: "evaluate",
          specialty,
          difficulty,
          steps: caseData.steps,
          answers: finalAnswers,
          times: finalTimes,
          case_summary: caseData.title,
        },
      });
      if (res.error) throw res.error;
      setEvaluation(res.data);
      telemetry.track('practical_exam_completed', { specialty, difficulty });
      if (user?.id) {
        await completeStudyAction({
          userId: user.id,
          taskType: "practical",
          topic: specialty || "Prova Prática",
          source: "auto",
          originModule: "practical-exam",
        });
      }
      refresh("session");
      setPhase("result");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao avaliar desempenho.");
      setPhase("result");
    }
  };

  // ─── SETUP ───
  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Stethoscope className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Prova Prática</h1>
          <p className="text-sm text-muted-foreground">
            Simulação estilo OSCE/residência com avaliação estruturada
          </p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Especialidade</label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Dificuldade</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      difficulty === d.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">{d.label}</p>
                    <p className="text-[10px] text-muted-foreground">{d.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full gap-2 font-bold py-5" size="lg" onClick={handleStart}>
              <Play className="h-5 w-5" />
              INICIAR PROVA
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              Cada decisão tem tempo limitado. Avaliação automática ao final.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── LOADING ───
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 animate-fade-in">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Gerando caso clínico...</p>
      </div>
    );
  }

  // ─── EXAM ───
  if (phase === "exam" && caseData) {
    const step = caseData.steps[currentStep];
    const progress = ((currentStep) / caseData.steps.length) * 100;
    const isUrgent = timeLeft <= 10;

    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm">{caseData.title}</h2>
            <p className="text-[11px] text-muted-foreground">
              Etapa {currentStep + 1}/{caseData.steps.length}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-sm font-bold ${
            isUrgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
          }`}>
            <Timer className="h-4 w-4" />
            {timeLeft}s
          </div>
        </div>

        <Progress value={progress} className="h-1.5" />

        {/* Patient presentation (first step only) */}
        {currentStep === 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-primary mb-1">📋 Apresentação do Paciente</p>
              <p className="text-sm">{caseData.patient_presentation}</p>
            </CardContent>
          </Card>
        )}

        {/* Current step */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>{PHASE_ICONS[step.phase] || "📌"}</span>
              {PHASE_LABELS[step.phase] || step.phase}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{step.prompt}</p>

            <div className="space-y-2">
              {step.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleAnswer(opt.id)}
                  className="w-full text-left p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <span className="text-xs font-bold text-primary mr-2">
                    {opt.id.toUpperCase()})
                  </span>
                  <span className="text-sm">{opt.text}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── EVALUATING ───
  if (phase === "evaluating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 animate-fade-in">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Avaliando seu desempenho...</p>
      </div>
    );
  }

  // ─── RESULT ───
  if (phase === "result") {
    const scores = evaluation?.scores;
    const gradeColors: Record<string, string> = {
      A: "text-emerald-500 bg-emerald-500/10",
      B: "text-blue-500 bg-blue-500/10",
      C: "text-amber-500 bg-amber-500/10",
      D: "text-orange-500 bg-orange-500/10",
      F: "text-destructive bg-destructive/10",
    };

    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-16">
        {/* Score header */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
          <CardContent className="p-5 text-center space-y-3">
            <Trophy className="h-10 w-10 text-primary mx-auto" />
            <div>
              <p className="text-sm text-muted-foreground">Nota Final</p>
              <p className="text-4xl font-bold">{evaluation?.final_score?.toFixed(1) || "—"}</p>
              <Badge className={`text-lg px-3 py-1 mt-1 ${gradeColors[evaluation?.grade || "F"] || ""}`}>
                {evaluation?.grade || "—"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{evaluation?.summary}</p>
          </CardContent>
        </Card>

        {/* Score breakdown */}
        {scores && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Avaliação por Critério</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "raciocinio_clinico", label: "Raciocínio Clínico", icon: "🧠" },
                { key: "conduta", label: "Conduta", icon: "💊" },
                { key: "priorizacao", label: "Priorização", icon: "📋" },
                { key: "tempo", label: "Gestão do Tempo", icon: "⏱️" },
              ].map(({ key, label, icon }) => {
                const val = (scores as any)[key] || 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{label}</span>
                        <span className="font-bold">{val.toFixed(1)}/10</span>
                      </div>
                      <Progress value={val * 10} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Step feedback */}
        {evaluation?.feedback && evaluation.feedback.length > 0 && caseData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Feedback por Etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {evaluation.feedback.map((fb) => {
                const step = caseData.steps.find(s => s.step_id === fb.step_id);
                return (
                  <div
                    key={fb.step_id}
                    className={`p-3 rounded-xl border ${
                      fb.correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {fb.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-xs font-semibold">
                        {step ? `${PHASE_ICONS[step.phase] || ""} ${PHASE_LABELS[step.phase] || step.phase}` : `Etapa ${fb.step_id}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fb.comment}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        {evaluation?.improvement_tips && evaluation.improvement_tips.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Pontos para Melhorar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {evaluation.improvement_tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <TaskCompletionCard
          title="Prova prática concluída!"
          subtitle={`Nota: ${evaluation?.final_score?.toFixed(1) || "—"} — ${evaluation?.grade || "—"}. Progresso atualizado.`}
          secondaryLabel="Nova Prova"
          onSecondary={() => { setPhase("setup"); setEvaluation(null); setCaseData(null); }}
          tertiaryLabel="Revisar no Tutor"
          onTertiary={() => navigate("/dashboard/mentor?origin=practical-exam&specialty=" + encodeURIComponent(specialty))}
        />
      </div>
    );
  }

  return null;
}
