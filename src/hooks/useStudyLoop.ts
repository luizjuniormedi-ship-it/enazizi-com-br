import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { StudyNextRecommendation } from "./useStudyNext";

/* ─── Loop states ─── */
export type LoopPhase = "idle" | "intro" | "running" | "feedback" | "next" | "complete";

export interface LoopContext {
  recommendation: StudyNextRecommendation;
  theme: string;
  subtopic?: string;
}

export interface StepResult {
  correct?: boolean;
  score?: number;
  explanation?: string;
  reinforcement?: { explanation: string; correction: string; tip: string };
  generatedQuestion?: GeneratedQuestion | null;
  helperContent?: string | null;
  summaryContent?: string | null;
}

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
}

/* ─── Edge-function callers ─── */
async function callEdge<T = any>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message || `Erro ao chamar ${name}`);
  return data as T;
}

async function callStudyComplete(payload: Record<string, unknown>) {
  return callEdge("study-complete", payload);
}

async function callReinforceError(theme: string, errorType?: string, userAnswer?: string) {
  return callEdge<{ explanation: string; correction: string; tip: string }>("reinforce-error", {
    theme,
    errorType: errorType || "",
    userAnswer: userAnswer || "",
  });
}

async function callGenerateQuestion(theme: string, subtopic?: string, difficulty?: string, context?: Record<string, unknown>) {
  return callEdge<GeneratedQuestion>("generate-adaptive-question", {
    theme,
    subtopic: subtopic || "",
    difficulty: difficulty || "medium",
    context: context || {},
  });
}

async function callSummarizeTopic(theme: string) {
  return callEdge<{ summary: string }>("summarize-topic", { theme });
}

async function callExplainSimple(theme: string, doubt?: string) {
  return callEdge<{ explanation: string }>("explain-simple", { theme, doubt: doubt || "" });
}

async function callExplainDeep(theme: string, subtopic?: string) {
  return callEdge<{ explanation: string; clinicalReasoning: string; pitfalls: string[]; summary: string }>("explain-deep", {
    theme,
    subtopic: subtopic || "",
  });
}

/* ─── Hook ─── */
export function useStudyLoop() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<LoopPhase>("idle");
  const [context, setContext] = useState<LoopContext | null>(null);
  const [result, setResult] = useState<StepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reinforceCountRef = useRef(0);

  /* ─── Start mission ─── */
  const startMission = useCallback((rec: StudyNextRecommendation) => {
    const theme = rec.title || "";
    setContext({ recommendation: rec, theme, subtopic: rec.targetType });
    setResult(null);
    setError(null);
    reinforceCountRef.current = 0;
    setPhase("intro");
  }, []);

  /* ─── Begin execution after intro ─── */
  const beginExecution = useCallback(async () => {
    if (!context) return;
    setPhase("running");
    setLoading(true);
    setError(null);

    try {
      const rec = context.recommendation;

      if (rec.type === "error_review") {
        const reinforcement = await callReinforceError(context.theme);
        const question = await callGenerateQuestion(context.theme, context.subtopic, "medium", { fromError: true });
        setResult({ reinforcement, generatedQuestion: question });
      } else if (rec.type === "review") {
        const summary = await callSummarizeTopic(context.theme);
        setResult({ summaryContent: summary.summary, helperContent: null });
      } else if (rec.type === "daily_task") {
        const question = await callGenerateQuestion(context.theme, context.subtopic);
        setResult({ generatedQuestion: question });
      } else {
        // free_study
        const question = await callGenerateQuestion(context.theme, context.subtopic);
        setResult({ generatedQuestion: question });
      }
    } catch (e: any) {
      setError(e.message || "Erro ao executar missão");
    } finally {
      setLoading(false);
    }
  }, [context]);

  /* ─── Submit answer for question ─── */
  const submitAnswer = useCallback(async (userAnswer: string) => {
    if (!context || !result?.generatedQuestion) return;
    setLoading(true);
    setError(null);

    const correct = userAnswer.trim().toUpperCase() === result.generatedQuestion.correctAnswer.trim().toUpperCase();

    try {
      // Always call study-complete
      await callStudyComplete({
        type: context.recommendation.type,
        theme: context.theme,
        subtopic: context.subtopic || "",
        correct,
        metadata: {
          source: "mission_control",
          originModule: "study_loop",
          recommendationType: context.recommendation.type,
          theme: context.theme,
        },
      });

      if (!correct && reinforceCountRef.current < 2) {
        // Error flow: reinforce then generate new question
        reinforceCountRef.current += 1;
        const reinforcement = await callReinforceError(context.theme, "", userAnswer);
        const newQuestion = await callGenerateQuestion(context.theme, context.subtopic, "easy", { fromError: true });
        setResult((prev) => ({
          ...prev,
          correct: false,
          reinforcement,
          generatedQuestion: newQuestion,
          explanation: result.generatedQuestion!.explanation,
        }));
        setPhase("feedback");
      } else {
        // Correct or max reinforcements reached
        setResult((prev) => ({
          ...prev,
          correct,
          explanation: result.generatedQuestion!.explanation,
          reinforcement: undefined,
          generatedQuestion: null,
        }));
        setPhase("feedback");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao processar resposta");
    } finally {
      setLoading(false);
    }
  }, [context, result]);

  /* ─── Complete review step (non-question) ─── */
  const completeReview = useCallback(async () => {
    if (!context) return;
    setLoading(true);
    setError(null);

    try {
      await callStudyComplete({
        type: context.recommendation.type,
        theme: context.theme,
        subtopic: context.subtopic || "",
        correct: true,
        metadata: {
          source: "mission_control",
          originModule: "study_loop",
          recommendationType: context.recommendation.type,
        },
      });
      setResult((prev) => ({ ...prev, correct: true }));
      setPhase("feedback");
    } catch (e: any) {
      setError(e.message || "Erro ao concluir revisão");
    } finally {
      setLoading(false);
    }
  }, [context]);

  /* ─── Load next recommendation ─── */
  const loadNext = useCallback(async () => {
    setPhase("next");
    setLoading(true);
    setError(null);

    try {
      // Invalidate queries so MissionControlPage refreshes
      await queryClient.invalidateQueries({ queryKey: ["study-next"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
      setPhase("complete");
    } catch (e: any) {
      setError(e.message || "Erro ao carregar próxima missão");
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /* ─── Continue after feedback (handles branching) ─── */
  const continueLoop = useCallback(async () => {
    if (!result) {
      await loadNext();
      return;
    }

    // If there's a new question from the error flow, go back to running
    if (!result.correct && result.generatedQuestion) {
      setPhase("running");
      return;
    }

    // Otherwise load next mission
    await loadNext();
  }, [result, loadNext]);

  /* ─── Quick action helpers ─── */
  const runQuickAction = useCallback(async (endpoint: string) => {
    if (!context) return;
    setLoading(true);
    setError(null);

    try {
      if (endpoint === "explain-simple") {
        const res = await callExplainSimple(context.theme);
        setResult((prev) => ({ ...prev, helperContent: res.explanation }));
      } else if (endpoint === "explain-deep") {
        const res = await callExplainDeep(context.theme, context.subtopic);
        setResult((prev) => ({ ...prev, helperContent: `${res.explanation}\n\n**Raciocínio clínico:** ${res.clinicalReasoning}\n\n**Armadilhas:** ${res.pitfalls?.join(", ")}` }));
      } else if (endpoint === "summarize-topic") {
        const res = await callSummarizeTopic(context.theme);
        setResult((prev) => ({ ...prev, helperContent: res.summary }));
      }
    } catch (e: any) {
      setError(e.message || "Erro na ação rápida");
    } finally {
      setLoading(false);
    }
  }, [context]);

  /* ─── Reset ─── */
  const resetLoop = useCallback(() => {
    setPhase("idle");
    setContext(null);
    setResult(null);
    setError(null);
    reinforceCountRef.current = 0;
  }, []);

  return {
    phase,
    context,
    result,
    loading,
    error,
    startMission,
    beginExecution,
    submitAnswer,
    completeReview,
    continueLoop,
    loadNext,
    runQuickAction,
    resetLoop,
  };
}
