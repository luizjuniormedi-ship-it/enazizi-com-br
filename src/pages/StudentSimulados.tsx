import { useState, useEffect, useCallback, useRef } from "react";
import { isMedicalQuestion } from "@/lib/medicalValidation";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logErrorToBank } from "@/lib/errorBankLogger";
import {
  GraduationCap, Clock, FileText, CheckCircle, ArrowRight, ArrowLeft,
  Loader2, Trophy, AlertTriangle, Play, RotateCcw, BrainCircuit, Sparkles, Activity,
  MessageCircle, HelpCircle, BookOpen, Video, Eye, Target, CheckCheck, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePendingProficiency } from "@/hooks/usePendingProficiency";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import ProficiencyGuidedPanel from "@/components/proficiency/ProficiencyGuidedPanel";
import { telemetry } from "@/lib/pedagogicalTelemetry";

interface SimuladoResult {
  id: string;
  simulado_id: string;
  status: string;
  score: number | null;
  total_questions: number;
  answers_json: any[];
  started_at: string | null;
  finished_at: string | null;
}

interface Simulado {
  id: string;
  title: string;
  description: string | null;
  topics: string[];
  total_questions: number;
  time_limit_minutes: number;
  questions_json: any[];
  professor_id: string;
  start_at: string | null;
  end_at: string | null;
  max_attempts: number;
  feedback_policy: string;
  allow_retake: boolean;
  feedback_released: boolean;
}

interface AssignedSimulado {
  result: SimuladoResult;
  simulado: Simulado;
}

type Phase = "list" | "quiz" | "result";

const StudentSimulados = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { markVisited } = usePendingProficiency();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [assigned, setAssigned] = useState<AssignedSimulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("list");

  // Telemetry: module opened (Fase A baseline)
  useEffect(() => { telemetry.track('simulado_opened'); }, []);

  // Clinical cases (Plantão)
  const [clinicalCases, setClinicalCases] = useState<any[]>([]);
  const [clinicalLoading, setClinicalLoading] = useState(true);

  // Study assignments
  const [studyAssignments, setStudyAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  // Video rooms
  const [videoRooms, setVideoRooms] = useState<any[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);

  // Error bank
  const [errorBankItems, setErrorBankItems] = useState<any[]>([]);
  const [errorBankLoading, setErrorBankLoading] = useState(true);
  const [expandedErrorTopic, setExpandedErrorTopic] = useState<string | null>(null);

  // Quiz state
  const [current, setCurrent] = useState<AssignedSimulado | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const finishedRef = useRef(false);
  const answersRef = useRef(answers);
  const handleSubmitRef = useRef<() => Promise<void>>();

  // Keep answersRef in sync
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Session persistence
  const {
    pendingSession,
    checked: sessionChecked,
    saveSession,
    completeSession,
    abandonSession,
    registerAutoSave,
    clearPending,
  } = useSessionPersistence({ moduleKey: "student-simulados" });

  // Register auto-save callback
  useEffect(() => {
    registerAutoSave(() => {
      if (phase !== "quiz" || !current) return {};
      return {
        answers: answersRef.current,
        questionIndex,
        timeLeft,
        resultId: current.result.id,
        simuladoId: current.simulado.id,
      };
    });
  }, [registerAutoSave, phase, current, questionIndex, timeLeft]);

  // Result state
  const [resultData, setResultData] = useState<{ score: number; total: number; correct: number; details: any[] } | null>(null);

  const loadAssigned = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: results, error: rErr } = await supabase
        .from("teacher_simulado_results")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (rErr) throw rErr;
      if (!results || results.length === 0) {
        setAssigned([]);
        setLoading(false);
        return;
      }

      const simIds = [...new Set(results.map((r) => r.simulado_id))];
      const { data: simulados, error: sErr } = await supabase
        .from("teacher_simulados")
        .select("*")
        .in("id", simIds)
        .in("status", ["published", "scheduled"])
        .lte("start_at", new Date().toISOString());


      if (sErr) throw sErr;

      const simMap = new Map((simulados || []).map((s) => [s.id, s]));
      const list: AssignedSimulado[] = results
        .map((r) => {
          const sim = simMap.get(r.simulado_id);
          if (!sim) return null;
          return {
            result: {
              ...r,
              answers_json: (r.answers_json as any[]) || [],
            } as SimuladoResult,
            simulado: {
              ...sim,
              questions_json: (sim.questions_json as any[]) || [],
            } as Simulado,
          };
        })
        .filter(Boolean) as AssignedSimulado[];

      setAssigned(list);
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível carregar simulados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    markVisited();
    loadAssigned();
  }, [loadAssigned, markVisited]);

  // Load clinical cases
  const loadClinicalCases = useCallback(async () => {
    if (!user) return;
    setClinicalLoading(true);
    try {
      const { data: results, error } = await supabase
        .from("teacher_clinical_case_results")
        .select("*, teacher_clinical_cases(*)")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClinicalCases(results || []);
    } catch (e) {
      console.error("Error loading clinical cases:", e);
    } finally {
      setClinicalLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadClinicalCases();
  }, [loadClinicalCases]);

  // Load study assignments
  const loadStudyAssignments = useCallback(async () => {
    if (!user) return;
    setAssignmentsLoading(true);
    try {
      const { data: results, error } = await supabase
        .from("teacher_study_assignment_results")
        .select("*, teacher_study_assignments(*)")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudyAssignments(results || []);
    } catch (e) {
      console.error("Error loading study assignments:", e);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStudyAssignments();
  }, [loadStudyAssignments]);

  // Load video rooms
  const loadVideoRooms = useCallback(async () => {
    if (!user) return;
    setVideoLoading(true);
    try {
      const { data, error } = await supabase
        .from("video_rooms")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setVideoRooms(data || []);
    } catch (e) {
      console.error("Error loading video rooms:", e);
    } finally {
      setVideoLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVideoRooms();
  }, [loadVideoRooms]);

  // Load error bank
  const loadErrorBank = useCallback(async () => {
    if (!user) return;
    setErrorBankLoading(true);
    try {
      const { data: errors, error } = await supabase
        .from("error_bank")
        .select("*")
        .eq("user_id", user.id)
        .in("tipo_questao", ["simulado", "diagnostico"])
        .eq("dominado", false)
        .order("vezes_errado", { ascending: false });

      if (error) throw error;
      setErrorBankItems(errors || []);
    } catch (e) {
      console.error("Error loading error bank:", e);
    } finally {
      setErrorBankLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadErrorBank();
  }, [loadErrorBank]);

  // Timer — uses refs to avoid stale closures
  useEffect(() => {
    if (phase !== "quiz") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!finishedRef.current && handleSubmitRef.current) {
            finishedRef.current = true;
            handleSubmitRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const startQuiz = async (item: AssignedSimulado, restoredState?: { answers: (number | null)[]; questionIndex: number; timeLeft: number }) => {
    finishedRef.current = false;
    setCurrent(item);
    const questions = (item.simulado.questions_json || []).filter((q: any) => isMedicalQuestion(q));
    item.simulado.questions_json = questions;

    if (restoredState) {
      setAnswers(restoredState.answers);
      setQuestionIndex(restoredState.questionIndex);
      setTimeLeft(restoredState.timeLeft);
    } else {
      setQuestionIndex(0);
      setAnswers(new Array(questions.length).fill(null));
      setTimeLeft(item.simulado.time_limit_minutes * 60);
    }
    setPhase("quiz");

    if (item.result.status === "pending") {
      await supabase
        .from("teacher_simulado_results")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", item.result.id);
    }
  };

  // Handle resume from persisted session
  const handleResumeSession = useCallback(async () => {
    if (!pendingSession) return;
    const data = pendingSession.session_data as any;
    if (!data?.simuladoId || !data?.resultId) {
      abandonSession();
      return;
    }
    // Check if the result is still in_progress
    const { data: result } = await supabase
      .from("teacher_simulado_results")
      .select("status")
      .eq("id", data.resultId)
      .maybeSingle();
    if (!result || result.status === "completed") {
      abandonSession();
      return;
    }
    // Find the matching assigned simulado
    const match = assigned.find(a => a.result.id === data.resultId);
    if (!match) {
      abandonSession();
      return;
    }
    clearPending();
    startQuiz(match, {
      answers: data.answers || [],
      questionIndex: data.questionIndex || 0,
      timeLeft: data.timeLeft || match.simulado.time_limit_minutes * 60,
    });
  }, [pendingSession, assigned, abandonSession, clearPending]);

  const selectAnswer = (optionIndex: number) => {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[questionIndex] = optionIndex;
      return copy;
    });
    // Immediate save on answer change
    setTimeout(() => {
      if (current) {
        saveSession({
          answers: answersRef.current,
          questionIndex,
          timeLeft,
          resultId: current.result.id,
          simuladoId: current.simulado.id,
        });
      }
    }, 100);
  };

  const handleSubmit = useCallback(async () => {
    if (!current) return;
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    const currentAnswers = answersRef.current;
    const questions = current.simulado.questions_json || [];
    let correct = 0;
    const details = questions.map((q: any, i: number) => {
      const isCorrect = currentAnswers[i] === q.correct_index;
      if (isCorrect) correct++;
      return {
        question_index: i,
        selected: currentAnswers[i],
        correct_index: q.correct_index,
        is_correct: isCorrect,
        topic: q.topic,
      };
    });

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

    try {
      // Log wrong answers to error_bank
      for (const d of details) {
        if (!d.is_correct && d.selected !== null) {
          const q = questions[d.question_index];
          await logErrorToBank({
            userId: user!.id,
            questionId: (q as any).id,
            tema: q.topic || "Geral",
            tipoQuestao: "simulado",
            conteudo: q.statement?.slice(0, 500) || "",
            motivoErro: `Marcou "${q.options?.[d.selected]}" — Correta: "${q.options?.[d.correct_index]}"`,
            categoriaErro: "conceito",
          });
        }
      }

      await supabase
        .from("teacher_simulado_results")
        .update({
          status: "completed",
          score,
          answers_json: details,
          finished_at: new Date().toISOString(),
        })
        .eq("id", current.result.id);

      await completeSession();
      setResultData({ score, total: questions.length, correct, details });
      setPhase("result");
      telemetry.track('simulado_completed', { score, total: questions.length, correct });
      toast({ title: "Simulado concluído!", description: `Sua nota: ${score}%` });
    } catch {
      finishedRef.current = false;
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [current, user, toast, completeSession]);

  // Keep handleSubmitRef in sync
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  const backToList = () => {
    if (phase === "quiz") {
      abandonSession();
    }
    setPhase("list");
    setCurrent(null);
    setResultData(null);
    finishedRef.current = false;
    loadAssigned();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // ============ LIST VIEW ============
  if (phase === "list") {
    const pending = assigned.filter((a) => a.result.status !== "completed");
    const completed = assigned.filter((a) => a.result.status === "completed");

    const pendingClinical = clinicalCases.filter((c: any) => c.status !== "completed");
    const completedClinical = clinicalCases.filter((c: any) => c.status === "completed");

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Resume session banner */}
        {sessionChecked && pendingSession && (
          <ResumeSessionBanner
            updatedAt={pendingSession.updated_at}
            onResume={handleResumeSession}
            onDiscard={abandonSession}
          />
        )}

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Proficiência
          </h1>
          <p className="text-muted-foreground text-sm">Simulados e plantões atribuídos pelo seu professor.</p>
        </div>

        {/* Proficiência Guiada (Fase 3) — só aparece quando há plano ativo do professor */}
        <ProficiencyGuidedPanel />

        <Tabs defaultValue={searchParams.get("tab") === "temas" ? "temas" : searchParams.get("tab") === "erros" ? "erros" : "simulados"}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="simulados">📝 Simulados ({assigned.length})</TabsTrigger>
            <TabsTrigger value="plantao">🏥 Plantões ({clinicalCases.length})</TabsTrigger>
            <TabsTrigger value="temas">📖 Temas ({studyAssignments.length})</TabsTrigger>
            <TabsTrigger value="sala">📹 Sala ({videoRooms.filter((r: any) => r.status === "active").length})</TabsTrigger>
            <TabsTrigger value="erros" className="gap-1">
              🎯 Erros {errorBankItems.length > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{errorBankItems.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simulados" className="space-y-4 mt-4">
        {loading ? (
          <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
        ) : assigned.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum simulado atribuído</h3>
              <p className="text-sm text-muted-foreground mb-6">Quando seu professor criar um simulado para você, ele aparecerá aqui.</p>
              <p className="text-xs text-muted-foreground mb-3">Enquanto isso, continue praticando:</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={() => navigate("/dashboard/mentor")} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Praticar com Tutor IA
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard/questoes")} className="gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Gerar Questões
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Pendentes ({pending.length})
                </h2>
                {pending.map((item) => {
                  const isExpired = item.simulado.end_at && new Date(item.simulado.end_at) < new Date();
                  return (
                  <Card key={item.result.id} className={`border-amber-500/30 transition-colors ${isExpired ? 'opacity-60 grayscale' : 'hover:border-amber-500/60'}`}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.simulado.title}</h3>
                          {isExpired && <Badge variant="destructive" className="text-[9px] uppercase">Expirado</Badge>}
                        </div>
                        {item.simulado.end_at && (
                          <p className={`text-[10px] font-bold uppercase mt-1 ${isExpired ? 'text-destructive' : 'text-amber-600'}`}>
                            {isExpired ? 'Prazo encerrado em: ' : 'Prazo até: '}
                            {new Date(item.simulado.end_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                        {item.simulado.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{item.simulado.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(item.simulado.topics || []).slice(0, 4).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{item.simulado.total_questions} questões</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.simulado.time_limit_minutes} min</span>
                        </div>
                      </div>
                      <Button onClick={() => startQuiz(item)} className="gap-2 shrink-0" disabled={isExpired && item.result.status !== "in_progress"}>
                        <Play className="h-4 w-4" />
                        {item.result.status === "in_progress" ? "Continuar" : "Iniciar"}
                      </Button>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}

            {completed.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Concluídos ({completed.length})
                </h2>
                {completed.map((item) => (
                  <Card key={item.result.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{item.simulado.title}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(item.simulado.topics || []).slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.result.finished_at ? new Date(item.result.finished_at).toLocaleDateString("pt-BR") : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            (item.result.score || 0) >= 70 ? "text-emerald-500" :
                            (item.result.score || 0) >= 50 ? "text-amber-500" : "text-destructive"
                          }`}>
                            {Math.round(item.result.score || 0)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {((item.result.answers_json || []) as any[]).filter((a: any) => a.is_correct).length}/{item.simulado.total_questions} acertos
                          </p>
                        </div>
                        {(() => {
                          const canSeeFeedback = 
                            item.simulado.feedback_policy === 'immediate' ||
                            (item.simulado.feedback_policy === 'after_deadline' && item.simulado.end_at && new Date(item.simulado.end_at) < new Date()) ||
                            (item.simulado.feedback_policy === 'manual' && item.simulado.feedback_released);
                          
                          if (!canSeeFeedback) {
                            return <Badge variant="secondary" className="text-[9px] uppercase">Gabarito em breve</Badge>;
                          }

                          return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              const answersArr = (item.result.answers_json || []) as any[];
                              const correctCount = answersArr.filter((a: any) => a.is_correct).length;
                              const total = item.simulado.total_questions;
                              const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
                              setResultData({
                                score,
                                total,
                                correct: correctCount,
                                details: answersArr,
                              });
                              setCurrent(item);
                              setPhase("result");
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver Gabarito
                          </Button>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
          </TabsContent>

          <TabsContent value="plantao" className="space-y-4 mt-4">
            {clinicalLoading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
            ) : clinicalCases.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum plantão atribuído</h3>
                  <p className="text-sm text-muted-foreground mb-6">Quando seu professor criar um caso de plantão para você, ele aparecerá aqui.</p>
                  <p className="text-xs text-muted-foreground mb-3">Enquanto isso, pratique por conta própria:</p>
                  <Button variant="outline" onClick={() => navigate("/dashboard/anamnese")} className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Treinar Anamnese
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingClinical.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Plantões Pendentes ({pendingClinical.length})
                    </h2>
                    {pendingClinical.map((item: any) => {
                      const caseInfo = item.teacher_clinical_cases;
                      return (
                        <Card key={item.id} className="border-red-500/30 hover:border-red-500/60 transition-colors">
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-red-500" />
                                <h3 className="font-semibold">{caseInfo?.title || "Caso Clínico"}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                <Badge variant="outline" className="text-[10px]">{caseInfo?.specialty}</Badge>
                                <Badge variant="secondary" className="text-[10px] capitalize">{caseInfo?.difficulty}</Badge>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{caseInfo?.time_limit_minutes || 20} min</span>
                              </div>
                            </div>
                            <Button
                              onClick={() => navigate(`/dashboard/plantao?teacher_case_id=${item.case_id}`)}
                              className="gap-2 shrink-0 bg-red-600 hover:bg-red-700"
                            >
                              <Play className="h-4 w-4" />
                              {item.status === "in_progress" ? "Continuar" : "Iniciar Plantão"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {completedClinical.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      Plantões Concluídos ({completedClinical.length})
                    </h2>
                    {completedClinical.map((item: any) => {
                      const caseInfo = item.teacher_clinical_cases;
                      return (
                        <Card key={item.id}>
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                <h3 className="font-semibold">{caseInfo?.title || "Caso Clínico"}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <Badge variant="outline" className="text-[10px]">{caseInfo?.specialty}</Badge>
                                <span>{item.finished_at ? new Date(item.finished_at).toLocaleDateString("pt-BR") : ""}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-2xl font-bold ${
                                (item.final_score || 0) >= 70 ? "text-emerald-500" :
                                (item.final_score || 0) >= 50 ? "text-amber-500" : "text-destructive"
                              }`}>
                                {item.grade || "F"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{item.final_score || 0}/100 pts</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="temas" className="space-y-4 mt-4">
            {assignmentsLoading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
            ) : studyAssignments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum tema atribuído</h3>
                  <p className="text-sm text-muted-foreground mb-6">Quando seu professor atribuir temas de estudo, eles aparecerão aqui.</p>
                  <Button variant="outline" onClick={() => navigate("/dashboard/sessao-estudo")} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Estudar por conta própria
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {studyAssignments.filter((a: any) => a.status !== "completed").length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Pendentes
                    </h2>
                    {studyAssignments.filter((a: any) => a.status !== "completed").map((item: any) => {
                      const assignment = item.teacher_study_assignments;
                      return (
                        <Card key={item.id} className="border-primary/30 hover:border-primary/60 transition-colors">
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <h3 className="font-semibold">{assignment?.title || "Tema"}</h3>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{assignment?.topics_to_cover}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                <Badge variant="outline" className="text-[10px]">{assignment?.specialty}</Badge>
                                {assignment?.material_filename && assignment?.material_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] gap-1 text-primary"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const { data } = await supabase.storage.from("user-uploads").createSignedUrl(assignment.material_url, 3600);
                                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                      } catch {
                                        toast({ title: "Erro ao abrir material", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    📎 {assignment.material_filename}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => {
                                const params = new URLSearchParams({
                                  topic: assignment?.title || "",
                                  professorTopics: assignment?.topics_to_cover || "",
                                  assignmentId: item.id,
                                });
                                if (assignment?.material_url) params.set("materialUrl", assignment.material_url);
                                navigate(`/dashboard/sessao-estudo?${params.toString()}`);
                              }}
                              className="gap-2 shrink-0"
                            >
                              <Play className="h-4 w-4" />
                              {item.status === "studying" ? "Continuar" : "Estudar com Tutor IA"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {studyAssignments.filter((a: any) => a.status === "completed").length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      Concluídos
                    </h2>
                    {studyAssignments.filter((a: any) => a.status === "completed").map((item: any) => {
                      const assignment = item.teacher_study_assignments;
                      return (
                        <Card key={item.id}>
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                <h3 className="font-semibold">{assignment?.title || "Tema"}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <Badge variant="outline" className="text-[10px]">{assignment?.specialty}</Badge>
                                <span>{item.completed_at ? new Date(item.completed_at).toLocaleDateString("pt-BR") : ""}</span>
                                {assignment?.material_filename && assignment?.material_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] gap-1 text-primary"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const { data } = await supabase.storage.from("user-uploads").createSignedUrl(assignment.material_url, 3600);
                                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                      } catch {
                                        toast({ title: "Erro ao abrir material", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    📎 {assignment.material_filename}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Badge variant="default" className="text-xs">✅ Concluído</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="sala" className="space-y-4 mt-4">
            {videoLoading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
            ) : videoRooms.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Video className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma sala de aula</h3>
                  <p className="text-sm text-muted-foreground">Quando seu professor iniciar uma aula ao vivo, ela aparecerá aqui.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {videoRooms.filter((r: any) => r.status === "active").length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      Ao Vivo
                    </h2>
                    {videoRooms.filter((r: any) => r.status === "active").map((room: any) => (
                      <Card key={room.id} className="border-primary/30 hover:border-primary/60 transition-colors">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4 text-primary" />
                              <h3 className="font-semibold">{room.title || "Sala de Aula"}</h3>
                              <Badge className="bg-primary text-primary-foreground text-[10px] animate-pulse">AO VIVO</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Código: {room.room_code} • Iniciado {new Date(room.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              const meetUrl = `https://meet.jit.si/${room.room_code}`;
                              window.open(meetUrl, "_blank");
                            }}
                            className="gap-2 shrink-0"
                          >
                            <Play className="h-4 w-4" /> Entrar
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {videoRooms.filter((r: any) => r.status === "ended").length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      Encerradas
                    </h2>
                    {videoRooms.filter((r: any) => r.status === "ended").map((room: any) => (
                      <Card key={room.id}>
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-muted-foreground">{room.title || "Sala de Aula"}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(room.created_at).toLocaleDateString("pt-BR")} • {room.ended_at ? new Date(room.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">Encerrada</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Error Bank Tab */}
          <TabsContent value="erros" className="space-y-4 mt-4">
            {errorBankLoading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
            ) : errorBankItems.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Target className="h-12 w-12 text-emerald-500/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum erro registrado! 🎉</h3>
                  <p className="text-sm text-muted-foreground">Continue praticando — quando errar questões nos simulados do professor, elas aparecerão aqui para revisão.</p>
                </CardContent>
              </Card>
            ) : (() => {
              // Group errors by tema
              const grouped: Record<string, { items: typeof errorBankItems; totalErrors: number }> = {};
              errorBankItems.forEach((err) => {
                const key = err.tema || "Geral";
                if (!grouped[key]) grouped[key] = { items: [], totalErrors: 0 };
                grouped[key].items.push(err);
                grouped[key].totalErrors += err.vezes_errado || 1;
              });
              const sortedTopics = Object.entries(grouped).sort((a, b) => b[1].totalErrors - a[1].totalErrors);

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {errorBankItems.length} erro{errorBankItems.length > 1 ? "s" : ""} em {sortedTopics.length} tema{sortedTopics.length > 1 ? "s" : ""} — revise com o Tutor IA para dominar.
                    </p>
                  </div>

                  {sortedTopics.map(([topic, data]) => {
                    const isExpanded = expandedErrorTopic === topic;
                    const severity = data.totalErrors >= 3 ? "destructive" : data.totalErrors >= 2 ? "secondary" : "outline";

                    return (
                      <Card key={topic} className={`border ${data.totalErrors >= 3 ? "border-destructive/40" : data.totalErrors >= 2 ? "border-amber-500/40" : "border-border"}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <button
                              className="flex items-center gap-2 text-left flex-1"
                              onClick={() => setExpandedErrorTopic(isExpanded ? null : topic)}
                            >
                              <XCircle className={`h-4 w-4 shrink-0 ${data.totalErrors >= 3 ? "text-destructive" : "text-amber-500"}`} />
                              <div>
                                <span className="font-semibold text-sm">{topic}</span>
                                {data.items[0]?.subtema && (
                                  <span className="text-xs text-muted-foreground ml-2">• {data.items[0].subtema}</span>
                                )}
                              </div>
                              <Badge variant={severity as any} className="text-[10px] ml-2">
                                {data.totalErrors} erro{data.totalErrors > 1 ? "s" : ""}
                              </Badge>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => {
                                  const errDetails = data.items.map((e, i) =>
                                    `❌ ${e.conteudo?.slice(0, 150) || "Questão sem enunciado"}${e.motivo_erro ? `\n   ${e.motivo_erro}` : ""}`
                                  ).join("\n\n");
                                  const msg = `Preciso revisar "${topic}" — errei ${data.totalErrors} vez(es) em simulados do professor.\n\n${errDetails}\n\nMe explique cada conceito detalhadamente e me ajude a não errar novamente.`;
                                  navigate("/dashboard/mentor", { state: { fromSimulado: true, initialMessage: msg } });
                                }}
                              >
                                <Sparkles className="h-3 w-3" />
                                Revisar com Tutor IA
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                              {data.items.map((err) => (
                                <div key={err.id} className="p-3 rounded-lg bg-secondary/50 text-sm space-y-1">
                                  {err.conteudo && (
                                    <p className="text-xs">{err.conteudo}</p>
                                  )}
                                  {err.motivo_erro && (
                                    <p className="text-xs text-destructive">{err.motivo_erro}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      Errou {err.vezes_errado}x • {new Date(err.updated_at).toLocaleDateString("pt-BR")}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] gap-1 text-emerald-600"
                                      onClick={async () => {
                                        await supabase
                                          .from("error_bank")
                                          .update({ dominado: true, dominado_em: new Date().toISOString() })
                                          .eq("id", err.id);
                                        setErrorBankItems((prev) => prev.filter((e) => e.id !== err.id));
                                        toast({ title: "Marcado como dominado! ✓" });
                                      }}
                                    >
                                      <CheckCheck className="h-3 w-3" />
                                      Dominado
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ============ QUIZ VIEW ============
  if (phase === "quiz" && current) {
    const questions = current.simulado.questions_json || [];
    const q = questions[questionIndex];
    const answeredCount = answers.filter((a) => a !== null).length;
    const isLowTime = timeLeft < 60;
    const displayBlock = String(q?.block || "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
    const previousDisplayBlock = String(questions[questionIndex - 1]?.block || "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();

    return (
      <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">{current.simulado.title}</h2>
            <p className="text-xs text-muted-foreground">Questão {questionIndex + 1} de {questions.length}</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold ${
            isLowTime ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"
          }`}>
            <Clock className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
        </div>

        <Progress value={((questionIndex + 1) / questions.length) * 100} className="h-1.5" />

        {/* Block indicator */}
        {displayBlock && (questionIndex === 0 || previousDisplayBlock !== displayBlock) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
            <span className="text-sm font-semibold text-primary">📋 Bloco: {displayBlock}</span>
          </div>
        )}

        {/* Question */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-6">
              <Badge className="shrink-0 mt-0.5">{questionIndex + 1}</Badge>
              <div>
                <p className="text-sm font-medium leading-relaxed">{q?.statement}</p>
              </div>
            </div>

            <div className="space-y-2">
              {(q?.options || []).map((opt: string, i: number) => {
                const selected = answers[questionIndex] === i;
                return (
                  <button
                    key={i}
                    onClick={() => selectAnswer(i)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selected
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))}
            disabled={questionIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>

          <p className="text-xs text-muted-foreground">{answeredCount}/{questions.length} respondidas</p>

          {questionIndex < questions.length - 1 ? (
            <Button onClick={() => setQuestionIndex((i) => i + 1)} className="gap-2">
              Próxima <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {submitting ? "Enviando..." : "Finalizar"}
            </Button>
          )}
        </div>

        {/* Question dots */}
        <div className="flex flex-wrap gap-1.5 justify-center pt-2">
          {questions.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setQuestionIndex(i)}
              className={`h-7 w-7 rounded-full text-[10px] font-bold border transition-colors ${
                i === questionIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : answers[i] !== null
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ============ RESULT VIEW ============
  if (phase === "result" && resultData && current) {
    const { score, total, correct, details } = resultData;
    const questions = current.simulado.questions_json || [];

    // Group by topic
    const byTopic: Record<string, { total: number; correct: number }> = {};
    details.forEach((d) => {
      const t = d.topic || "Geral";
      if (!byTopic[t]) byTopic[t] = { total: 0, correct: 0 };
      byTopic[t].total++;
      if (d.is_correct) byTopic[t].correct++;
    });

    return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        {/* Score header */}
        <Card className="overflow-hidden">
          <div className={`p-8 text-center ${
            score >= 70 ? "bg-emerald-500/10" : score >= 50 ? "bg-amber-500/10" : "bg-destructive/10"
          }`}>
            <Trophy className={`h-12 w-12 mx-auto mb-3 ${
              score >= 70 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-destructive"
            }`} />
            <p className={`text-5xl font-bold ${
              score >= 70 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-destructive"
            }`}>
              {score}%
            </p>
            <p className="text-muted-foreground mt-2">{correct} de {total} questões corretas</p>
            <h3 className="font-semibold text-lg mt-1">{current.simulado.title}</h3>
          </div>
        </Card>

        {/* By topic */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desempenho por Tema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(byTopic).map(([topic, data]) => {
              const pct = Math.round((data.correct / data.total) * 100);
              return (
                <div key={topic}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{topic}</span>
                    <span className={`font-bold ${pct >= 70 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-destructive"}`}>
                      {data.correct}/{data.total} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Question review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisão das Questões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {details.map((d, i) => {
              const q = questions[i];
              return (
                <div key={i} className={`p-4 rounded-lg border ${d.is_correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <Badge variant={d.is_correct ? "default" : "destructive"} className="shrink-0 text-[10px]">
                      {d.is_correct ? "✓" : "✗"} Q{i + 1}
                    </Badge>
                    <p className="text-sm">{q?.statement}</p>
                  </div>
                  {!d.is_correct && (
                    <div className="ml-8 space-y-1 text-xs">
                      <p className="text-destructive">Sua resposta: {q?.options?.[d.selected] || "Não respondida"}</p>
                      <p className="text-emerald-600">Correta: {q?.options?.[d.correct_index]}</p>
                      {q?.explanation && <p className="text-muted-foreground mt-1 italic">{q.explanation}</p>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 gap-1 text-primary h-7 px-2"
                        onClick={() => {
                          const msg = `Errei esta questão de ${d.topic || "Geral"}:\n\n"${q?.statement?.slice(0, 400)}"\n\nMarquei: "${q?.options?.[d.selected] || "Não respondida"}"\nCorreta: "${q?.options?.[d.correct_index]}"\n\nExplique detalhadamente por que a alternativa correta é a certa e por que a minha está errada.`;
                          navigate("/dashboard/mentor", {
                            state: { fromSimulado: true, initialMessage: msg }
                          });
                        }}
                      >
                        <Sparkles className="h-3 w-3" />
                        Estudar com Tutor IA
                      </Button>
                    </div>
                  )}
                  {d.is_correct && q?.explanation && (
                    <p className="ml-8 text-xs text-muted-foreground italic">{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Error bank by topic */}
        {(() => {
          const errorsByTopic: Record<string, { count: number; questions: { statement: string; selected: string; correct: string }[] }> = {};
          details.forEach((d, idx) => {
            if (d.is_correct) return;
            const t = d.topic || "Geral";
            const q = questions[d.question_index ?? idx];
            if (!errorsByTopic[t]) errorsByTopic[t] = { count: 0, questions: [] };
            errorsByTopic[t].count++;
            errorsByTopic[t].questions.push({
              statement: q?.statement?.slice(0, 150) || "",
              selected: q?.options?.[d.selected] || "Não respondida",
              correct: q?.options?.[d.correct_index ?? q?.correct_index] || "",
            });
          });
          const topics = Object.entries(errorsByTopic);
          if (topics.length === 0) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Banco de Erros do Simulado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Revise cada tema com o Tutor IA para consolidar o aprendizado.</p>
                {topics.map(([topic, data]) => (
                  <div key={topic} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold">{topic}</span>
                        <Badge variant="destructive" className="ml-2 text-[10px]">{data.count} erro{data.count > 1 ? "s" : ""}</Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => {
                          const msg = `Preciso revisar "${topic}" — errei ${data.count} questão(ões) no simulado "${current.simulado.title}".\n\n${data.questions.map((q, i) => `❌ Q${i+1}: ${q.statement}...\nMarquei: "${q.selected}" — Correta: "${q.correct}"`).join("\n\n")}\n\nMe explique cada erro detalhadamente.`;
                          navigate("/dashboard/mentor", { state: { fromSimulado: true, initialMessage: msg } });
                        }}
                      >
                        <Sparkles className="h-3 w-3" />
                        Revisar com Tutor IA
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        <div className="flex flex-col items-center gap-3">
          {details.some(d => !d.is_correct) && (
            <Button
              onClick={() => {
                const errors = details
                  .filter(d => !d.is_correct)
                  .map((d, idx) => {
                    const q = questions[d.question_index];
                    return {
                      topic: d.topic || "Geral",
                      statement: q?.statement?.slice(0, 300) || "",
                      selectedAnswer: q?.options?.[d.selected] || "Não respondida",
                      correctAnswer: q?.options?.[d.correct_index] || "",
                    };
                  });
                const topics = [...new Set(errors.map(e => e.topic))];
                const msg = `Acabei de fazer o simulado "${current.simulado.title}" e errei ${errors.length} questão(ões). Os temas foram: ${topics.join(", ")}.\n\n${errors.map((e, i) => `❌ Q${i+1} (${e.topic}): ${e.statement.slice(0, 150)}...\nMarquei: "${e.selectedAnswer}" — Correta: "${e.correctAnswer}"`).join("\n\n")}\n\nMe ajude a revisar cada erro com explicações detalhadas.`;
                navigate("/dashboard/mentor", {
                  state: { fromSimulado: true, initialMessage: msg }
                });
              }}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
              size="lg"
            >
              <BrainCircuit className="h-5 w-5" />
              Revisar Erros com Tutor IA
            </Button>
          )}
          <Button onClick={backToList} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Voltar aos Simulados
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default StudentSimulados;
