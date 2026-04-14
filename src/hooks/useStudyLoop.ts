import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { StudyNextRecommendation } from "./useStudyNext";

/* ─── Loop states ─── */
export type LoopPhase = "idle" | "intro" | "running" | "feedback" | "next" | "complete";

export interface LoopContext {
  recommendation: StudyNextRecommendation;
  /** Resolved theme — prefers targetId > targetType > title */
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
  /** True when max reinforcement cycles were exhausted */
  maxReinforcementsReached?: boolean;
  /** Completion chips for visual feedback */
  completionBadges?: string[];
}

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
}

/** Tracks what failed so retry can re-invoke correctly */
type LastAction =
  | { kind: "beginExecution" }
  | { kind: "submitAnswer"; answer: string }
  | { kind: "completeReview" }
  | { kind: "quickAction"; endpoint: string };

/* ─── Helpers ─── */

/** Resolve the best theme identifier from a recommendation */
function resolveTheme(rec: StudyNextRecommendation): string {
  // Prefer explicit IDs over display title
  return rec.targetId || rec.targetType || rec.title || "unknown";
}

/** Build a study-complete payload aligned with the edge function contract */
function buildCompletePayload(
  ctx: LoopContext,
  wasCorrect: boolean,
  extra?: { questionId?: string; durationSeconds?: number },
) {
  const rec = ctx.recommendation;
  return {
    actionType: rec.type,            // "review" | "error_review" | "daily_task" | "free_study"
    actionId: rec.targetId || undefined,
    taskId: rec.type === "daily_task" ? rec.targetId : undefined,
    themeId: ctx.theme,
    topicId: ctx.theme,
    subtopicId: ctx.subtopic || undefined,
    questionId: extra?.questionId || undefined,
    wasCorrect,
    durationSeconds: extra?.durationSeconds || undefined,
    metadata: {
      source: "mission_control",
      originModule: "study_loop",
      recommendationType: rec.type,
      theme: ctx.theme,
      subtopic: ctx.subtopic || "",
      title: rec.title,
    },
  };
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
  const lastActionRef = useRef<LastAction | null>(null);

  /* ─── Start mission ─── */
  const startMission = useCallback((rec: StudyNextRecommendation) => {
    const theme = resolveTheme(rec);
    setContext({ recommendation: rec, theme, subtopic: rec.targetType !== theme ? rec.targetType : undefined });
    setResult(null);
    setError(null);
    reinforceCountRef.current = 0;
    lastActionRef.current = null;
    setPhase("intro");
  }, []);

  /* ─── Begin execution after intro ─── */
  const beginExecution = useCallback(async () => {
    if (!context) return;
    setPhase("running");
    setLoading(true);
    setError(null);
    lastActionRef.current = { kind: "beginExecution" };

    try {
      const rec = context.recommendation;

      if (rec.type === "error_review") {
        const reinforcement = await callReinforceError(context.theme);
        const question = await callGenerateQuestion(context.theme, context.subtopic, "medium", { fromError: true });
        setResult({ reinforcement, generatedQuestion: question });
      } else if (rec.type === "review") {
        const summary = await callSummarizeTopic(context.theme);
        setResult({ summaryContent: summary.summary, helperContent: null });
      } else {
        // daily_task + free_study
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
    lastActionRef.current = { kind: "submitAnswer", answer: userAnswer };

    const correct = userAnswer.trim().toUpperCase() === result.generatedQuestion.correctAnswer.trim().toUpperCase();

    try {
      await callStudyComplete(buildCompletePayload(context, correct));

      if (!correct && reinforceCountRef.current < 2) {
        reinforceCountRef.current += 1;
        const reinforcement = await callReinforceError(context.theme, "", userAnswer);
        const newQuestion = await callGenerateQuestion(context.theme, context.subtopic, "easy", { fromError: true });
        setResult((prev) => ({
          ...prev,
          correct: false,
          reinforcement,
          generatedQuestion: newQuestion,
          explanation: result.generatedQuestion!.explanation,
          maxReinforcementsReached: false,
        }));
        setPhase("feedback");
      } else if (!correct) {
        // Max reinforcements reached — elegant exit
        setResult((prev) => ({
          ...prev,
          correct: false,
          explanation: result.generatedQuestion!.explanation,
          reinforcement: undefined,
          generatedQuestion: null,
          maxReinforcementsReached: true,
          completionBadges: ["Tema revisado", "Reforço aplicado"],
        }));
        setPhase("feedback");
      } else {
        // Correct
        setResult((prev) => ({
          ...prev,
          correct: true,
          explanation: result.generatedQuestion!.explanation,
          reinforcement: undefined,
          generatedQuestion: null,
          maxReinforcementsReached: false,
          completionBadges: buildCompletionBadges(context, true),
        }));
        setPhase("feedback");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao processar resposta");
    } finally {
      setLoading(false);
    }
  }, [context, result]);

  /* ─── Complete review step ─── */
  const completeReview = useCallback(async () => {
    if (!context) return;
    setLoading(true);
    setError(null);
    lastActionRef.current = { kind: "completeReview" };

    try {
      await callStudyComplete(buildCompletePayload(context, true));
      setResult((prev) => ({
        ...prev,
        correct: true,
        completionBadges: buildCompletionBadges(context, true),
      }));
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
      await queryClient.invalidateQueries({ queryKey: ["study-next"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
      setPhase("complete");
    } catch (e: any) {
      setError(e.message || "Erro ao carregar próxima missão");
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /* ─── Continue after feedback ─── */
  const continueLoop = useCallback(async () => {
    if (!result) {
      await loadNext();
      return;
    }

    // If there's a new question from the error flow, go back to running
    if (!result.correct && result.generatedQuestion && !result.maxReinforcementsReached) {
      setPhase("running");
      return;
    }

    // Otherwise load next mission
    await loadNext();
  }, [result, loadNext]);

  /* ─── Contextual retry ─── */
  const retry = useCallback(async () => {
    const last = lastActionRef.current;
    if (!last) {
      // Fallback: re-begin
      await beginExecution();
      return;
    }
    setError(null);
    switch (last.kind) {
      case "beginExecution":
        await beginExecution();
        break;
      case "submitAnswer":
        await submitAnswer(last.answer);
        break;
      case "completeReview":
        await completeReview();
        break;
      case "quickAction":
        await runQuickAction(last.endpoint);
        break;
    }
  }, [/* deps added below via the actual refs */]);

  /* ─── Quick action helpers ─── */
  const runQuickAction = useCallback(async (endpoint: string) => {
    if (!context) return;
    setLoading(true);
    setError(null);
    lastActionRef.current = { kind: "quickAction", endpoint };

    try {
      if (endpoint === "explain-simple") {
        const res = await callExplainSimple(context.theme);
        setResult((prev) => ({ ...prev, helperContent: res.explanation }));
      } else if (endpoint === "explain-deep") {
        const res = await callExplainDeep(context.theme, context.subtopic);
        setResult((prev) => ({
          ...prev,
          helperContent: `${res.explanation}\n\n**Raciocínio clínico:** ${res.clinicalReasoning}\n\n**Armadilhas:** ${res.pitfalls?.join(", ")}`,
        }));
      } else if (endpoint === "summarize-topic") {
        const res = await callSummarizeTopic(context.theme);
        setResult((prev) => ({ ...prev, helperContent: res.summary }));
      } else if (endpoint === "reinforce-error") {
        const res = await callReinforceError(context.theme);
        setResult((prev) => ({
          ...prev,
          helperContent: `**Explicação:** ${res.explanation}\n\n**Correção:** ${res.correction}\n\n💡 ${res.tip}`,
        }));
      } else if (endpoint === "generate-adaptive-question") {
        const question = await callGenerateQuestion(context.theme, context.subtopic);
        setResult((prev) => ({ ...prev, generatedQuestion: question, helperContent: null }));
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
    lastActionRef.current = null;
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
    retry,
    resetLoop,
  };
}

/* ─── Helpers ─── */
function buildCompletionBadges(ctx: LoopContext, correct: boolean): string[] {
  const badges: string[] = [];
  const type = ctx.recommendation.type;
  if (correct) badges.push("✅ Acerto registrado");
  if (type === "review") badges.push("🔄 Revisão concluída");
  if (type === "error_review") badges.push("🔴 Erro corrigido");
  if (type === "daily_task") badges.push("📋 Tarefa do dia concluída");
  badges.push("📊 Progresso atualizado");
  return badges;
}
