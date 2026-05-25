import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type MnemonicMode = "review_existing" | "regenerate" | "create_new";
export type MnemonicStyle = "visual" | "curto" | "engraçado" | "acadêmico";

export interface StudyNextRecommendation {
  type: "review" | "error_review" | "daily_task" | "free_study" | "image_quiz" | "mnemonic";
  title: string;
  description: string;
  targetId?: string;
  targetType?: string;
  estimatedMinutes: number;
  priorityScore: number;
  /** Optional context from the engine for module-specific params */
  contextPayload?: Record<string, string | number | boolean | undefined>;
}

export interface AdaptiveState {
  approvalScore: number;
  approvalZone: string;
  recoveryActive: boolean;
  contentLocked: boolean;
  pendingReviews: number;
  weakTopicsCount: number;
  examProximityDays: number | null;
  mnemonicCandidates?: number;
  mnemonicUtilityTopics?: number;
  justification?: string;
}

export interface StudyNextResponse {
  success: boolean;
  recommendation: StudyNextRecommendation;
  justification: string;
  alternativeActions: StudyNextRecommendation[];
  adaptiveState: AdaptiveState;
}

/** Helper to extract mnemonic-specific context from a recommendation */
export function getMnemonicContext(rec: StudyNextRecommendation) {
  if (rec.type !== "mnemonic" || !rec.contextPayload) return null;
  const ctx = rec.contextPayload;
  return {
    topic: ctx.topic as string | undefined,
    subtopic: ctx.subtopic as string | undefined,
    mnemonicMode: ctx.mnemonicMode as MnemonicMode | undefined,
    preferredStyle: ctx.preferredStyle as MnemonicStyle | undefined,
    resultId: ctx.resultId as string | undefined,
    utilityScore: ctx.utilityScore as number | undefined,
    errorCount: ctx.errorCount as number | undefined,
  };
}

async function fetchStudyNext(): Promise<StudyNextResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  console.debug("[StudyNext] Fetching recommendation...");
  const startTime = Date.now();

  try {
    // Add a manual timeout of 10s for the edge function
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const { data, error } = await supabase.functions.invoke("study-next", {
      body: { context: { traceId: crypto.randomUUID() } },
    });

    clearTimeout(timeoutId);

    if (error) throw new Error(error.message || "Erro ao buscar recomendação");
    
    console.debug(`[StudyNext] Recommendation received in ${Date.now() - startTime}ms`);

    if (data?.data) {
      return data.data as StudyNextResponse;
    }
    return data as StudyNextResponse;
  } catch (err: any) {
    console.warn("[StudyNext] Edge Function failed or timed out:", err?.message || err);
    // Return a safe fallback recommendation instead of throwing
    return {
      success: false,
      recommendation: {
        type: "free_study",
        title: "Continue seus estudos",
        description: "A IA está processando seu próximo passo. Continue de onde parou.",
        estimatedMinutes: 30,
        priorityScore: 0
      },
      justification: "Falha na sincronização cognitiva (fail-open)",
      alternativeActions: [],
      adaptiveState: {
        approvalScore: 0,
        approvalZone: "stable",
        recoveryActive: false,
        contentLocked: false,
        pendingReviews: 0,
        weakTopicsCount: 0,
        examProximityDays: null
      }
    };
  }
}

export function useStudyNext() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["study-next", user?.id],
    queryFn: fetchStudyNext,
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["study-next"] });

  return { ...query, refresh };
}
