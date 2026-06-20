import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  CompleteSessionResult,
  ConsolidationStep,
  MemoryConsolidationSession,
  StartConsolidationInput,
} from "@/types/memoryConsolidation";

type Prompts = Record<ConsolidationStep, string>;

interface State {
  session: MemoryConsolidationSession | null;
  prompts: Prompts | null;
  loading: boolean;
  error: string | null;
  result: CompleteSessionResult | null;
}

/**
 * Hook do Memory Consolidation Engine (Sprint 1).
 * Não dispara nada automaticamente — é o componente que chama start/respond/complete.
 */
export function useMemoryConsolidation() {
  const [state, setState] = useState<State>({
    session: null,
    prompts: null,
    loading: false,
    error: null,
    result: null,
  });

  const invoke = useCallback(async <T,>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("memory-consolidation", { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as T;
  }, []);

  const start = useCallback(
    async (input: StartConsolidationInput) => {
      setState((s) => ({ ...s, loading: true, error: null, result: null }));
      try {
        const data = await invoke<{ session: MemoryConsolidationSession; prompts: Prompts }>({
          action: "start",
          ...input,
        });
        setState({ session: data.session, prompts: data.prompts, loading: false, error: null, result: null });
        return data;
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
        throw e;
      }
    },
    [invoke],
  );

  const respond = useCallback(
    async (step: ConsolidationStep, response: string, confidence_value?: number) => {
      const session_id = state.session?.id;
      if (!session_id) throw new Error("Sessão de consolidação não iniciada");
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await invoke<{ score: number; feedback: string }>({
          action: "step",
          session_id,
          step,
          response,
          confidence_value,
        });
        setState((s) => ({ ...s, loading: false }));
        return data;
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
        throw e;
      }
    },
    [invoke, state.session?.id],
  );

  const complete = useCallback(async () => {
    const session_id = state.session?.id;
    if (!session_id) throw new Error("Sessão de consolidação não iniciada");
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await invoke<CompleteSessionResult>({ action: "complete", session_id });
      setState((s) => ({ ...s, loading: false, result: data }));
      return data;
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
      throw e;
    }
  }, [invoke, state.session?.id]);

  const reset = useCallback(() => {
    setState({ session: null, prompts: null, loading: false, error: null, result: null });
  }, []);

  return { ...state, start, respond, complete, reset };
}
