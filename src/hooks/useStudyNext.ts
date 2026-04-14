import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface StudyNextRecommendation {
  type: "review" | "error_review" | "daily_task" | "free_study" | "image_quiz" | "mnemonic";
  title: string;
  description: string;
  targetId?: string;
  targetType?: string;
  estimatedMinutes: number;
  priorityScore: number;
  /** Optional context from the engine for module-specific params */
  contextPayload?: Record<string, string>;
}

export interface AdaptiveState {
  approvalScore: number;
  approvalZone: string;
  recoveryActive: boolean;
  contentLocked: boolean;
  pendingReviews: number;
  weakTopicsCount: number;
  examProximityDays: number | null;
}

export interface StudyNextResponse {
  success: boolean;
  recommendation: StudyNextRecommendation;
  justification: string;
  alternativeActions: StudyNextRecommendation[];
  adaptiveState: AdaptiveState;
}

async function fetchStudyNext(): Promise<StudyNextResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const { data, error } = await supabase.functions.invoke("study-next", {
    body: { context: {} },
  });

  if (error) throw new Error(error.message || "Erro ao buscar recomendação");
  return data as StudyNextResponse;
}

export function useStudyNext() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["study-next", user?.id],
    queryFn: fetchStudyNext,
    enabled: !!user,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
    // Keep previous data while refetching — prevents flicker on mission transition
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["study-next"] });

  return { ...query, refresh };
}
