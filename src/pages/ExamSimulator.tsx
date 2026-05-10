import { useState, useEffect, useRef, useCallback } from "react";
import { ALL_SPECIALTIES } from "@/constants/specialties";
import CycleFilter, { getFilteredSpecialties } from "@/components/CycleFilter";
import { useNavigate } from "react-router-dom";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { updateDomainMap } from "@/lib/updateDomainMap";
import { isMedicalQuestion } from "@/lib/medicalValidation";
import { filterValidQuestions } from "@/lib/aiOutputValidation";
import { FileText, Clock, Play, CheckCircle2, Loader2, ArrowRight, Award, AlertTriangle, BarChart3, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";

interface ExamQuestion {
  id: string;
  statement: string;
  options: string[];
  correct_index: number;
  topic: string;
  explanation: string;
  source?: string;
}

function getSourcePriority(source: string | null | undefined): number {
  if (!source) return 3;
  if (source === "web-scrape" || source === "real-exam-ai") return 1;
  if (source === "ai-exam-style") return 2;
  return 3;
}

type Phase = "setup" | "loading" | "exam" | "review" | "result";

const ExamSimulator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examConfig, setExamConfig] = useState({ questionCount: 50, timeMinutes: 120, areas: ["Clínica Médica", "Cirurgia", "Pediatria", "GO", "Preventiva", "Oncologia"], difficulty: "intermediario" });
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  // Session persistence
  const { pendingSession, checked, saveSession, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "exam-simulator" });

  // Register auto-save when in exam phase
  const getExamState = useCallback(() => {
    if (phase !== "exam") return {};
    return { phase, questions, selectedAnswers, current, timeLeft, examConfig, sessionId };
  }, [phase, questions, selectedAnswers, current, timeLeft, examConfig, sessionId]);

  useEffect(() => {
    registerAutoSave(getExamState);
  }, [getExamState, registerAutoSave]);

  const restoreSession = useCallback((data: Record<string, any>) => {
    if (data.questions) setQuestions(data.questions);
    if (data.selectedAnswers) setSelectedAnswers(data.selectedAnswers);
    if (typeof data.current === "number") setCurrent(data.current);
    if (typeof data.timeLeft === "number") setTimeLeft(data.timeLeft);
    if (data.examConfig) setExamConfig(data.examConfig);
    if (data.sessionId) setSessionId(data.sessionId);
    setPhase("exam");
    clearPending();
  }, [clearPending]);

  // Timer
  useEffect(() => {
    if (phase !== "exam" || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const startExam = async () => {
    setPhase("loading");
    try {
      // Fetch questions from bank or generate
      // Fetch previously answered question IDs to avoid repetition
      const { data: pastAttempts } = await supabase
        .from("practice_attempts")
        .select("question_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const answeredIds = new Set((pastAttempts || []).map(a => a.question_id));

      const { data: bankQuestions, error: bankError } = await supabase
        .from("questions_bank")
        .select("id, statement, options, correct_index, topic, explanation, source")
        .or(`user_id.eq.${user!.id},is_global.eq.true`)
        .limit(1000);

      if (bankError) throw bankError;

      let examQuestions: ExamQuestion[] = (bankQuestions || [])
        .map((q: any) => ({
          id: q.id,
          statement: q.statement,
          options: Array.isArray(q.options) ? q.options.map(String) : [],
          correct_index: q.correct_index || 0,
          topic: q.topic || "Geral",
          explanation: q.explanation || "",
          source: q.source || null,
        }))
        .filter((q) => q.options.length >= 2)
        .filter(isMedicalQuestion);

      // If not enough, generate more via AI
      // Filter by selected areas
      if (examConfig.areas.length > 0 && examConfig.areas.length < ALL_AREAS.length) {
        examQuestions = examQuestions.filter(q =>
          examConfig.areas.some(a => q.topic.toLowerCase().includes(a.toLowerCase()))
        );
      }

      if (examQuestions.length < examConfig.questionCount) {
        const needed = examConfig.questionCount - examQuestions.length;
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const accessToken = authSession?.access_token;

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
              difficulty: examConfig.difficulty,
              messages: [{ role: "user", content: `Gere ${needed} questões EXCLUSIVAMENTE médicas para simulado de residência médica. Áreas: ${examConfig.areas.join(", ")}. Retorne JSON array puro sem markdown: [{"statement":"...", "options":["a","b","c","d","e"], "correct_index": 0, "topic":"Área", "explanation":"..."}]` }],
              generationContext: {
                specialty: examConfig.areas[0] || "Clínica Médica",
                topic: examConfig.areas.join(", "),
                objective: "practice",
                difficulty: examConfig.difficulty === "dificil" ? "hard" : examConfig.difficulty === "facil" ? "easy" : "medium",
                language: "pt-BR",
                source: "exam-simulator",
              },
            }),
          }
        );

        if (res.ok) {
          try {
            const json = await res.json();
            
            // Parse from tool_calls (slot-based) or content fallback
            let parsed: any[] = [];
            const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              try {
                const tc = JSON.parse(toolCall.function.arguments);
                parsed = Array.isArray(tc.questions) ? tc.questions : [];
              } catch {}
            }
            if (parsed.length === 0) {
              const content = json.choices?.[0]?.message?.content || JSON.stringify(json);
              const match = content.match(/\[[\s\S]*\]/);
              if (match) {
                try { parsed = JSON.parse(match[0]); } catch {}
              }
            }

            const extra: ExamQuestion[] = (Array.isArray(parsed) ? parsed : [])
              .map((q: any, i: number) => ({
                id: `gen-${i}`,
                statement: String(q.statement || ""),
                options: Array.isArray(q.options) ? q.options.map(String) : [],
                correct_index: Number.isInteger(q.correct_index) ? q.correct_index : 0,
                topic: String(q.topic || "Geral"),
                explanation: String(q.explanation || ""),
              }))
              .filter((q) => q.options.length >= 2)
              .filter(isMedicalQuestion);

            const validatedExtra = filterValidQuestions(extra, { specialty: examConfig.areas[0] });
            examQuestions = [...examQuestions, ...validatedExtra];
          } catch {
            // ignore parse errors
          }
        }
      }

      // Separate unseen vs seen questions
      const unseenQuestions = examQuestions.filter(q => !answeredIds.has(q.id));
      const seenQuestions = examQuestions.filter(q => answeredIds.has(q.id));

      // Sort unseen by source priority (real exam questions first), then shuffle within tiers
      unseenQuestions.sort((a, b) => {
        const pDiff = getSourcePriority(a.source) - getSourcePriority(b.source);
        return pDiff !== 0 ? pDiff : Math.random() - 0.5;
      });

      // Use unseen first, fill with seen (oldest first) if needed
      examQuestions = unseenQuestions.length >= examConfig.questionCount
        ? unseenQuestions.slice(0, examConfig.questionCount)
        : [...unseenQuestions, ...seenQuestions.sort(() => Math.random() - 0.5)].slice(0, examConfig.questionCount);

      // Final shuffle to mix priorities for a natural exam feel
      examQuestions = examQuestions.sort(() => Math.random() - 0.5);

      if (examQuestions.length === 0) {
        throw new Error("Não encontrei questões médicas válidas para montar o simulado.");
      }

      // Create session
      const { data: session } = await supabase.from("exam_sessions").insert({
        user_id: user!.id,
        title: `Simulado - ${new Date().toLocaleDateString("pt-BR")}`,
        total_questions: examQuestions.length,
        time_limit_minutes: examConfig.timeMinutes,
        status: "in_progress",
      }).select("id").single();

      setSessionId(session?.id || null);
      setQuestions(examQuestions);
      setSelectedAnswers({});
      setCurrent(0);
      setTimeLeft(examConfig.timeMinutes * 60);
      setPhase("exam");
    } catch (err: any) {
      toast({ title: "Erro ao iniciar simulado", description: err.message, variant: "destructive" });
      setPhase("setup");
    }
  };

  const submitExam = async () => {
    clearInterval(timerRef.current);
    setPhase("review");

    const results: Record<string, { correct: number; total: number }> = {};
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const isCorrect = selectedAnswers[i] === q.correct_index;
      if (isCorrect) correctCount++;
      if (!results[q.topic]) results[q.topic] = { correct: 0, total: 0 };
      results[q.topic].total++;
      if (isCorrect) results[q.topic].correct++;
    }

    const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    if (sessionId && user) {
      await supabase.from("exam_sessions").update({
        finished_at: new Date().toISOString(),
        answers_json: selectedAnswers,
        results_json: results,
        score,
        status: "finished",
      }).eq("id", sessionId);

      // Save practice attempts and log errors
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const isCorrect = selectedAnswers[i] === q.correct_index;

        if (q.id && !q.id.startsWith("gen-")) {
          await supabase.from("practice_attempts").insert({
            user_id: user.id,
            question_id: q.id,
            correct: isCorrect,
          });
        }

        // Log wrong answers to error_bank
        if (!isCorrect && selectedAnswers[i] !== undefined) {
          await logErrorToBank({
            userId: user.id,
            tema: q.topic || "Geral",
            tipoQuestao: "simulado",
            conteudo: q.statement,
            motivoErro: `Marcou "${q.options[selectedAnswers[i]]}" — Correta: "${q.options[q.correct_index]}"`,
            categoriaErro: "conceito",
          });
        }
      }
      // Award XP for completing simulado
      await addXp(XP_REWARDS.simulado_completed);

      // Update medical_domain_map
      const domainEntries = questions.map((q, i) => ({
        topic: q.topic,
        correct: selectedAnswers[i] === q.correct_index,
      }));
      await updateDomainMap(user.id, domainEntries);
    }

    await completeSession();
    setPhase("result");
  };

  const ALL_AREAS = ALL_SPECIALTIES;

  const toggleArea = (area: string) => {
    setExamConfig(prev => ({
      ...prev,
      areas: prev.areas.includes(area) ? prev.areas.filter(a => a !== area) : [...prev.areas, area],
    }));
  };

  // SETUP
  if (phase === "setup") {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        {checked && pendingSession && (
          <ResumeSessionBanner
            updatedAt={pendingSession.updated_at}
            onResume={() => restoreSession(pendingSession.session_data)}
            onDiscard={() => abandonSession()}
          />
        )}
        <div className="text-center py-6">
          <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Simulado Completo</h1>
          <p className="text-muted-foreground">Modo prova real com cronômetro e relatório detalhado.</p>
        </div>

        <div className="glass-card p-6 space-y-5">
          {/* Area/Topic selection */}
          <div>
            <label className="text-sm font-semibold mb-3 block">Selecione as áreas/assuntos</label>
            <CycleFilter activeCycle={cycleFilter} onCycleChange={setCycleFilter} className="mb-3" />
            <div className="flex flex-wrap gap-2">
              {getFilteredSpecialties(cycleFilter).map(area => (
                <button
                  key={area}
                  onClick={() => toggleArea(area)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    examConfig.areas.includes(area)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExamConfig(p => ({ ...p, areas: [...ALL_AREAS] }))}>
                Selecionar todos
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExamConfig(p => ({ ...p, areas: [] }))}>
                Limpar
              </Button>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Nível de dificuldade</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "facil", label: "Fácil" },
                { value: "intermediario", label: "Intermediário" },
                { value: "dificil", label: "Difícil" },
                { value: "misto", label: "Misto" },
              ].map(d => (
                <Button
                  key={d.value}
                  variant={examConfig.difficulty === d.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setExamConfig(p => ({ ...p, difficulty: d.value }))}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Número de questões</label>
            <div className="flex gap-2">
              {[25, 50, 100].map(n => (
                <Button
                  key={n}
                  variant={examConfig.questionCount === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setExamConfig(p => ({ ...p, questionCount: n, timeMinutes: Math.round(n * 2.5) }))}
                >
                  {n} questões
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Tempo limite</label>
            <p className="text-sm text-muted-foreground">{examConfig.timeMinutes} minutos ({Math.round(examConfig.timeMinutes / 60)}h)</p>
          </div>
          <Button size="lg" className="w-full" onClick={startExam} disabled={examConfig.areas.length === 0}>
            <Play className="h-4 w-4 mr-2" /> Iniciar Simulado
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Preparando simulado...</p>
      </div>
    );
  }

  // RESULT
  if (phase === "result") {
    const correctCount = questions.reduce((acc, q, i) => acc + (selectedAnswers[i] === q.correct_index ? 1 : 0), 0);
    const score = Math.round((correctCount / questions.length) * 100);
    const areaResults: Record<string, { correct: number; total: number }> = {};
    const errorQuestions: { q: ExamQuestion; idx: number }[] = [];

    questions.forEach((q, i) => {
      if (!areaResults[q.topic]) areaResults[q.topic] = { correct: 0, total: 0 };
      areaResults[q.topic].total++;
      if (selectedAnswers[i] === q.correct_index) areaResults[q.topic].correct++;
      else errorQuestions.push({ q, idx: i });
    });

    return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <div className="text-center py-6">
          <Award className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Resultado do Simulado</h1>
          <div className="text-5xl font-black text-primary">{score}%</div>
          <p className="text-muted-foreground mt-2">{correctCount}/{questions.length} acertos</p>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Desempenho por área
          </h3>
          <div className="space-y-3">
            {Object.entries(areaResults).map(([area, { correct, total }]) => {
              const pct = Math.round((correct / total) * 100);
              return (
                <div key={area}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{area}</span>
                    <span className="text-muted-foreground">{correct}/{total} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {errorQuestions.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Caderno de Erros ({errorQuestions.length})
            </h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {errorQuestions.slice(0, 20).map(({ q, idx }) => (
                <div key={idx} className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-medium mb-2">{q.statement}</p>
                  <p className="text-xs text-muted-foreground mb-1">
                    Sua resposta: <span className="text-destructive font-medium">{String.fromCharCode(65 + (selectedAnswers[idx] ?? -1))}</span>
                    {" • "}Correta: <span className="text-green-500 font-medium">{String.fromCharCode(65 + q.correct_index)}</span>
                  </p>
                  {q.explanation && <p className="text-xs text-muted-foreground mt-2">{q.explanation}</p>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-2 text-xs"
                    onClick={() => navigate("/dashboard/mentor", {
                      state: {
                        initialMessage: `Errei uma questão sobre "${q.topic}". O enunciado era: "${q.statement.slice(0, 200)}". A resposta correta era "${q.options[q.correct_index]}". Me explique este tema seguindo o protocolo ENAZIZI.`,
                        fromErrorBank: true,
                      },
                    })}
                  >
                    <GraduationCap className="h-3.5 w-3.5" /> Estudar com Tutor IA
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => setPhase("setup")} variant="outline" className="w-full">Novo Simulado</Button>
      </div>
    );
  }

  // EXAM
  const q = questions[current];
  const answeredCount = Object.keys(selectedAnswers).length;
  const timeWarning = timeLeft < 300;

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur py-2">
        <span className="text-sm font-medium">{current + 1}/{questions.length}</span>
        <span className={`flex items-center gap-1 text-sm font-mono font-bold ${timeWarning ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
          <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
        </span>
        <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length} respondidas</span>
      </div>

      {/* Progress */}
      <div className="h-1 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <div className="glass-card p-6">
        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary mb-3 inline-block">{q.topic}</span>
        <p className="text-base font-medium mb-6">{q.statement}</p>
        <div className="space-y-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelectedAnswers(prev => ({ ...prev, [current]: i }))}
              className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${
                selectedAnswers[current] === i ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/30"
              }`}
            >
              <span className="font-semibold mr-2">{String.fromCharCode(65 + i)})</span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent(c => c - 1)} className="flex-1">Anterior</Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent(c => c + 1)} className="flex-1">Próxima <ArrowRight className="h-4 w-4 ml-1" /></Button>
        ) : (
          <Button onClick={submitExam} variant="default" className="flex-1">Finalizar Simulado</Button>
        )}
      </div>

      {/* Question grid */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-10 gap-1">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-8 w-8 rounded text-xs font-medium transition-all ${
                i === current ? "bg-primary text-primary-foreground" : selectedAnswers[i] !== undefined ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExamSimulator;
