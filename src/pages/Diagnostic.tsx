import { useState, useEffect } from "react";
import { isMedicalQuestion } from "@/lib/medicalValidation";
import { filterValidQuestions } from "@/lib/aiOutputValidation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { updateDomainMap } from "@/lib/updateDomainMap";
import { mapTopicToSpecialty } from "@/lib/mapTopicToSpecialty";
import { getFallbackQuestionsForArea, getAllFallbackQuestions } from "@/lib/diagnosticFallbackQuestions";
import DiagnosticIntro from "@/components/diagnostic/DiagnosticIntro";
import DiagnosticExam from "@/components/diagnostic/DiagnosticExam";
import DiagnosticReview from "@/components/diagnostic/DiagnosticReview";
import DiagnosticResult from "@/components/diagnostic/DiagnosticResult";
import type { DiagQuestion, AnswerRecord } from "@/components/diagnostic/DiagnosticExam";

const DIAGNOSTIC_BIBLIOGRAPHY: Record<string, string> = {
  "Clínica Médica": "Harrison Principles of Internal Medicine",
  "Cirurgia": "Schwartz Principles of Surgery / Sabiston Textbook of Surgery",
  "Pediatria": "Nelson Textbook of Pediatrics / Tratado de Pediatria SBP",
  "Ginecologia e Obstetrícia": "Williams Obstetrics / Ginecologia e Obstetrícia FEBRASGO",
  "Medicina Preventiva": "Medicina Preventiva e Social Rouquayrol / Epidemiology Gordis",
  "Oncologia": "DeVita Cancer Principles & Practice of Oncology / Manual de Oncologia Clínica SBOC",
  "Neurologia": "Adams and Victor's Principles of Neurology / DeJong's The Neurologic Examination",
  "Cardiologia": "Braunwald's Heart Disease / Manual de Cardiologia SOCESP",
  "Anatomia": "Gray's Anatomy for Students / Netter Atlas of Human Anatomy",
  "Fisiologia": "Guyton & Hall Textbook of Medical Physiology / Costanzo Physiology",
  "Bioquímica": "Lehninger Principles of Biochemistry",
  "Histologia": "Junqueira's Basic Histology / Wheater's Functional Histology",
  "Farmacologia": "Goodman & Gilman's Pharmacological Basis of Therapeutics / Katzung",
  "Patologia": "Robbins & Cotran Pathologic Basis of Disease",
  "Semiologia": "Bates Guide to Physical Examination / Porto Semiologia Médica",
  "Microbiologia": "Murray Medical Microbiology",
  "Imunologia": "Abbas Cellular and Molecular Immunology",
};
const getBibRefForDiagnostic = (area: string) => DIAGNOSTIC_BIBLIOGRAPHY[area] || "Harrison / Sabiston / Nelson / Williams";

// Areas organized by academic cycle
const AREAS_BASICO = [
  "Anatomia", "Fisiologia", "Bioquímica", "Histologia",
  "Farmacologia", "Patologia", "Microbiologia", "Imunologia",
];
const AREAS_CLINICO = [
  "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia",
  "Medicina Preventiva", "Cardiologia", "Neurologia", "Semiologia",
];
const AREAS_INTERNATO = [
  "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia",
  "Medicina Preventiva", "Oncologia", "Neurologia", "Cardiologia",
];

function getAreasForCycle(cycle: string): string[] {
  if (cycle === "basico") return AREAS_BASICO;
  if (cycle === "internato") return AREAS_INTERNATO;
  return AREAS_CLINICO; // default / clinico
}

function periodoToDefaultCycle(periodo: number | null): string {
  if (!periodo) return "";
  if (periodo <= 4) return "basico";
  if (periodo <= 8) return "clinico";
  return "internato";
}

const SCENARIO_HINTS: Record<string, string> = {
  "Clínica Médica": "Varie: UBS, enfermaria, UTI, ambulatório. Pacientes 20-90 anos, diferentes comorbidades. Emergência hipertensiva, ICC descompensada, pneumonia, cetoacidose, TEP.",
  "Cirurgia": "Varie: PS, centro cirúrgico, enfermaria. Abdome agudo, trauma, hérnias, pré/pós-operatório, complicações cirúrgicas.",
  "Pediatria": "Neonatos, lactentes, pré-escolares, adolescentes. Bronquiolite, pneumonia infantil, desidratação, convulsão febril, meningite, vacinação.",
  "Ginecologia e Obstetrícia": "Gestantes em diferentes trimestres, puérperas. Pré-eclâmpsia, DM gestacional, sangramento 1º tri, trabalho de parto, rastreio câncer cervical.",
  "Medicina Preventiva": "Atenção primária, vigilância epidemiológica. Rastreamentos, vacinação adulto, indicadores de saúde, estudos epidemiológicos, SUS.",
  "Oncologia": "Neoplasias mais prevalentes: pulmão, mama, colorretal, próstata. Estadiamento, rastreio, emergências oncológicas, paraneoplásicas.",
  "Neurologia": "AVC isquêmico/hemorrágico, epilepsia, cefaleia, meningite, neuropatia periférica. Glasgow, NIHSS.",
  "Cardiologia": "SCA, IC, arritmias, valvopatias, endocardite. ECG, ecocardiograma, biomarcadores cardíacos.",
};

type Phase = "intro" | "loading" | "exam" | "review" | "result";

const QUESTIONS_PER_AREA = 5;
const REQUEST_TIMEOUT_MS = 35000;

const Diagnostic = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addXp } = useGamification();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<DiagQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [resumeIdx, setResumeIdx] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [userPeriodo, setUserPeriodo] = useState<number | null>(null);
  const [selectedCycle, setSelectedCycle] = useState("clinico");
  const [previousTopicResults, setPreviousTopicResults] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("periodo").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.periodo) setUserPeriodo(data.periodo);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("diagnostic_results").select("id").eq("user_id", user.id).limit(1).then(({ data }) => {
      if (data && data.length > 0) setAlreadyDone(true);
    });
    // Load previous session topic results for comparison
    supabase.from("diagnostic_sessions" as any)
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: session }) => {
        if (session) {
          supabase.from("diagnostic_topic_results" as any)
            .select("topic, accuracy")
            .eq("session_id", (session as any).id)
            .then(({ data: topics }) => {
              if (topics) {
                const map: Record<string, number> = {};
                for (const t of topics as any[]) map[t.topic] = t.accuracy;
                setPreviousTopicResults(map);
              }
            });
        }
      });
  }, [user]);

  const getDifficultyForArea = (area: string, prevAnswers: AnswerRecord[]): string => {
    const areaAnswers = prevAnswers.filter(a => a.topic === area);
    if (areaAnswers.length === 0) return "intermediário (padrão REVALIDA)";
    const rate = areaAnswers.filter(a => a.correct).length / areaAnswers.length;
    if (rate >= 0.8) return "avançado (padrão ENAMED/ENARE com pegadinhas)";
    return "intermediário (padrão REVALIDA)";
  };

  const invokeQuestionGeneratorWithTimeout = async (body: Record<string, unknown>, timeoutMs: number) => {
    let timer: number | undefined;
    try {
      const request = supabase.functions.invoke("question-generator", { body });
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Tempo limite ao gerar questões.")), timeoutMs);
      });
      return await Promise.race([request, timeout]) as Awaited<typeof request>;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  /** Collect pathologies/diagnoses already used across all accumulated questions */
  const getUsedPathologies = (allQ: DiagQuestion[]): string[] => {
    const pathologies: string[] = [];
    for (const q of allQ) {
      // Extract from explanation (most likely mentions the pathology)
      const explMatch = q.explanation?.match(/^([^.—:]+)/);
      if (explMatch) pathologies.push(explMatch[1].trim().slice(0, 60));
      // Also use first 80 chars of statement to identify scenario
    }
    return [...new Set(pathologies)];
  };

  /** Check if two questions are too similar (first 80 chars of statement) */
  const isDuplicate = (q: DiagQuestion, existing: DiagQuestion[]): boolean => {
    const snippet = q.statement.slice(0, 80).toLowerCase();
    return existing.some(e => {
      const eSnippet = e.statement.slice(0, 80).toLowerCase();
      // Check if >60% of chars overlap
      let matches = 0;
      for (let i = 0; i < Math.min(snippet.length, eSnippet.length); i++) {
        if (snippet[i] === eSnippet[i]) matches++;
      }
      return matches / Math.max(snippet.length, eSnippet.length) > 0.6;
    });
  };

  const generateAreaQuestions = async (area: string, allQuestionsSoFar: DiagQuestion[]): Promise<DiagQuestion[]> => {
    const hint = SCENARIO_HINTS[area] || "";
    const difficulty = getDifficultyForArea(area, answers);
    const seed = Math.floor(Math.random() * 99999);

    // Collect used pathologies from all questions generated so far
    const usedPathologies = getUsedPathologies(allQuestionsSoFar);
    const usedPathologiesStr = usedPathologies.length > 0
      ? `\nPATOLOGIAS/DIAGNÓSTICOS JÁ USADOS NESTE EXAME (PROIBIDO REPETIR): ${usedPathologies.join(", ")}`
      : "";

    const res = await invokeQuestionGeneratorWithTimeout({
      stream: false,
      maxRetries: 0,
      timeoutMs: 30000,
      generationContext: {
        specialty: area,
        topic: area,
        objective: "practice",
        difficulty: difficulty.includes("avançado") ? "hard" : "medium",
        language: "pt-BR",
        source: "diagnostic",
      },
      messages: [{ role: "user", content: `Gere EXATAMENTE ${QUESTIONS_PER_AREA} questões de múltipla escolha de ${area} para simulado diagnóstico de residência médica. Nível: ${difficulty}. Seed: ${seed}.

CALIBRAÇÃO OBRIGATÓRIA REVALIDA/ENAMED:
- PROIBIDO: questões de definição pura ("O que é X?")
- PROIBIDO: enunciados < 150 caracteres sem caso clínico
- OBRIGATÓRIO: caso clínico com ≥3 dados clínicos (sinais vitais, exames, achados semiológicos)
- OBRIGATÓRIO: ≥2 etapas de raciocínio clínico
- OBRIGATÓRIO: pelo menos 2 distratores plausíveis (diagnóstico diferencial real)
- OBRIGATÓRIO: Cite a referência bibliográfica específica da especialidade na explicação

BIBLIOGRAFIA DE REFERÊNCIA para ${area}: ${getBibRefForDiagnostic(area)}
- OBRIGATÓRIO: ≥2 etapas de raciocínio clínico
- OBRIGATÓRIO: pelo menos 2 distratores plausíveis (diagnóstico diferencial real)

REGRAS DE DIVERSIDADE OBRIGATÓRIAS:
- ${hint}
- Cada questão DEVE abordar um SUBTÓPICO DIFERENTE dentro de ${area}
- PROIBIDO repetir cenário, perfil de paciente, faixa etária ou queixa principal
- Varie o TIPO de pergunta: 1 diagnóstico, 1 conduta, 1 exame complementar, 1 fisiopatologia, 1 tratamento
- Cada paciente deve ter idade, sexo e contexto clínico DISTINTOS
- PROIBIDO repetir a mesma patologia/diagnóstico principal já usada em outra questão deste exame${usedPathologiesStr}

REGRA DE GABARITO (CRÍTICA — SIGA EXATAMENTE):
- Distribua gabaritos UNIFORMEMENTE entre A(0), B(1), C(2), D(3), E(4)
- Para ${QUESTIONS_PER_AREA} questões, cada letra DEVE aparecer pelo menos 1 vez
- NUNCA repita mesma letra mais que 2 vezes consecutivas
- Exemplo válido para 5 questões: correct_index = [0, 2, 4, 1, 3]
- Exemplo INVÁLIDO: correct_index = [0, 0, 1, 0, 1]

FORMATO: Retorne APENAS JSON array:
[{"statement":"Caso clínico completo com ≥150 chars...","options":["A) ...","B) ...","C) ...","D) ...","E) ..."],"correct_index":0,"topic":"${area}","explanation":"Raciocínio clínico passo a passo...","difficulty":"${difficulty}"}]
NÃO inclua texto extra, APENAS o JSON.` }],
    }, REQUEST_TIMEOUT_MS);

    if (res.error) throw res.error;

    const raw = res.data;
    let content = "";
    if (typeof raw === "string") content = raw;
    else if (raw?.choices?.[0]?.message?.content) content = raw.choices[0].message.content;
    else content = JSON.stringify(raw);

    const parsed = parseQuestions(content, area, difficulty).filter(q => isMedicalQuestion(q));
    // Apply global AI validation
    const validated = filterValidQuestions(parsed, { specialty: area, topic: area });
    // Post-parse: filter out duplicates against already accumulated questions
    const unique = validated.filter(q => !isDuplicate(q, allQuestionsSoFar));
    return unique.slice(0, QUESTIONS_PER_AREA);
  };

  const startExam = async (cycle: string) => {
    setSelectedCycle(cycle);
    setPhase("loading");
    try {
      const allQuestions: DiagQuestion[] = [];
      const failedAreas: string[] = [];

      const AREAS = getAreasForCycle(cycle);
      // Process areas in parallel but limited to 3 concurrent to balance speed vs reliability
      const BATCH_SIZE = 3;
      for (let i = 0; i < AREAS.length; i += BATCH_SIZE) {
        const batch = AREAS.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(area => 
          // Add a per-area retry logic for robustness
          (async () => {
            try {
              return await generateAreaQuestions(area, allQuestions);
            } catch (areaErr) {
              console.warn(`[Diagnostic] Failed attempt for ${area}, retrying once...`, areaErr);
              return await generateAreaQuestions(area, allQuestions);
            }
          })()
        ));

        results.forEach((result, idx) => {
          const area = batch[idx];
          if (result.status === "fulfilled" && result.value && result.value.length > 0) {
            allQuestions.push(...result.value);
          } else {
            console.warn(`[Diagnostic] All attempts failed for ${area}, using fallback.`);
            failedAreas.push(area);
            allQuestions.push(...getFallbackQuestionsForArea(area, QUESTIONS_PER_AREA));
          }
        });
      }

      if (failedAreas.length > 0) {
        toast({
          title: "Geração parcial concluída",
          description: `Algumas áreas demoraram demais (${failedAreas.join(", ")}). Inserimos questões de contingência para você continuar.`,
        });
      }

      setQuestions(allQuestions.length > 0 ? allQuestions : getAllFallbackQuestions());
      setPhase("exam");
    } catch (err: any) {
      toast({ title: "Erro ao gerar nivelamento", description: err.message, variant: "destructive" });
      setQuestions(getAllFallbackQuestions());
      setPhase("exam");
    }
  };

  const parseQuestions = (text: string, defaultTopic: string, difficulty: string): DiagQuestion[] => {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as DiagQuestion[];
        return parsed.map(q => ({ ...q, topic: q.topic || defaultTopic, difficulty: q.difficulty || difficulty }));
      }
    } catch {}
    return [];
  };

  // Fallback questions are now in src/lib/diagnosticFallbackQuestions.ts

  const updateMedicalDomainMap = async (finalAnswers: AnswerRecord[]) => {
    if (!user) return;
    const entries = finalAnswers.map(a => ({ topic: a.topic, correct: a.correct }));
    await updateDomainMap(user.id, entries);
  };

  const handleExamFinish = async (finalAnswers: AnswerRecord[]) => {
    setAnswers(finalAnswers);

    if (!user) {
      setPhase("result");
      return;
    }

    // Log wrong answers to error bank
    for (const a of finalAnswers) {
      if (!a.correct && a.selected >= 0) {
        const q = questions[a.questionIdx];
        logErrorToBank({
          userId: user.id,
          tema: mapTopicToSpecialty(q.topic || "Geral") || q.topic || "Geral",
          tipoQuestao: "diagnostico",
          conteudo: q.statement,
          motivoErro: `Marcou "${q.options[a.selected]}" — Correta: "${q.options[q.correct_index]}"`,
          categoriaErro: "conceito",
        });
      }
    }

    // Calculate & save score
    const correctCount = finalAnswers.filter(a => a.correct).length;
    const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    const areaResults: Record<string, { correct: number; total: number; totalTime: number }> = {};
    for (const a of finalAnswers) {
      if (!areaResults[a.topic]) areaResults[a.topic] = { correct: 0, total: 0, totalTime: 0 };
      areaResults[a.topic].total++;
      areaResults[a.topic].totalTime += a.timeSpent || 0;
      if (a.correct) areaResults[a.topic].correct++;
    }

    // Legacy diagnostic_results (keep for compatibility)
    await supabase.from("diagnostic_results").insert([{
      user_id: user.id,
      score,
      total_questions: questions.length,
      results_json: { answers: finalAnswers, areaResults } as any,
    }]);

    // NEW: persist diagnostic_sessions + diagnostic_topic_results
    const { data: sessionData } = await supabase.from("diagnostic_sessions" as any).insert([{
      user_id: user.id,
      cycle: selectedCycle,
      score,
      total_questions: questions.length,
      correct_count: correctCount,
      areas_evaluated: Object.keys(areaResults),
      finished_at: new Date().toISOString(),
    }]).select("id").single();

    const sessionId = (sessionData as any)?.id;

    if (sessionId) {
      const topicRows = Object.entries(areaResults).map(([topic, r]) => ({
        session_id: sessionId,
        user_id: user.id,
        topic,
        correct: r.correct,
        total: r.total,
        accuracy: r.total > 0 ? (r.correct / r.total) * 100 : 0,
        avg_time_seconds: r.total > 0 ? Math.round(r.totalTime / r.total) : 0,
      }));
      await supabase.from("diagnostic_topic_results" as any).insert(topicRows);

      // Feed user_topic_profiles with diagnostic data
      for (const row of topicRows) {
        const existing = await supabase
          .from("user_topic_profiles")
          .select("id, total_questions, correct_answers")
          .eq("user_id", user.id)
          .eq("topic", row.topic)
          .maybeSingle();

        if (existing.data) {
          const newTotal = (existing.data.total_questions || 0) + row.total;
          const newCorrect = (existing.data.correct_answers || 0) + row.correct;
          await supabase.from("user_topic_profiles").update({
            total_questions: newTotal,
            correct_answers: newCorrect,
            accuracy: newTotal > 0 ? (newCorrect / newTotal) * 100 : 0,
            last_practiced_at: new Date().toISOString(),
          }).eq("id", existing.data.id);
        } else {
          await supabase.from("user_topic_profiles").insert({
            user_id: user.id,
            topic: row.topic,
            specialty: row.topic,
            total_questions: row.total,
            correct_answers: row.correct,
            accuracy: row.accuracy,
            last_practiced_at: new Date().toISOString(),
          });
        }
      }
    }

    await supabase.from("profiles").update({ has_completed_diagnostic: true }).eq("user_id", user.id);

    // Gamification: award XP
    const xpPerCorrect = XP_REWARDS.question_correct;
    const xpPerAttempt = XP_REWARDS.question_answered;
    const totalXp = (correctCount * xpPerCorrect) + (finalAnswers.length * xpPerAttempt);
    const earned = await addXp(totalXp, "diagnostic_completed");
    setXpEarned(earned || totalXp);

    // Update medical domain map with normalized specialties
    await updateMedicalDomainMap(finalAnswers);

    // Trigger daily plan generation after diagnostic
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.access_token) {
        supabase.functions.invoke("generate-daily-plan", {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        }).catch(() => {});
      }
    } catch {}

    setPhase("result");
  };

  const handleGoToReview = (currentAnswers: AnswerRecord[], currentIdx: number) => {
    setAnswers(currentAnswers);
    setResumeIdx(currentIdx);
    setPhase("review");
  };

  if (phase === "intro") {
    return <DiagnosticIntro alreadyDone={alreadyDone} defaultCycle={periodoToDefaultCycle(userPeriodo)} onStart={startExam} />;
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Gerando questões de nivelamento personalizadas...</p>
        <p className="text-xs text-muted-foreground mt-2">Isso pode levar até 1 minuto</p>
      </div>
    );
  }

  if (phase === "exam") {
    return (
      <DiagnosticExam
        questions={questions}
        onFinish={handleExamFinish}
        onGoToReview={handleGoToReview}
      />
    );
  }

  if (phase === "review") {
    return (
      <DiagnosticReview
        questions={questions}
        answers={answers}
        totalQuestions={questions.length}
        onFinish={() => handleExamFinish(answers)}
        onBack={() => setPhase("exam")}
      />
    );
  }

  return <DiagnosticResult questions={questions} answers={answers} xpEarned={xpEarned} previousTopicResults={previousTopicResults} />;
};

export default Diagnostic;
