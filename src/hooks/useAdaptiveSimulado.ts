import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──

export interface AdaptiveQuestion {
  statement: string;
  options: string[];
  correct: number;
  explanation: string;
  rationale_map?: Record<string, string>;
  image_url: string | null;
  image_type: string;
  topic: string;
  subtopic?: string;
  difficulty: string;
  exam_style: string;
  _isImageQuestion: boolean;
  _source?: string;
  _editorialGrade?: string;
}

export interface AdaptiveMeta {
  focus: string;
  strategy: string;
  weakness_targeted: string;
  distribution: {
    modalities: Record<string, number>;
    difficulty: Record<string, number>;
    exam_style: Record<string, number>;
  };
}

export interface ModalityPerformance {
  by_modality: Record<string, number>;
  by_difficulty: Record<string, number>;
  response_time: Record<string, number>;
  error_patterns: string[];
}

interface UseAdaptiveSimuladoReturn {
  questions: AdaptiveQuestion[];
  meta: AdaptiveMeta | null;
  isLoading: boolean;
  error: string | null;
  performance: ModalityPerformance | null;
  generateAdaptive: (targetCount?: number) => Promise<void>;
  fetchPerformance: (userId: string) => Promise<ModalityPerformance>;
}

// ── Fetch real performance from simulado_question_analytics ──

async function computeRealPerformance(userId: string): Promise<ModalityPerformance> {
  const { data: rows } = await (supabase as any)
    .from("simulado_question_analytics")
    .select("mode, image_type, is_correct, response_time_seconds, difficulty")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const analytics = (rows || []) as Array<{
    mode: string;
    image_type: string | null;
    is_correct: boolean;
    response_time_seconds: number | null;
    difficulty: string | null;
  }>;

  // by_modality: accuracy per image_type
  const modalityStats: Record<string, { correct: number; total: number }> = {};
  const modalityTimes: Record<string, number[]> = {};
  const diffStats: Record<string, { correct: number; total: number }> = {};
  const errorTopics: Record<string, number> = {};

  for (const row of analytics) {
    const mod = row.image_type || "ecg";
    if (!modalityStats[mod]) modalityStats[mod] = { correct: 0, total: 0 };
    modalityStats[mod].total++;
    if (row.is_correct) modalityStats[mod].correct++;

    if (row.response_time_seconds && row.response_time_seconds > 0) {
      if (!modalityTimes[mod]) modalityTimes[mod] = [];
      modalityTimes[mod].push(row.response_time_seconds);
    }

    const diff = row.difficulty || "medium";
    if (!diffStats[diff]) diffStats[diff] = { correct: 0, total: 0 };
    diffStats[diff].total++;
    if (row.is_correct) diffStats[diff].correct++;

    if (!row.is_correct && row.image_type) {
      errorTopics[row.image_type] = (errorTopics[row.image_type] || 0) + 1;
    }
  }

  const by_modality: Record<string, number> = {};
  for (const [mod, stats] of Object.entries(modalityStats)) {
    by_modality[mod] = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 50;
  }

  const by_difficulty: Record<string, number> = {};
  for (const [diff, stats] of Object.entries(diffStats)) {
    by_difficulty[diff] = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 50;
  }

  const response_time: Record<string, number> = {};
  for (const [mod, times] of Object.entries(modalityTimes)) {
    response_time[mod] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  // Top 3 error modalities as patterns
  const error_patterns = Object.entries(errorTopics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([mod]) => mod);

  return { by_modality, by_difficulty, response_time, error_patterns };
}

// ── Hook ──

export function useAdaptiveSimulado(): UseAdaptiveSimuladoReturn {
  const [questions, setQuestions] = useState<AdaptiveQuestion[]>([]);
  const [meta, setMeta] = useState<AdaptiveMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<ModalityPerformance | null>(null);

  const fetchPerformance = useCallback(async (userId: string) => {
    const perf = await computeRealPerformance(userId);
    setPerformance(perf);
    return perf;
  }, []);

  const generateAdaptive = useCallback(async (targetCount = 20) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-adaptive-simulado",
        {
          body: {
            target_question_count: targetCount,
            performance: performance || undefined,
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Falha na geração adaptativa");

      setQuestions(data.questions || []);
      setMeta(data.meta || null);

      const total = data.questions?.length || 0;
      const generated = data.questions?.filter((q: any) => q._source === "generated").length || 0;
      toast.success(`${total} questões adaptativas carregadas (${generated} novas via IA)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setError(msg);
      toast.error(`Erro no simulado adaptativo: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [performance]);

  return { questions, meta, isLoading, error, performance, generateAdaptive, fetchPerformance };
}
