import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { EXAM_PROFILES, type ExamProfile } from "@/lib/examProfiles";
import { GraduationCap, Plus, Users, FileText, BarChart3, Loader2, Clock, CheckCircle, Send, Sparkles, Database, ChevronDown, ChevronUp, Eye, Trash2, PenLine, CheckSquare, Square, Video, Gauge, CalendarClock, ToggleLeft, Timer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ClassAnalytics from "@/components/professor/ClassAnalytics";
import ProfessorPlantao from "@/components/professor/ProfessorPlantao";
import StudentTracker from "@/components/professor/StudentTracker";
import VideoRoom from "@/components/professor/VideoRoom";
import TeacherStudyAssignments from "@/components/professor/TeacherStudyAssignments";
import MentorThemePlans from "@/components/professor/MentorThemePlans";
const ProfessorBIPanel = lazy(() => import("@/components/professor/ProfessorBIPanel"));
import ProfessorPracticalExams from "@/components/professor/ProfessorPracticalExams";



import { FACULDADES } from "@/constants/faculdades";

const ProfessorDashboard = () => {
  const { session } = useAuth();
  const { toast } = useToast();

  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("Simulado");
  const [description, setDescription] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [subtopics, setSubtopics] = useState<Record<string, string>>({});
  const [faculdadeFilter, setFaculdadeFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [timeLimit, setTimeLimit] = useState("60");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [useAI, setUseAI] = useState(true);
  const [questionMode, setQuestionMode] = useState<"ai" | "manual">("ai");
  const [difficulty, setDifficulty] = useState("misto");
  const [difficultyMix, setDifficultyMix] = useState({ facil: 20, intermediario: 40, dificil: 40 });
  const [scheduledAt, setScheduledAt] = useState("");
  const [autoAssign, setAutoAssign] = useState(true);
  const [examBoard, setExamBoard] = useState("all");

  // Manual question form
  const [manualStatement, setManualStatement] = useState("");
  const [manualOptions, setManualOptions] = useState(["", "", "", "", ""]);
  const [manualCorrect, setManualCorrect] = useState("0");
  const [manualTopic, setManualTopic] = useState("");
  const [manualQuestions, setManualQuestions] = useState<any[]>([]);

  // Bank questions
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [selectedBankQuestions, setSelectedBankQuestions] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Expanded question review
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Topic distribution
  const [topicDistribution, setTopicDistribution] = useState<Record<string, number>>({});
  const [useDistribution, setUseDistribution] = useState(false);

  // Results dialog
  const [resultsDialog, setResultsDialog] = useState<{ open: boolean; simulado: any; results: any[]; loading: boolean; questions_json: any[] }>({ open: false, simulado: null, results: [], loading: false, questions_json: [] });
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Students preview
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Global student search
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-simulado`;

  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeoutMs = body.action === "generate_questions" ? 180000 : 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro na operação");
      return data;
    } catch (e: any) {
      if (e.name === "AbortError") throw new Error("Tempo esgotado. Tente com menos questões.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }, [session, API_URL]);

  const loadSimulados = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callAPI({ action: "list_simulados" });
      setSimulados(res.simulados || []);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, callAPI, toast]);

  const allExamTopics = useMemo(() => {
    const topics = new Set<string>();
    Object.values(EXAM_PROFILES).forEach((profile) => {
      Object.keys(profile.specialtyWeights || {}).forEach((topic) => topics.add(topic));
    });
    return [...topics];
  }, []);

  useEffect(() => { loadSimulados(); }, [loadSimulados]);

  useEffect(() => {
    if (!showCreate || questionMode !== "ai" || examBoard !== "all") return;
    setSelectedTopics((prev) => (prev.length > 0 ? prev : allExamTopics));
  }, [allExamTopics, examBoard, questionMode, showCreate]);

  const previewMatchingStudents = async () => {
    setPreviewLoading(true);
    try {
      const res = await callAPI({
        action: "get_students",
        faculdade: faculdadeFilter && faculdadeFilter !== "all" ? faculdadeFilter : undefined,
        periodo: periodoFilter && periodoFilter !== "all" ? parseInt(periodoFilter) : undefined,
      });
      const students = res.students || [];
      setPreviewStudents(students);
      // Auto-select all students
      setSelectedStudentIds(students.map((s: any) => s.user_id));
    } catch {
      setPreviewStudents([]);
      setSelectedStudentIds([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const searchStudentGlobal = async () => {
    if (studentSearch.length < 3) {
      toast({ title: "Digite pelo menos 3 caracteres", variant: "destructive" });
      return;
    }
    setSearchingStudents(true);
    try {
      const res = await callAPI({ action: "search_students", query: studentSearch });
      setSearchResults((res.students || []).filter((s: any) => !previewStudents.some((p: any) => p.user_id === s.user_id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  const addSearchedStudent = (student: any) => {
    if (previewStudents.some((s: any) => s.user_id === student.user_id)) return;
    setPreviewStudents((prev) => [...prev, student]);
    setSelectedStudentIds((prev) => [...prev, student.user_id]);
    setSearchResults((prev) => prev.filter((s: any) => s.user_id !== student.user_id));
  };

  const toggleStudentSelection = (userId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudentIds.length === previewStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(previewStudents.map((s: any) => s.user_id));
    }
  };

  const removeGeneratedQuestion = (idx: number) => {
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const regenerateMissing = async () => {
    const target = parseInt(questionCount);
    const currentQuestions = [...generatedQuestions]; // snapshot
    const deficit = target - currentQuestions.length;
    if (deficit <= 0) return;
    setGenerating(true);
    try {
      const topicsWithSubs = selectedTopics.map((t) => {
        const subs = subtopics[t]?.trim();
        return subs ? `${t} (${subs})` : t;
      });
      const previousStatements = currentQuestions.map((q: any) => String(q.statement || "").slice(0, 120));
      
      toast({ title: "Regenerando...", description: `Gerando ${deficit} questões faltantes` });
      
      const res = await callAPI({
        action: "generate_questions",
        topics: topicsWithSubs,
        count: deficit,
        difficulty,
        difficultyMix: difficulty === "misto" ? difficultyMix : undefined,
        previousStatements,
      });
      
      const newQs = res.questions || [];
      // Merge with snapshot to avoid race condition
      const merged = [...currentQuestions, ...newQs];
      setGeneratedQuestions(merged);
      toast({ title: "Pronto!", description: `${newQs.length} questões regeneradas. Total: ${merged.length}/${target}` });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao regenerar", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const generateQuestionsAI = async () => {
    if (selectedTopics.length === 0) {
      toast({ title: "Selecione temas", description: "Escolha pelo menos um tema para gerar questões.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGeneratedQuestions([]);
    setExpandedQuestion(null);
    try {
      const total = parseInt(questionCount);
      let allQuestions: any[] = [];

      // If using topic distribution, generate per-topic
      if (useDistribution && selectedTopics.length > 1) {
        for (const topic of selectedTopics) {
          const topicCount = topicDistribution[topic] || 0;
          if (topicCount <= 0) continue;
          const subs = subtopics[topic]?.trim();
          const topicLabel = subs ? `${topic} (${subs})` : topic;
          
          const BATCH = 10;
          const batches = Math.ceil(topicCount / BATCH);
          let topicQuestions: any[] = [];
          
          for (let b = 0; b < batches; b++) {
            const batchCount = Math.min(BATCH, topicCount - topicQuestions.length);
            if (batchCount <= 0) break;
            
            toast({ title: `${topic}: lote ${b + 1}/${batches}`, description: `${allQuestions.length + topicQuestions.length}/${total} questões prontas` });
            
            const previousStatements = [...allQuestions, ...topicQuestions].map((q: any) => String(q.statement || "").slice(0, 120));
            
            try {
              const res = await callAPI({
                action: "generate_questions",
                topics: [topicLabel],
                count: batchCount,
                difficulty,
                difficultyMix: difficulty === "misto" ? difficultyMix : undefined,
                previousStatements: previousStatements.length > 0 ? previousStatements : undefined,
                examBoard: examBoard !== "all" ? examBoard : undefined,
              });
              if (res.source === "cache") {
                toast({ title: "📦 Questões do banco", description: "Todas as questões vieram do banco existente (sem custo de IA)." });
              } else if (res.source === "mixed") {
                toast({ title: "🔄 Questões mistas", description: "Parte do banco existente + parte gerada por IA." });
              } else if (res.source === "bank") {
                toast({ title: "📦 Questões do banco", description: "A IA não respondeu, usamos questões do banco existente." });
              }
              topicQuestions = [...topicQuestions, ...(res.questions || [])];
            } catch (batchErr) {
              console.error(`Batch ${b + 1} for ${topic} failed:`, batchErr);
              toast({ title: `Erro no lote ${b + 1} de ${topic}`, description: "Continuando com os próximos...", variant: "destructive" });
            }
          }
          allQuestions = [...allQuestions, ...topicQuestions];
          setGeneratedQuestions([...allQuestions]);
        }
      } else {
        // Original logic: all topics together in batches
        const topicsWithSubs = selectedTopics.map((t) => {
          const subs = subtopics[t]?.trim();
          return subs ? `${t} (${subs})` : t;
        });
        const FRONTEND_BATCH = 10;
        const batches = Math.ceil(total / FRONTEND_BATCH);

        for (let b = 0; b < batches; b++) {
          const batchCount = Math.min(FRONTEND_BATCH, total - allQuestions.length);
          if (batchCount <= 0) break;

          toast({ title: `Gerando lote ${b + 1}/${batches}...`, description: `${allQuestions.length}/${total} questões prontas` });

          const previousStatements = allQuestions.map((q: any) => String(q.statement || "").slice(0, 120));

          try {
            const res = await callAPI({
              action: "generate_questions",
              topics: topicsWithSubs,
              count: batchCount,
              difficulty,
              difficultyMix: difficulty === "misto" ? difficultyMix : undefined,
              previousStatements: previousStatements.length > 0 ? previousStatements : undefined,
              examBoard: examBoard !== "all" ? examBoard : undefined,
            });
            if (res.source === "cache") {
              toast({ title: "📦 Questões do banco", description: "Todas as questões vieram do banco existente (sem custo de IA)." });
            } else if (res.source === "mixed") {
              toast({ title: "🔄 Questões mistas", description: "Parte do banco existente + parte gerada por IA." });
            } else if (res.source === "bank") {
              toast({ title: "📦 Questões do banco", description: "A IA não respondeu, usamos questões do banco existente." });
            }
            const batchQ = res.questions || [];
            allQuestions = [...allQuestions, ...batchQ];
            setGeneratedQuestions([...allQuestions]);
          } catch (batchErr) {
            console.error(`Batch ${b + 1} failed:`, batchErr);
            toast({ title: `Erro no lote ${b + 1}`, description: "Continuando com os próximos...", variant: "destructive" });
          }
        }
      }

      // Complement loop: fill deficit if fewer than target
      const target = total;
      for (let fill = 0; fill < 4 && allQuestions.length < target; fill++) {
        const deficit = target - allQuestions.length;
        toast({ title: `Completando déficit...`, description: `Faltam ${deficit} questões (tentativa ${fill + 1})` });
        const prevStmts = allQuestions.map((q: any) => String(q.statement || "").slice(0, 120));
        const topicsWithSubsFill = selectedTopics.map((t) => {
          const subs = subtopics[t]?.trim();
          return subs ? `${t} (${subs})` : t;
        });
        try {
          const res = await callAPI({
            action: "generate_questions",
            topics: topicsWithSubsFill,
            count: deficit,
            difficulty,
            previousStatements: prevStmts,
            examBoard: examBoard !== "all" ? examBoard : undefined,
          });
          allQuestions = [...allQuestions, ...(res.questions || [])];
          setGeneratedQuestions([...allQuestions]);
        } catch { break; }
      }

      toast({ title: "Questões geradas!", description: `${allQuestions.length} questões criadas.` });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao gerar", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const createSimulado = async () => {
    const questions = questionMode === "manual" ? manualQuestions : (useAI ? generatedQuestions : bankQuestions.filter((q) => selectedBankQuestions.includes(q.id)));
    if (questions.length === 0) {
      toast({ title: "Sem questões", description: "Gere ou selecione questões primeiro.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await callAPI({
        action: "create_simulado",
        title,
        description,
        topics: selectedTopics,
        faculdade_filter: faculdadeFilter && faculdadeFilter !== "all" ? faculdadeFilter : null,
        periodo_filter: periodoFilter && periodoFilter !== "all" ? parseInt(periodoFilter) : null,
        total_questions: questions.length,
        time_limit_minutes: parseInt(timeLimit),
        questions_json: questions,
        student_ids: selectedStudentIds.length > 0 ? selectedStudentIds : null,
        scheduled_at: scheduledAt || null,
        auto_assign: autoAssign,
        exam_board: examBoard !== "all" ? examBoard : null,
      });
      toast({ title: "Simulado criado!", description: `Atribuído a ${res.students_assigned} aluno(s).` });
      setShowCreate(false);
      resetForm();
      loadSimulados();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteSimulado = async (simuladoId: string, simuladoTitle: string) => {
    if (!confirm(`Tem certeza que deseja apagar o simulado "${simuladoTitle}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await callAPI({ action: "delete_simulado", simulado_id: simuladoId });
      toast({ title: "Simulado apagado", description: `"${simuladoTitle}" foi removido com sucesso.` });
      loadSimulados();
    } catch (e) {
      toast({ title: "Erro ao apagar", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    }
  };

  const viewResults = async (simulado: any) => {
    setResultsDialog({ open: true, simulado, results: [], loading: true, questions_json: [] });
    setExpandedStudent(null);
    try {
      const res = await callAPI({ action: "get_simulado_results", simulado_id: simulado.id });
      setResultsDialog((prev) => ({ ...prev, results: res.results || [], questions_json: res.questions_json || [], loading: false }));
    } catch {
      setResultsDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const resetForm = () => {
    setTitle("Simulado");
    setDescription("");
    setSelectedTopics([]);
    setSubtopics({});
    setPeriodoFilter("");
    setQuestionCount("10");
    setTimeLimit("60");
    setGeneratedQuestions([]);
    setPreviewStudents([]);
    setSelectedBankQuestions([]);
    setSelectedStudentIds([]);
    setStudentSearch("");
    setSearchResults([]);
    setQuestionMode("ai");
    setDifficulty("misto");
    setDifficultyMix({ facil: 20, intermediario: 40, dificil: 40 });
    setScheduledAt("");
    setAutoAssign(true);
    setManualStatement("");
    setManualOptions(["", "", "", "", ""]);
    setManualCorrect("0");
    setManualTopic("");
    setManualQuestions([]);
    setExpandedQuestion(null);
    setTopicDistribution({});
    setUseDistribution(false);
    setExamBoard("all");
  };

  const addManualQuestion = () => {
    if (!manualStatement.trim()) return;
    const filledOptions = manualOptions.filter((o) => o.trim());
    if (filledOptions.length < 2) return;

    setManualQuestions((prev) => [...prev, {
      statement: manualStatement.trim(),
      options: manualOptions.map((o, i) => `${String.fromCharCode(65 + i)}) ${o.trim()}`).filter((_, i) => manualOptions[i].trim()),
      correct_index: parseInt(manualCorrect),
      topic: manualTopic || selectedTopics[0] || "Geral",
      explanation: "",
    }]);
    setManualStatement("");
    setManualOptions(["", "", "", "", ""]);
    setManualCorrect("0");
    setManualTopic("");
  };

  const removeManualQuestion = (idx: number) => {
    setManualQuestions((prev) => prev.filter((_, i) => i !== idx));
  };


  const totalStudentsAssigned = simulados.reduce((s, sim) => s + (sim.results_summary?.total || 0), 0);
  const totalCompleted = simulados.reduce((s, sim) => s + (sim.results_summary?.completed || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Painel do Professor
          </h1>
          <p className="text-muted-foreground text-sm">Crie simulados, acompanhe alunos e gerencie turmas</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto gap-2">
          <Plus className="h-4 w-4" /> Novo Simulado
        </Button>
      </div>

      <Tabs defaultValue="simulados" className="w-full">
        <div className="rounded-2xl border border-border bg-card/40 p-2">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="simulados" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📝 Simulados</TabsTrigger>
            <TabsTrigger value="plantao" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">🏥 Casos Plantão</TabsTrigger>
            <TabsTrigger value="video" className="h-10 min-w-[48%] flex-1 justify-start gap-1 rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm"><Video className="h-3.5 w-3.5" /> Sala de Aula</TabsTrigger>
            <TabsTrigger value="temas" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📖 Temas</TabsTrigger>
            <TabsTrigger value="alunos" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">👤 Aluno</TabsTrigger>
            <TabsTrigger value="analytics" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📊 Turma</TabsTrigger>
            <TabsTrigger value="bi" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📈 BI</TabsTrigger>
            <TabsTrigger value="mentoria" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📋 Mentoria</TabsTrigger>
            <TabsTrigger value="osce" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">🩺 OSCE</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="simulados" className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Simulados</p>
              <p className="text-lg font-bold">{simulados.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alunos Atribuídos</p>
              <p className="text-lg font-bold">{totalStudentsAssigned}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Concluídos</p>
              <p className="text-lg font-bold">{totalCompleted}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa Conclusão</p>
              <p className="text-lg font-bold">{totalStudentsAssigned > 0 ? Math.round((totalCompleted / totalStudentsAssigned) * 100) : 0}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulados List */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : simulados.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum simulado criado</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro simulado e atribua aos alunos.</p>
            <Button onClick={() => setShowCreate(true)}>Criar Simulado</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {simulados.map((sim) => (
            <Card key={sim.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{sim.title}</h3>
                      <Badge variant={sim.status === "published" ? "default" : sim.status === "scheduled" ? "outline" : "secondary"} className={`text-[10px] ${sim.status === "scheduled" ? "border-amber-400 text-amber-600" : ""}`}>
                        {sim.status === "published" ? "Publicado" : sim.status === "scheduled" ? "⏰ Agendado" : "Rascunho"}
                      </Badge>
                      {sim.auto_assign && <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-600">Auto-atribuir</Badge>}
                    </div>
                    {sim.scheduled_at && sim.status === "scheduled" && (() => {
                      const target = new Date(sim.scheduled_at);
                      const now = new Date();
                      const diff = target.getTime() - now.getTime();
                      if (diff <= 0) return <p className="text-[10px] text-emerald-600 font-medium">Publicação iminente...</p>;
                      const hours = Math.floor(diff / 3600000);
                      const mins = Math.floor((diff % 3600000) / 60000);
                      const days = Math.floor(hours / 24);
                      return (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h ${mins}min` : `${mins}min`} para publicação
                          — {target.toLocaleDateString("pt-BR")} às {target.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      );
                    })()}
                    {sim.description && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{sim.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(sim.topics || []).slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                      {(sim.topics || []).length > 3 && <Badge variant="outline" className="text-[10px]">+{sim.topics.length - 3}</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{sim.total_questions} questões</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{sim.time_limit_minutes}min</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{sim.results_summary?.total || 0} alunos</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />{sim.results_summary?.completed || 0} concluídos</span>
                      {sim.faculdade_filter && <Badge variant="secondary" className="text-[10px]">{sim.faculdade_filter}</Badge>}
                      {sim.periodo_filter && <Badge variant="secondary" className="text-[10px]">{sim.periodo_filter}º período</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => viewResults(sim)} className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Resultados
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteSimulado(sim.id, sim.title)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {sim.results_summary?.completed > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{sim.results_summary.completed}/{sim.results_summary.total} • Média: {sim.results_summary.avgScore}%</span>
                    </div>
                    <Progress value={(sim.results_summary.completed / sim.results_summary.total) * 100} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </TabsContent>

      {/* Create Simulado Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } else setShowCreate(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Criar Simulado</DialogTitle>
            <DialogDescription>Configure o simulado, gere questões e atribua aos alunos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do simulado" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Descrição (opcional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instruções para os alunos..." rows={2} />
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Filtrar Alunos</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Faculdade</Label>
                  <Select value={faculdadeFilter} onValueChange={setFaculdadeFilter}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {FACULDADES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Período</Label>
                  <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={previewMatchingStudents} disabled={previewLoading} className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> {previewLoading ? "Buscando..." : "Ver alunos que receberão"}
              </Button>
              {previewStudents.length > 0 && (
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{selectedStudentIds.length}/{previewStudents.length} aluno(s) selecionado(s)</p>
                    <button
                      onClick={toggleAllStudents}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      {selectedStudentIds.length === previewStudents.length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {previewStudents.map((s: any) => {
                      const isSelected = selectedStudentIds.includes(s.user_id);
                      return (
                        <button
                          key={s.user_id}
                          onClick={() => toggleStudentSelection(s.user_id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/10 border border-primary/30"
                              : "bg-background/50 border border-border hover:border-primary/20"
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate font-medium">{s.display_name || s.email}</span>
                          {s.periodo && <span className="text-muted-foreground ml-auto shrink-0">{s.periodo}º</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Global student search */}
              <div className="border-t border-border pt-3 mt-2 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Ou buscar aluno específico</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchStudentGlobal()}
                    className="h-8 text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={searchStudentGlobal} disabled={searchingStudents} className="shrink-0 h-8 text-xs">
                    {searchingStudents ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {searchResults.map((s: any) => (
                      <button
                        key={s.user_id}
                        onClick={() => addSearchedStudent(s)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs bg-background/50 border border-border hover:border-primary/30 transition-colors"
                      >
                        <Plus className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate font-medium">{s.display_name || s.email}</span>
                        {s.faculdade && <span className="text-muted-foreground text-[10px] ml-auto shrink-0">{s.faculdade}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>


            <div className="space-y-3">
              <Label className="text-base font-semibold">Temas ({selectedTopics.length} selecionados)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o tema (ex: Cardiologia, Pneumologia...)"
                  value={newTopicInput}
                  onChange={(e) => setNewTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newTopicInput.trim()) {
                        const topic = newTopicInput.trim();
                        if (!selectedTopics.includes(topic)) {
                          setSelectedTopics((prev) => [...prev, topic]);
                        }
                        setNewTopicInput("");
                      }
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newTopicInput.trim()) {
                      const topic = newTopicInput.trim();
                      if (!selectedTopics.includes(topic)) {
                        setSelectedTopics((prev) => [...prev, topic]);
                      }
                      setNewTopicInput("");
                    }
                  }}
                  disabled={!newTopicInput.trim()}
                >
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => {
                      setSelectedTopics((prev) => prev.filter((t) => t !== topic));
                      setSubtopics((prev) => { const next = { ...prev }; delete next[topic]; return next; });
                    }}
                  >
                    {topic} ✕
                  </Badge>
                ))}
              </div>

              {/* Subtopics for selected topics */}
              {selectedTopics.length > 0 && (
                <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Subtemas específicos (opcional) — ex: IAM, TEP, Pré-eclâmpsia
                  </p>
                  {selectedTopics.map((topic) => (
                    <div key={topic} className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px]">{topic}</Badge>
                      <Input
                        value={subtopics[topic] || ""}
                        onChange={(e) => setSubtopics((prev) => ({ ...prev, [topic]: e.target.value }))}
                        placeholder={`Subtemas de ${topic} (separados por vírgula)`}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Topic distribution */}
              {selectedTopics.length > 1 && questionMode === "ai" && (
                <div className="space-y-2 bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <Label className="text-xs font-semibold">Distribuição por tema</Label>
                    </div>
                    <Switch checked={useDistribution} onCheckedChange={(v) => {
                      setUseDistribution(v);
                      if (v) {
                        const total = parseInt(questionCount);
                        const perTopic = Math.floor(total / selectedTopics.length);
                        const remainder = total - perTopic * selectedTopics.length;
                        const dist: Record<string, number> = {};
                        selectedTopics.forEach((t, i) => {
                          dist[t] = perTopic + (i < remainder ? 1 : 0);
                        });
                        setTopicDistribution(dist);
                      }
                    }} />
                  </div>
                  {useDistribution && (
                    <div className="space-y-1.5">
                      {selectedTopics.map((topic) => (
                        <div key={topic} className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0 text-[10px] min-w-[100px]">{topic}</Badge>
                          <Input
                            type="number"
                            min={0}
                            max={parseInt(questionCount)}
                            value={topicDistribution[topic] || 0}
                            onChange={(e) => setTopicDistribution(prev => ({ ...prev, [topic]: parseInt(e.target.value) || 0 }))}
                            className="h-7 w-20 text-xs text-center"
                          />
                          <span className="text-[10px] text-muted-foreground">questões</span>
                        </div>
                      ))}
                      {(() => {
                        const sum = Object.values(topicDistribution).reduce((a, b) => a + b, 0);
                        const target = parseInt(questionCount);
                        return sum !== target ? (
                          <p className="text-[10px] text-destructive font-medium">
                            ⚠️ Total: {sum} (esperado: {target})
                          </p>
                        ) : (
                          <p className="text-[10px] text-emerald-600 font-medium">✅ Total: {sum} questões</p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generation method */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Questões</Label>

              {/* Mode toggle */}
              <div className="flex gap-2">
                <Button
                  variant={questionMode === "ai" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuestionMode("ai")}
                  className="gap-1.5 flex-1"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
                </Button>
                <Button
                  variant={questionMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuestionMode("manual")}
                  className="gap-1.5 flex-1"
                >
                  <PenLine className="h-3.5 w-3.5" /> Criar Manual
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Quantidade (IA)</Label>
                  <Select value={questionCount} onValueChange={setQuestionCount} disabled={questionMode === "manual"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 30, 40, 50, 60, 80, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} questões</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tempo limite</Label>
                  <Select value={timeLimit} onValueChange={setTimeLimit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[30, 60, 90, 120, 180].map((m) => <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Difficulty selector */}
              {questionMode === "ai" && (
                <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-semibold">Nível de Dificuldade</Label>
                  </div>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facil">🟢 Fácil</SelectItem>
                      <SelectItem value="intermediario">🟡 Intermediário</SelectItem>
                      <SelectItem value="dificil">🔴 Difícil</SelectItem>
                      <SelectItem value="misto">🎯 Misto (personalizado)</SelectItem>
                    </SelectContent>
                  </Select>

                  {difficulty === "misto" && (
                    <div className="space-y-3">
                      {([
                        { key: "facil" as const, label: "Fácil", emoji: "🟢", color: "text-emerald-500" },
                        { key: "intermediario" as const, label: "Intermediário", emoji: "🟡", color: "text-yellow-500" },
                        { key: "dificil" as const, label: "Difícil", emoji: "🔴", color: "text-red-500" },
                      ]).map(({ key, label, emoji, color }) => (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{emoji} {label}</span>
                            <span className={`font-bold ${color}`}>{difficultyMix[key]}%</span>
                          </div>
                          <Slider
                            value={[difficultyMix[key]]}
                            min={0}
                            max={100}
                            step={5}
                            onValueChange={([val]) => {
                              const others = (["facil", "intermediario", "dificil"] as const).filter((k) => k !== key);
                              const remaining = 100 - val;
                              const otherTotal = difficultyMix[others[0]] + difficultyMix[others[1]];
                              let v0: number, v1: number;
                              if (otherTotal === 0) {
                                v0 = Math.round(remaining / 2);
                                v1 = remaining - v0;
                              } else {
                                v0 = Math.round((difficultyMix[others[0]] / otherTotal) * remaining);
                                v1 = remaining - v0;
                              }
                              setDifficultyMix({ ...difficultyMix, [key]: val, [others[0]]: v0, [others[1]]: v1 });
                            }}
                          />
                        </div>
                      ))}

                      {/* Preview */}
                      <div className="bg-secondary/50 rounded-md p-2 text-xs text-center">
                        <span className="font-medium">{questionCount} questões →</span>{" "}
                        <span className="text-emerald-500">{Math.round(parseInt(questionCount) * difficultyMix.facil / 100)} fáceis</span>,{" "}
                        <span className="text-yellow-500">{Math.round(parseInt(questionCount) * difficultyMix.intermediario / 100)} intermediárias</span>,{" "}
                        <span className="text-red-500">{parseInt(questionCount) - Math.round(parseInt(questionCount) * difficultyMix.facil / 100) - Math.round(parseInt(questionCount) * difficultyMix.intermediario / 100)} difíceis</span>
                      </div>
                    </div>
                  )}

                  {difficulty !== "misto" && (
                    <p className="text-xs text-muted-foreground">
                      Todas as {questionCount} questões serão de nível {difficulty === "facil" ? "fácil" : difficulty === "intermediario" ? "intermediário" : "difícil"}.
                    </p>
                  )}
                </div>
              )}

              {/* Banca selector */}
              {questionMode === "ai" && (
                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-semibold">Estilo de Banca</Label>
                  </div>
                  <Select value={examBoard} onValueChange={(val) => {
                    setExamBoard(val);
                    const keyMap: Record<string, string> = {
                      "ENARE": "enare", "REVALIDA": "revalida", "USP-SP": "usp",
                      "UNIFESP": "unifesp", "SUS-SP": "sus-sp", "UNICAMP": "unicamp",
                      "SANTA_CASA": "santa-casa-sp",
                    };
                    if (val !== "all") {
                      const profile = EXAM_PROFILES[keyMap[val] || "outra"];
                      if (profile?.specialtyWeights) {
                        const bancaTopics = Object.keys(profile.specialtyWeights);
                        const newTopics = bancaTopics.filter(t => !selectedTopics.includes(t));
                        if (newTopics.length > 0) {
                          setSelectedTopics(prev => [...prev, ...newTopics]);
                        }
                      }
                    } else {
                      // "Todas as bancas": add all specialties from all profiles
                      const allBancaTopics = new Set<string>();
                      Object.values(EXAM_PROFILES).forEach(profile => {
                        if (profile?.specialtyWeights) {
                          Object.keys(profile.specialtyWeights).forEach(t => allBancaTopics.add(t));
                        }
                      });
                      const newTopics = [...allBancaTopics].filter(t => !selectedTopics.includes(t));
                      if (newTopics.length > 0) {
                        setSelectedTopics(prev => [...prev, ...newTopics]);
                      }
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as bancas</SelectItem>
                      <SelectItem value="ENARE">ENARE</SelectItem>
                      <SelectItem value="REVALIDA">REVALIDA</SelectItem>
                      <SelectItem value="USP-SP">USP-SP</SelectItem>
                      <SelectItem value="UNIFESP">UNIFESP</SelectItem>
                      <SelectItem value="SUS-SP">SUS-SP</SelectItem>
                      <SelectItem value="UNICAMP">UNICAMP</SelectItem>
                      <SelectItem value="SANTA_CASA">Santa Casa SP</SelectItem>
                    </SelectContent>
                  </Select>
                  {examBoard !== "all" && (() => {
                    const keyMap: Record<string, string> = {
                      "ENARE": "enare", "REVALIDA": "revalida", "USP-SP": "usp",
                      "UNIFESP": "unifesp", "SUS-SP": "sus-sp", "UNICAMP": "unicamp",
                      "SANTA_CASA": "santa-casa-sp",
                    };
                    const profile = EXAM_PROFILES[keyMap[examBoard] || "outra"];
                    if (!profile) return null;
                    const weights = Object.entries(profile.specialtyWeights).sort((a, b) => b[1] - a[1]);
                    return (
                      <div className="space-y-1.5 mt-1">
                        <p className="text-xs font-medium text-muted-foreground">Distribuição da {examBoard}:</p>
                        <div className="flex flex-wrap gap-1">
                          {weights.map(([spec, w]) => (
                            <Badge key={spec} variant={selectedTopics.includes(spec) ? "default" : "outline"} className="text-[10px]">
                              {spec} ({w}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">
                    {examBoard === "all" ? "Questões com estilo genérico." : "Temas da banca adicionados automaticamente."}
                  </p>
                </div>
              )}

              {questionMode === "ai" && (
                <Button onClick={generateQuestionsAI} disabled={generating || selectedTopics.length === 0} className="gap-2 w-full">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? "Gerando..." : "Gerar Questões com IA"}
                </Button>
              )}

              {/* Manual question form */}
              {questionMode === "manual" && (
                <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/20">
                  <div className="space-y-2">
                    <Label className="text-xs">Enunciado / Caso Clínico</Label>
                    <Textarea
                      value={manualStatement}
                      onChange={(e) => setManualStatement(e.target.value)}
                      placeholder="Paciente de 55 anos, hipertenso, apresenta dor precordial..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Alternativas</Label>
                    {["A", "B", "C", "D", "E"].map((letter, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                          manualCorrect === String(i) ? "bg-primary text-primary-foreground border-primary" : "border-border"
                        }`}>
                          {letter}
                        </span>
                        <Input
                          value={manualOptions[i]}
                          onChange={(e) => {
                            const copy = [...manualOptions];
                            copy[i] = e.target.value;
                            setManualOptions(copy);
                          }}
                          placeholder={`Alternativa ${letter}`}
                          className="flex-1 h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Gabarito (resposta correta)</Label>
                      <Select value={manualCorrect} onValueChange={setManualCorrect}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["A", "B", "C", "D", "E"].map((l, i) => (
                            <SelectItem key={i} value={String(i)}>Alternativa {l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tema</Label>
                      <Input
                        value={manualTopic}
                        onChange={(e) => setManualTopic(e.target.value)}
                        placeholder="Digite o tema (ex: Cardiologia)"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={addManualQuestion}
                    disabled={!manualStatement.trim() || manualOptions.filter((o) => o.trim()).length < 2}
                    variant="secondary"
                    className="w-full gap-1.5"
                    size="sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Questão
                  </Button>
                </div>
              )}
            </div>

            {/* Generated / manual questions preview */}
            {(questionMode === "ai" ? generatedQuestions : manualQuestions).length > 0 && (() => {
              const allQs = questionMode === "ai" ? generatedQuestions : manualQuestions;
              const target = parseInt(questionCount);
              const deficit = questionMode === "ai" ? target - allQs.length : 0;
              const grouped = allQs.reduce<Record<string, typeof allQs>>((acc, q) => {
                const block = q.block || q.topic || "Geral";
                if (!acc[block]) acc[block] = [];
                acc[block].push(q);
                return acc;
              }, {});
              const blocks = Object.entries(grouped);
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-primary">
                      ✅ {allQs.length}/{target} questão(ões) {questionMode === "ai" ? "geradas" : "criadas"} {blocks.length > 1 ? `em ${blocks.length} blocos` : ""}
                    </Label>
                    {deficit > 0 && questionMode === "ai" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={regenerateMissing}
                        disabled={generating}
                        className="gap-1.5 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Regenerar {deficit} faltantes
                      </Button>
                    )}
                  </div>
                  {deficit > 0 && questionMode === "ai" && (
                    <p className="text-[11px] text-amber-600">⚠️ {deficit} questão(ões) excluída(s). Clique em "Regenerar" para completar.</p>
                  )}
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {blocks.map(([block, questions]) => (
                      <div key={block}>
                        {blocks.length > 1 && (
                          <div className="flex items-center gap-2 py-1.5 px-2 bg-primary/10 rounded-md mb-1.5">
                            <span className="text-xs font-semibold text-primary">📋 Bloco: {block} — {questions.length} questão(ões)</span>
                          </div>
                        )}
                        {questions.map((q) => {
                          const globalIdx = allQs.indexOf(q);
                          const isExpanded = expandedQuestion === globalIdx;
                          return (
                            <div key={globalIdx} className={`bg-secondary/50 rounded-lg text-xs transition-all ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}>
                              <div
                                className="p-3 flex items-start justify-between gap-2 cursor-pointer hover:bg-secondary/80 rounded-lg"
                                onClick={() => setExpandedQuestion(isExpanded ? null : globalIdx)}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium mb-1">Q{globalIdx + 1}: {q.statement?.slice(0, 120)}{q.statement?.length > 120 ? '...' : ''}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant="outline" className="text-[9px]">{q.topic || block}</Badge>
                                    {q.difficulty_level && (
                                      <Badge className={`text-[9px] ${
                                        q.difficulty_level === "facil" ? "bg-emerald-500/20 text-emerald-700 border-emerald-300" :
                                        q.difficulty_level === "dificil" ? "bg-red-500/20 text-red-700 border-red-300" :
                                        "bg-yellow-500/20 text-yellow-700 border-yellow-300"
                                      }`} variant="outline">
                                        {q.difficulty_level === "facil" ? "🟢 Fácil" : q.difficulty_level === "dificil" ? "🔴 Difícil" : "🟡 Intermediário"}
                                      </Badge>
                                    )}
                                    <span className="text-muted-foreground">Gabarito: {String.fromCharCode(65 + q.correct_index)}</span>
                                    {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (questionMode === "manual") removeManualQuestion(globalIdx);
                                    else removeGeneratedQuestion(globalIdx);
                                    if (expandedQuestion === globalIdx) setExpandedQuestion(null);
                                  }}
                                  className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-destructive/10"
                                  title="Excluir questão"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{q.statement}</p>
                                  {Array.isArray(q.options) && q.options.length > 0 && (
                                    <div className="space-y-1">
                                      {q.options.map((opt: string, oi: number) => (
                                        <div
                                          key={oi}
                                          className={`px-2 py-1.5 rounded text-xs ${
                                            oi === q.correct_index
                                              ? 'bg-emerald-500/15 text-emerald-800 font-semibold border border-emerald-300'
                                              : 'bg-muted/50'
                                          }`}
                                        >
                                          {opt}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {q.explanation && (
                                    <div className="bg-primary/5 rounded p-2 text-[11px] text-muted-foreground">
                                      <span className="font-semibold">Explicação:</span> {q.explanation}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Scheduling */}
          <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">Agendamento</Label>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Data e hora de publicação (deixe vazio para publicar agora)</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9"
              />
              {scheduledAt && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  O simulado ficará disponível em {new Date(scheduledAt).toLocaleDateString("pt-BR")} às {new Date(scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Auto-atribuir novos alunos</Label>
                <p className="text-[10px] text-muted-foreground">Alunos que se cadastrarem depois serão incluídos automaticamente</p>
              </div>
              <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={createSimulado}
              disabled={creating || generating || (questionMode === "ai" ? (generatedQuestions.length === 0 || generatedQuestions.length < parseInt(questionCount)) : manualQuestions.length === 0)}
              className="gap-2"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {creating ? "Criando..." : scheduledAt ? "Agendar e Atribuir" : "Criar e Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={resultsDialog.open} onOpenChange={(open) => !open && setResultsDialog({ open: false, simulado: null, results: [], loading: false, questions_json: [] })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Resultados: {resultsDialog.simulado?.title}
            </DialogTitle>
            <DialogDescription>Veja o desempenho dos alunos neste simulado.</DialogDescription>
          </DialogHeader>

          {resultsDialog.loading ? (
            <div className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : resultsDialog.results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum resultado ainda.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{resultsDialog.results.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Concluídos</p>
                    <p className="text-lg font-bold text-emerald-500">{resultsDialog.results.filter((r) => r.status === "completed").length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Média</p>
                    <p className="text-lg font-bold text-primary">
                      {(() => {
                        const completed = resultsDialog.results.filter((r) => r.status === "completed");
                        return completed.length > 0 ? Math.round(completed.reduce((s, r) => s + (r.score || 0), 0) / completed.length) : 0;
                      })()}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {resultsDialog.results.map((r) => {
                const isExpanded = expandedStudent === r.id;
                const studentAnswers = (r.answers_json || []) as any[];
                const questionsData = resultsDialog.questions_json || [];
                return (
                  <Card key={r.id}>
                    <CardContent className="p-3">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedStudent(isExpanded ? null : r.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          <div>
                            <p className="text-sm font-medium">{r.student_name}</p>
                            <p className="text-xs text-muted-foreground">{r.student_email}{r.faculdade ? ` • ${r.faculdade}` : ""}{r.periodo ? ` • ${r.periodo}º` : ""}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {r.status === "completed" ? (
                            <>
                              <p className={`text-lg font-bold ${(r.score || 0) >= 70 ? "text-emerald-500" : (r.score || 0) >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                {Math.round(r.score || 0)}%
                              </p>
                              <p className="text-[10px] text-muted-foreground">{r.finished_at ? new Date(r.finished_at).toLocaleDateString("pt-BR") : ""}</p>
                            </>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {r.status === "in_progress" ? "Em andamento" : "Pendente"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {isExpanded && r.status === "completed" && studentAnswers.length > 0 && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          {/* Topic summary */}
                          {(() => {
                            const topicMap: Record<string, { total: number; correct: number }> = {};
                            studentAnswers.forEach((a: any) => {
                              const t = a.topic || "Geral";
                              if (!topicMap[t]) topicMap[t] = { total: 0, correct: 0 };
                              topicMap[t].total++;
                              if (a.is_correct) topicMap[t].correct++;
                            });
                            return (
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground">Por Tema:</p>
                                {Object.entries(topicMap).map(([topic, data]) => {
                                  const pct = Math.round((data.correct / data.total) * 100);
                                  return (
                                    <div key={topic} className="flex items-center gap-2 text-xs">
                                      <span className="w-28 truncate font-medium">{topic}</span>
                                      <Progress value={pct} className="h-1.5 flex-1" />
                                      <span className={`w-16 text-right font-bold ${pct >= 70 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                        {data.correct}/{data.total} ({pct}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Question-by-question */}
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            <p className="text-xs font-semibold text-muted-foreground">Questões:</p>
                            {studentAnswers.map((a: any, idx: number) => {
                              const q = questionsData[a.question_index ?? idx];
                              return (
                                <div key={idx} className={`p-2 rounded text-xs border ${a.is_correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"}`}>
                                  <div className="flex items-start gap-1.5">
                                    <Badge variant={a.is_correct ? "default" : "destructive"} className="text-[9px] shrink-0 mt-0.5">
                                      {a.is_correct ? "✓" : "✗"} Q{(a.question_index ?? idx) + 1}
                                    </Badge>
                                    <p className="line-clamp-2">{q?.statement || `Questão ${idx + 1}`}</p>
                                  </div>
                                  {!a.is_correct && q && (
                                    <div className="ml-6 mt-1 space-y-0.5 text-[11px]">
                                      <p className="text-destructive">Resposta: {q.options?.[a.selected] || "Não respondida"}</p>
                                      <p className="text-emerald-600">Correta: {q.options?.[a.correct_index ?? q.correct_index]}</p>
                                      {q.explanation && <p className="text-muted-foreground italic mt-1">{q.explanation}</p>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

        <TabsContent value="plantao" className="mt-4">
          <ProfessorPlantao />
        </TabsContent>

        <TabsContent value="temas" className="mt-4">
          <TeacherStudyAssignments />
        </TabsContent>

        <TabsContent value="video" className="mt-4">
          <VideoRoom />
        </TabsContent>

        <TabsContent value="alunos" className="mt-4">
          <StudentTracker />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <ClassAnalytics />
        </TabsContent>

        <TabsContent value="bi" className="mt-4">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
            <ProfessorBIPanel callAPI={callAPI} />
          </Suspense>
        </TabsContent>

        <TabsContent value="mentoria" className="mt-4">
          <MentorThemePlans />
        </TabsContent>

        <TabsContent value="osce" className="mt-4">
          <ProfessorPracticalExams />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfessorDashboard;
