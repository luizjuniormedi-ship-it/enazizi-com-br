import { useCallback, useEffect, useMemo, useState } from "react";
import { EXAM_PROFILES } from "@/lib/examProfiles";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallAPI = (body: Record<string, unknown>) => Promise<any>;

interface Args {
  open: boolean;
  callAPI: CallAPI;
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
}

/**
 * Centraliza TODO o estado e lógica do CreateSimuladoDialog.
 * O dialog vira um orquestrador puro de UI.
 *
 * Estado é desmontado naturalmente quando o dialog fecha.
 */
export function useCreateSimuladoForm({ open, callAPI, onCreated, onOpenChange, initialData }: Args) {
  const { toast } = useToast();

  const safeAction = useCallback(async (name: string, fn: () => Promise<void>) => {
    try {
      console.log(`[useCreateSimuladoForm] action_start: ${name}`);
      await fn();
      console.log(`[useCreateSimuladoForm] action_success: ${name}`);
    } catch (error) {
      console.error(`[useCreateSimuladoForm] action_failed: ${name}`, error);
      toast({
        title: "Erro na operação",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Estado de criação/geração
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  // UI Control
  const [showConfirm, setShowConfirm] = useState(false);
  const [impactedCount, setImpactedCount] = useState<number | null>(null);
  const [traceId, setTraceId] = useState("");
  const [successData, setSuccessData] = useState<{
    simulado_id: string;
    students_assigned: number;
    warnings?: string[];
    status: string;
  } | null>(null);

  // Form básico
  const [title, setTitle] = useState("Simulado");
  const [description, setDescription] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [subtopics, setSubtopics] = useState<Record<string, string>>({});
  const [faculdadeFilters, setFaculdadeFilters] = useState<string[]>([]);
  const [periodoFilters, setPeriodoFilters] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState("10");
  const [timeLimit, setTimeLimit] = useState("60");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [questionMode, setQuestionMode] = useState<"ai" | "manual">("ai");
  const [difficulty, setDifficulty] = useState("misto");
  const [difficultyMix, setDifficultyMix] = useState({ facil: 20, intermediario: 40, dificil: 40 });
  const [scheduledAt, setScheduledAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [feedbackPolicy, setFeedbackPolicy] = useState<"immediate" | "after_deadline" | "manual">("immediate");
  const [allowRetake, setAllowRetake] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [examBoard, setExamBoard] = useState("all");

  // Manual question form
  const [manualStatement, setManualStatement] = useState("");
  const [manualOptions, setManualOptions] = useState(["", "", "", "", ""]);
  const [manualCorrect, setManualCorrect] = useState("0");
  const [manualTopic, setManualTopic] = useState("");
  const [manualQuestions, setManualQuestions] = useState<any[]>([]);

  // Bank questions (compat — useAI sempre true neste fluxo)
  const useAI = true;
  const [bankQuestions] = useState<any[]>([]);
  const [selectedBankQuestions] = useState<string[]>([]);

  // Alunos
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedProfessorTurmaIds, setSelectedProfessorTurmaIds] = useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<"filter" | "classes" | "professor_turmas" | "manual" | "all">("filter");
  const [studentPagination, setStudentPagination] = useState({ offset: 0, total: 0, hasMore: false });
  const [selectedStudentsData, setSelectedStudentsData] = useState<any[]>([]);

  // UI auxiliar
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [topicDistribution, setTopicDistribution] = useState<Record<string, number>>({});
  const [useDistribution, setUseDistribution] = useState(false);

  const allExamTopics = useMemo(() => {
    const topics = new Set<string>();
    Object.values(EXAM_PROFILES).forEach((profile) => {
      Object.keys(profile.specialtyWeights || {}).forEach((topic) => topics.add(topic));
    });
    return [...topics];
  }, []);

  // Auto-preencher temas quando "Todas as bancas"
  useEffect(() => {
    if (!open || questionMode !== "ai" || examBoard !== "all") return;
    setSelectedTopics((prev) => (prev.length > 0 ? prev : allExamTopics));
  }, [allExamTopics, examBoard, questionMode, open]);

  // Reset successData or initialize on open
  useEffect(() => {
    if (open) {
      setSuccessData(null);
      setShowConfirm(false);
      
      if (initialData) {
        setTitle(initialData.title || "Simulado");
        setDescription(initialData.description || "");
        if (initialData.total_questions) setQuestionCount(String(initialData.total_questions));
        if (initialData.time_limit_minutes) setTimeLimit(String(initialData.time_limit_minutes));
        if (initialData.topics) setSelectedTopics(initialData.topics);
        if (initialData.exam_board) setExamBoard(initialData.exam_board);
        
        const formatForInput = (iso?: string) => {
          if (!iso) return "";
          try {
            const date = new Date(iso);
            // Ajustar para o fuso local para o input datetime-local que não entende Z
            const tzOffset = date.getTimezoneOffset() * 60000;
            const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
            return localISOTime;
          } catch (e) {
            console.error("Erro ao formatar data:", iso, e);
            return "";
          }
        };

        if (initialData.scheduled_at) setScheduledAt(formatForInput(initialData.scheduled_at));
        if (initialData.end_at) setEndAt(formatForInput(initialData.end_at));
        if (initialData.max_attempts) setMaxAttempts(String(initialData.max_attempts));
        if (initialData.feedback_policy) setFeedbackPolicy(initialData.feedback_policy);
        if (initialData.allow_retake !== undefined) setAllowRetake(initialData.allow_retake);
        
        if (Array.isArray(initialData.questions_json) && initialData.questions_json.length > 0) {
          setGeneratedQuestions(initialData.questions_json);
          setQuestionMode("ai");
        }
        
        if (initialData.faculdade_filters) setFaculdadeFilters(initialData.faculdade_filters);
        if (initialData.periodo_filters) setPeriodoFilters(initialData.periodo_filters.map((p: any) => String(p)));
      } else {
        setTitle("Simulado");
        setDescription("");
        setQuestionCount("10");
        setTimeLimit("60");
        setGeneratedQuestions([]);
        setManualQuestions([]);
      }
    }
  }, [open, initialData]);

  // ============ Handlers de Alunos ============
  const previewMatchingStudents = useCallback(async (isLoadMore = false) => {
    setPreviewLoading(true);
    const limit = 25;
    const offset = isLoadMore ? studentPagination.offset + limit : 0;
    
    try {
      const res = await callAPI({
        action: "get_students",
        faculdades: faculdadeFilters.length > 0 ? faculdadeFilters : undefined,
        periodos: periodoFilters.length > 0 ? periodoFilters : undefined,
        query: studentSearch.length >= 3 ? studentSearch : undefined,
        limit,
        offset
      });
      
      const students = res.students || [];
      const total = res.total || 0;
      
      setPreviewStudents(prev => isLoadMore ? [...prev, ...students] : students);
      // Auto-seleciona todos os alunos retornados — professor desmarca os que não devem participar
      const newIds = students.map((s: any) => s.user_id).filter(Boolean);
      setSelectedStudentIds(prev => {
        if (isLoadMore) {
          const merged = new Set([...prev, ...newIds]);
          return Array.from(merged);
        }
        return newIds;
      });
      setStudentPagination({
        offset,
        total,
        hasMore: offset + limit < total
      });
    } catch (error) {
      console.error("Error fetching students:", error);
      if (!isLoadMore) setPreviewStudents([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [callAPI, faculdadeFilters, periodoFilters, studentSearch, studentPagination.offset]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentSearch.length === 0 || studentSearch.length >= 3) {
        previewMatchingStudents();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [studentSearch, faculdadeFilters, periodoFilters]);

  const searchStudentGlobal = useCallback(async (isLoadMore = false) => {
    if (studentSearch.length < 3) {
      toast({ title: "Digite pelo menos 3 caracteres", variant: "destructive" });
      return;
    }
    setSearchingStudents(true);
    const limit = 25;
    const offset = isLoadMore ? studentPagination.offset + limit : 0;

    try {
      const res = await callAPI({ 
        action: "search_students", 
        query: studentSearch,
        limit,
        offset
      });
      
      const students = (res.students || []).filter((s: any) => !previewStudents.some((p: any) => p.user_id === s.user_id));
      const total = res.total || 0;
      
      setSearchResults(prev => isLoadMore ? [...prev, ...students] : students);
      setStudentPagination({
        offset,
        total,
        hasMore: offset + limit < total
      });
    } catch {
      if (!isLoadMore) setSearchResults([]);
    } finally {
      setSearchingStudents(false);
    }
  }, [callAPI, studentSearch, previewStudents, toast, studentPagination.offset]);

  const addSearchedStudent = useCallback((student: any) => {
    setPreviewStudents((prev) =>
      prev.some((s: any) => s.user_id === student.user_id) ? prev : [...prev, student]
    );
    setSelectedStudentIds((prev) => (prev.includes(student.user_id) ? prev : [...prev, student.user_id]));
    setSelectedStudentsData(prev => 
      prev.some(s => s.user_id === student.user_id) ? prev : [...prev, student]
    );
    setSearchResults((prev) => prev.filter((s: any) => s.user_id !== student.user_id));
  }, []);

  const toggleStudentSelection = useCallback((student: any) => {
    const userId = student.user_id;
    setSelectedStudentIds((prev) => {
      const isSelected = prev.includes(userId);
      if (isSelected) {
        setSelectedStudentsData(data => data.filter(s => s.user_id !== userId));
        return prev.filter((id) => id !== userId);
      } else {
        setSelectedStudentsData(data => [...data, student]);
        return [...prev, userId];
      }
    });
  }, []);

  const toggleAllStudents = useCallback(() => {
    if (selectedStudentIds.length === previewStudents.length) {
      // Unselect only those in current preview
      const previewIds = previewStudents.map(s => s.user_id);
      setSelectedStudentIds(prev => prev.filter(id => !previewIds.includes(id)));
      setSelectedStudentsData(prev => prev.filter(s => !previewIds.includes(s.user_id)));
    } else {
      // Select all in current preview
      const newStudents = previewStudents.filter(s => !selectedStudentIds.includes(s.user_id));
      setSelectedStudentIds(prev => [...prev, ...newStudents.map(s => s.user_id)]);
      setSelectedStudentsData(prev => [...prev, ...newStudents]);
    }
  }, [previewStudents, selectedStudentIds]);

  const clearStudentSelection = useCallback(() => {
    setSelectedStudentIds([]);
    setSelectedStudentsData([]);
  }, []);

  const removeSelectedStudent = useCallback((userId: string) => {
    setSelectedStudentIds(prev => prev.filter(id => id !== userId));
    setSelectedStudentsData(prev => prev.filter(s => s.user_id !== userId));
  }, []);

  // ============ Handlers de Temas ============
  const addTopic = useCallback(() => {
    const t = newTopicInput.trim();
    if (!t) return;
    setSelectedTopics((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setNewTopicInput("");
  }, [newTopicInput]);

  const removeTopic = useCallback((topic: string) => {
    setSelectedTopics((prev) => prev.filter((t) => t !== topic));
    setSubtopics((prev) => {
      const next = { ...prev };
      delete next[topic];
      return next;
    });
  }, []);

  const setSubtopicFor = useCallback((topic: string, value: string) => {
    setSubtopics((prev) => ({ ...prev, [topic]: value }));
  }, []);

  const toggleDistribution = useCallback(
    (v: boolean) => {
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
    },
    [questionCount, selectedTopics]
  );

  const updateTopicDistribution = useCallback((topic: string, value: number) => {
    setTopicDistribution((prev) => ({ ...prev, [topic]: value }));
  }, []);

  // ============ Banca ============
  const handleExamBoardChange = useCallback(
    (val: string) => {
      setExamBoard(val);
      const keyMap: Record<string, string> = {
        ENARE: "enare",
        REVALIDA: "revalida",
        "USP-SP": "usp",
        UNIFESP: "unifesp",
        "SUS-SP": "sus-sp",
        UNICAMP: "unicamp",
        SANTA_CASA: "santa-casa-sp",
      };
      if (val !== "all") {
        const profile = EXAM_PROFILES[keyMap[val] || "outra"];
        if (profile?.specialtyWeights) {
          const bancaTopics = Object.keys(profile.specialtyWeights);
          setSelectedTopics((prev) => {
            const newOnes = bancaTopics.filter((t) => !prev.includes(t));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
      } else {
        const allBancaTopics = new Set<string>();
        Object.values(EXAM_PROFILES).forEach((profile) => {
          if (profile?.specialtyWeights) {
            Object.keys(profile.specialtyWeights).forEach((t) => allBancaTopics.add(t));
          }
        });
        setSelectedTopics((prev) => {
          const newOnes = [...allBancaTopics].filter((t) => !prev.includes(t));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
    },
    []
  );

  // ============ Dificuldade ============
  const updateDifficultyMix = useCallback(
    (key: "facil" | "intermediario" | "dificil", val: number) => {
      setDifficultyMix((prev) => {
        const others = (["facil", "intermediario", "dificil"] as const).filter((k) => k !== key);
        const remaining = 100 - val;
        const otherTotal = prev[others[0]] + prev[others[1]];
        let v0: number, v1: number;
        if (otherTotal === 0) {
          v0 = Math.round(remaining / 2);
          v1 = remaining - v0;
        } else {
          v0 = Math.round((prev[others[0]] / otherTotal) * remaining);
          v1 = remaining - v0;
        }
        return { ...prev, [key]: val, [others[0]]: v0, [others[1]]: v1 };
      });
    },
    []
  );

  // ============ Questões ============
  const removeGeneratedQuestion = useCallback((idx: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const removeManualQuestion = useCallback((idx: number) => {
    setManualQuestions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const generateQuestionsAI = useCallback(async () => {
    await safeAction("generate_questions_ai", async () => {
      if (selectedTopics.length === 0) {
        toast({
          title: "Selecione temas",
          description: "Escolha pelo menos um tema para gerar questões.",
          variant: "destructive",
        });
        return;
      }
      setGenerating(true);
      setGeneratedQuestions([]);
      setExpandedQuestion(null);
      try {
      const total = parseInt(questionCount);
      let allQuestions: any[] = [];

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

            toast({
              title: `${topic}: lote ${b + 1}/${batches}`,
              description: `${allQuestions.length + topicQuestions.length}/${total} questões prontas`,
            });

            const previousStatements = [...allQuestions, ...topicQuestions].map((q: any) =>
              String(q.statement || "").slice(0, 120)
            );

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
                toast({
                  title: "📦 Questões do banco",
                  description: "Todas as questões vieram do banco existente (sem custo de IA).",
                });
              } else if (res.source === "mixed") {
                toast({
                  title: "🔄 Questões mistas",
                  description: "Parte do banco existente + parte gerada por IA.",
                });
              } else if (res.source === "bank") {
                toast({
                  title: "📦 Questões do banco",
                  description: "A IA não respondeu, usamos questões do banco existente.",
                });
              }
              topicQuestions = [...topicQuestions, ...(res.questions || [])];
            } catch (batchErr) {
              console.error(`Batch ${b + 1} for ${topic} failed:`, batchErr);
              toast({
                title: `Erro no lote ${b + 1} de ${topic}`,
                description: "Continuando com os próximos...",
                variant: "destructive",
              });
            }
          }
          allQuestions = [...allQuestions, ...topicQuestions];
          setGeneratedQuestions([...allQuestions]);
        }
      } else {
        const topicsWithSubs = selectedTopics.map((t) => {
          const subs = subtopics[t]?.trim();
          return subs ? `${t} (${subs})` : t;
        });
        const FRONTEND_BATCH = 10;
        const batches = Math.ceil(total / FRONTEND_BATCH);

        for (let b = 0; b < batches; b++) {
          const batchCount = Math.min(FRONTEND_BATCH, total - allQuestions.length);
          if (batchCount <= 0) break;

          toast({
            title: `Gerando lote ${b + 1}/${batches}...`,
            description: `${allQuestions.length}/${total} questões prontas`,
          });

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
              toast({
                title: "📦 Questões do banco",
                description: "Todas as questões vieram do banco existente (sem custo de IA).",
              });
            } else if (res.source === "mixed") {
              toast({
                title: "🔄 Questões mistas",
                description: "Parte do banco existente + parte gerada por IA.",
              });
            } else if (res.source === "bank") {
              toast({
                title: "📦 Questões do banco",
                description: "A IA não respondeu, usamos questões do banco existente.",
              });
            }
            const batchQ = res.questions || [];
            allQuestions = [...allQuestions, ...batchQ];
            setGeneratedQuestions([...allQuestions]);
          } catch (batchErr) {
            console.error(`Batch ${b + 1} failed:`, batchErr);
            toast({
              title: `Erro no lote ${b + 1}`,
              description: "Continuando com os próximos...",
              variant: "destructive",
            });
          }
        }
      }

      const target = total;
      for (let fill = 0; fill < 4 && allQuestions.length < target; fill++) {
        const deficit = target - allQuestions.length;
        toast({
          title: `Completando déficit...`,
          description: `Faltam ${deficit} questões (tentativa ${fill + 1})`,
        });
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
        } catch {
          break;
        }
      }

      toast({ title: "Questões geradas!", description: `${allQuestions.length} questões criadas.` });
    } catch (e: any) {
      toast({
        title: "Erro na geração",
        description: e instanceof Error ? e.message : "Erro ao gerar questões.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
    });
  }, [
    callAPI, toast, selectedTopics, questionCount, useDistribution, topicDistribution,
    subtopics, difficulty, difficultyMix, examBoard, safeAction
  ]);

  const regenerateMissing = useCallback(async () => {
    const target = parseInt(questionCount);
    const currentQuestions = [...generatedQuestions];
    const deficit = target - currentQuestions.length;
    if (deficit <= 0) return;
    setGenerating(true);
    try {
      const topicsWithSubs = selectedTopics.map((t) => {
        const subs = subtopics[t]?.trim();
        return subs ? `${t} (${subs})` : t;
      });
      const previousStatements = currentQuestions.map((q: any) =>
        String(q.statement || "").slice(0, 120)
      );

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
      const merged = [...currentQuestions, ...newQs];
      setGeneratedQuestions(merged);
      toast({
        title: "Pronto!",
        description: `${newQs.length} questões regeneradas. Total: ${merged.length}/${target}`,
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao regenerar",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [callAPI, toast, questionCount, generatedQuestions, selectedTopics, subtopics, difficulty, difficultyMix]);

  const addManualQuestion = useCallback(() => {
    if (!manualStatement.trim()) return;
    const filledOptions = manualOptions.filter((o) => o.trim());
    if (filledOptions.length < 2) return;

    setManualQuestions((prev) => [
      ...prev,
      {
        statement: manualStatement.trim(),
        options: manualOptions
          .map((o, i) => `${String.fromCharCode(65 + i)}) ${o.trim()}`)
          .filter((_, i) => manualOptions[i].trim()),
        correct_index: parseInt(manualCorrect),
        topic: manualTopic || selectedTopics[0] || "Geral",
        explanation: "",
      },
    ]);
    setManualStatement("");
    setManualOptions(["", "", "", "", ""]);
    setManualCorrect("0");
    setManualTopic("");
  }, [manualStatement, manualOptions, manualCorrect, manualTopic, selectedTopics]);

  const updateManualOption = useCallback((i: number, value: string) => {
    setManualOptions((prev) => {
      const copy = [...prev];
      copy[i] = value;
      return copy;
    });
  }, []);

  const confirmCreate = useCallback(async (forcedStatus?: "draft" | "published") => {
    await safeAction("confirm_create", async () => {
      if (creating) return;
      
      if (!title?.trim()) {
        toast({ title: "Título obrigatório", description: "Informe um título para o simulado.", variant: "destructive" });
        return;
      }

      setCreating(true);
      const tid = crypto.randomUUID();
      setTraceId(tid);
      const clientRequestId = crypto.randomUUID();
      
      try {
      const questions = questionMode === "manual" ? manualQuestions : generatedQuestions;
      const isDraft = forcedStatus === "draft";
      
      // Bloquear publicação sem questões, mas permitir rascunho
      if (!isDraft && questions.length === 0) {
        toast({ title: "Sem questões", description: "Adicione questões antes de publicar ou salve como rascunho.", variant: "destructive" });
        setCreating(false);
        return;
      }

      const payload = {
        action: initialData?.id ? "update_simulado" : "create_simulado",
        id: initialData?.id,
        title: title.trim(),
        description: description || null,
        topics: selectedTopics || [],
        faculdade_filters: faculdadeFilters,
        periodo_filters: periodoFilters.map(p => parseInt(p)),
        total_questions: questions.length,
        time_limit_minutes: parseInt(timeLimit) || 60,
        questions_json: questions,
        student_ids: assignmentMode === "manual" ? (selectedStudentIds || []) : null,
        class_ids: assignmentMode === "classes" ? (selectedClassIds || []) : null,
        professor_turma_ids: assignmentMode === "professor_turmas" ? (selectedProfessorTurmaIds || []) : null,
        assignment_mode: assignmentMode || "all",
        scheduled_at: scheduledAt || null,
        end_at: endAt || null,
        max_attempts: parseInt(maxAttempts) || 1,
        feedback_policy: feedbackPolicy || "immediate",
        allow_retake: !!allowRetake,
        auto_assign: !!autoAssign,
        exam_board: examBoard !== "all" ? examBoard : null,
        trace_id: tid,
        client_request_id: clientRequestId,
        status: forcedStatus || (scheduledAt ? "scheduled" : "published")
      };

      console.log(`[Trace:${tid}] Criando simulado...`, payload);
      const res = await callAPI(payload);
      
      if (res && res.success === false) {
        throw new Error(res.message || "Erro retornado pelo servidor.");
      }

      setSuccessData({
        simulado_id: res.simulado_id,
        students_assigned: res.students_assigned || 0,
        warnings: res.warnings,
        status: res.status
      });

      if (res.warnings && res.warnings.length > 0) {
        toast({
          title: "Simulado criado com avisos",
          description: "O simulado foi criado, mas houve problemas em etapas secundárias.",
          variant: "warning" as any
        });
      } else {
        toast({ 
          title: isDraft ? "Rascunho salvo!" : "Simulado criado!", 
          variant: "default"
        });
      }
      
      onCreated();
    } catch (e: any) {
      console.error(`[Trace:${tid}] Erro ao criar simulado:`, e);
      const errorMsg = e instanceof Error ? e.message : "Erro inesperado ao salvar o simulado.";
      toast({
        title: "Erro ao criar simulado",
        description: (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm opacity-90">{errorMsg}</p>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <code className="text-[11px] font-mono font-bold text-primary truncate">TRACE-{tid.split('-')[0].toUpperCase()}</code>
              <Button 
                variant="ghost" size="sm" className="h-7 px-2 hover:bg-white/10"
                onClick={() => {
                  navigator.clipboard.writeText(tid);
                  toast({ title: "Copiado!" });
                }}
              >
                <Copy className="h-3 w-3 mr-1.5" />
                <span className="text-[10px] font-bold">COPIAR</span>
              </Button>
            </div>
          </div>
        ),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
    });
  }, [
    creating, callAPI, toast, onCreated, questionMode, manualQuestions, generatedQuestions,
    title, description, selectedTopics, faculdadeFilters, impactedCount,
    periodoFilters, timeLimit, selectedStudentIds, selectedClassIds, selectedProfessorTurmaIds, assignmentMode,
    scheduledAt, endAt, maxAttempts, feedbackPolicy, allowRetake, autoAssign, examBoard, safeAction
  ]);

  const initiateCreate = useCallback(async () => {
    await safeAction("initiate_create", async () => {
      if (!title?.trim()) {
        toast({ title: "Título obrigatório", description: "Informe um título para o simulado.", variant: "destructive" });
        return;
      }

      const questions = questionMode === "manual" ? manualQuestions : generatedQuestions;
      if (!questions || questions.length === 0) {
        toast({ title: "Sem questões", description: "Gere questões primeiro ou salve como rascunho.", variant: "destructive" });
        return;
      }

      if (assignmentMode === "manual" && selectedStudentIds.length === 0) {
        toast({ title: "Nenhum aluno selecionado", description: "Selecione alunos ou mude o modo de atribuição.", variant: "destructive" });
        return;
      }

      if (assignmentMode === "all") {
        const confirmed = window.confirm("ATENÇÃO: Este simulado será visível para TODOS os alunos da plataforma. Confirmar?");
        if (!confirmed) return;
      }

      setCreating(true);
      try {
        let count = 0;
        if (assignmentMode === "manual") count = selectedStudentIds.length;
        else if (assignmentMode === "all") {
          const { data } = await callAPI({ action: "get_students_count" });
          count = data?.count || 0;
        } else if (assignmentMode === "classes") {
          const { data } = await callAPI({ action: "get_students_count", class_ids: selectedClassIds });
          count = data?.count || 0;
        } else {
          const { data } = await callAPI({ 
            action: "get_students_count", 
            faculdades: faculdadeFilters.length > 0 ? faculdadeFilters : undefined,
            periodos: periodoFilters.length > 0 ? periodoFilters : undefined,
          });
          count = data?.count || 0;
        }

        if (count === 0) {
          if (assignmentMode === "filter") {
            const confirmed = window.confirm("AVISO: Nenhum aluno atende a estes filtros no momento. O simulado será criado mas ficará visível apenas quando novos alunos entrarem nestes critérios. Continuar?");
            if (!confirmed) return;
          } else {
            toast({ title: "Público vazio", description: "Nenhum aluno foi encontrado com os critérios selecionados.", variant: "destructive" });
            return;
          }
        }

        setImpactedCount(count);
        setShowConfirm(true);
      } catch (err: any) {
        toast({ title: "Erro ao validar público", description: err.message, variant: "destructive" });
      } finally {
        setCreating(false);
      }
    });
  }, [title, questionMode, manualQuestions, generatedQuestions, assignmentMode, selectedStudentIds, selectedClassIds, faculdadeFilters, periodoFilters, callAPI, toast, safeAction]);


  const allQs = useMemo(() => {
    const questions = questionMode === "ai" ? generatedQuestions : manualQuestions;
    return Array.isArray(questions) ? questions : [];
  }, [questionMode, generatedQuestions, manualQuestions]);

  const target = useMemo(() => parseInt(questionCount || "0") || 0, [questionCount]);
  const deficit = useMemo(() => (questionMode === "ai" ? Math.max(0, target - allQs.length) : 0), [questionMode, target, allQs.length]);

  const groupedBlocks = useMemo(() => {
    if (!Array.isArray(allQs)) return [];
    const grouped = allQs.reduce<Record<string, any[]>>((acc, q) => {
      const block = q?.block || q?.topic || "Geral";
      if (!acc[block]) acc[block] = [];
      acc[block].push(q);
      return acc;
    }, {});
    return Object.entries(grouped);
  }, [allQs]);

  return {
    // estados
    creating, generating, showConfirm, setShowConfirm, impactedCount, traceId, successData, setSuccessData,
    title, setTitle, description, setDescription,
    selectedTopics, newTopicInput, setNewTopicInput, subtopics,
    faculdadeFilters, setFaculdadeFilters, periodoFilters, setPeriodoFilters,
    questionCount, setQuestionCount, timeLimit, setTimeLimit,
    generatedQuestions, manualQuestions, questionMode, setQuestionMode,
    difficulty, setDifficulty, difficultyMix, scheduledAt, setScheduledAt,
    autoAssign, setAutoAssign, examBoard,
    manualStatement, setManualStatement, manualOptions, manualCorrect, setManualCorrect,
    manualTopic, setManualTopic,
    previewStudents, previewLoading, selectedStudentIds, studentSearch, setStudentSearch,
    searchResults, searchingStudents,
    expandedQuestion, setExpandedQuestion, topicDistribution, useDistribution,
    selectedClassIds, setSelectedClassIds, selectedProfessorTurmaIds, setSelectedProfessorTurmaIds, assignmentMode, setAssignmentMode,
    endAt, setEndAt, maxAttempts, setMaxAttempts, feedbackPolicy, setFeedbackPolicy,
    allowRetake, setAllowRetake,
    studentPagination, selectedStudentsData,

    // derived
    allQs, target, deficit, groupedBlocks,

    // handlers
    addTopic, removeTopic, setSubtopicFor,
    toggleDistribution, updateTopicDistribution,
    handleExamBoardChange,
    updateDifficultyMix,
    previewMatchingStudents, searchStudentGlobal, addSearchedStudent,
    toggleStudentSelection, toggleAllStudents, clearStudentSelection,
    removeSelectedStudent,
    removeGeneratedQuestion, removeManualQuestion,
    generateQuestionsAI, regenerateMissing,
    addManualQuestion, updateManualOption,
    initiateCreate, confirmCreate
  };
}

export type CreateSimuladoFormState = ReturnType<typeof useCreateSimuladoForm>;
