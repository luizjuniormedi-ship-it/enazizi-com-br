import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CockpitWeakness {
  tema: string;
  subtema: string | null;
  erros: number;
  dificuldade: number | null;
  ultimo: string;
}

export interface CockpitMnemonic {
  result_id: string;
  tema: string;
  feedback_count: number;
  avg_utility: number;
  avg_rating: number;
  positive_count: number;
  negative_count: number;
}

export interface CockpitVisualWeak {
  image_type: string;
  accuracy: number;
  score: number;
  trend: string;
  attempts_count: number;
  weakest_area: string | null;
}

export interface CockpitAlert {
  kind: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export interface CockpitNextStep {
  id: string;
  title: string;
  cta: string;
  route: string;
  priority: "primary" | "secondary" | "quick";
}

export interface CockpitData {
  topWeaknesses: CockpitWeakness[];
  mnemUseful: CockpitMnemonic[];
  mnemBad: CockpitMnemonic[];
  fsrsDueCount: number;
  fsrsTotalCards: number;
  avgStability: number;
  totalLapses: number;
  revisoesPending: number;
  accuracy7d: number;
  questions7d: number;
  correct7d: number;
  radar: {
    mnemonicos: number;
    quizVisual: number;
    questoes: number;
    revisaoFsrs: number;
    simulados: number;
    tutorIa: number;
  };
  visualWeaknesses: CockpitVisualWeak[];
  alerts: CockpitAlert[];
  nextSteps: CockpitNextStep[];
  cognitiveProfile: {
    bestMnemonicTema: string | null;
    worstMnemonicTema: string | null;
    strongestModality: string | null;
    weakestModality: string | null;
    avgMnemonicScore: number;
    mnemonicsCreated: number;
  };
  feedbackCount7d: number;
}

export function useCockpitData() {
  const { user } = useAuth();

  return useQuery<CockpitData>({
    queryKey: ["cockpit-data", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("cockpit-data");
      if (error) throw error;
      return data as CockpitData;
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}
