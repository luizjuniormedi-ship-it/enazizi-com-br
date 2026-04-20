import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type EvolutionStatus = "melhorando" | "estavel" | "reforcar";

export interface TopicEvolution {
  topic: string;
  specialty: string;
  status: EvolutionStatus;
  label: string;
  /** Current accuracy 0-100 */
  accuracy: number;
  /** Delta vs older attempts (positive = improving) */
  delta: number;
}

/**
 * Computes per-topic evolution status by comparing recent vs older performance.
 * Uses performance_unified (read-only view) + error_bank + revisoes for a stable signal.
 * Requires ≥3 attempts to avoid noise from single questions.
 */
export function useTopicEvolution() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["topic-evolution-status", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async (): Promise<TopicEvolution[]> => {
      const userId = user!.id;

      // Fetch performance records ordered by date (unified view)
      // IMPORTANT: only 'simulado' source carries a real measured accuracy per topic.
      // 'fsrs' rows use tema='fsrs' literal and 'error_bank' rows have taxa_acerto=0
      // hardcoded — both would poison topic-level evolution grouping.
      const [perfRes, errorRes, reviewRes] = await Promise.all([
        supabase
          .from("performance_unified" as any)
          .select("tema, subtema, taxa_acerto, questoes_feitas, data_registro, source")
          .eq("user_id", userId)
          .eq("source", "simulado")
          .order("data_registro", { ascending: true })
          .limit(500),
        supabase
          .from("error_bank")
          .select("tema, vezes_errado, dominado")
          .eq("user_id", userId)
          .eq("dominado", false),
        supabase
          .from("revisoes")
          .select("tema_id, status, temas_estudados(tema)")
          .eq("user_id", userId)
          .eq("status", "concluida")
          .limit(200),
      ]);

      const perfData = (perfRes.data || []) as any[];
      const errors = (errorRes.data || []) as any[];
      const reviews = (reviewRes.data || []) as any[];

      // Group performance by topic (unified view exposes tema/subtema directly).
      // Defensive guards: skip non-clinical sentinel values from the view.
      const topicPerf: Record<string, { accuracies: number[]; specialty: string }> = {};
      for (const p of perfData) {
        const tema = p.tema;
        const spec = p.subtema || "Geral";
        if (!tema || tema === "fsrs" || tema === "desconhecido") continue;
        const acc = Number(p.taxa_acerto);
        if (!Number.isFinite(acc)) continue;
        if (!topicPerf[tema]) topicPerf[tema] = { accuracies: [], specialty: spec };
        topicPerf[tema].accuracies.push(acc);
      }

      // Error map
      const errorMap: Record<string, number> = {};
      for (const e of errors) {
        errorMap[e.tema] = (errorMap[e.tema] || 0) + (e.vezes_errado || 1);
      }

      // Review completion count per topic
      const reviewCount: Record<string, number> = {};
      for (const r of reviews) {
        const tema = r.temas_estudados?.tema;
        if (!tema) continue;
        reviewCount[tema] = (reviewCount[tema] || 0) + 1;
      }

      const results: TopicEvolution[] = [];

      for (const [topic, data] of Object.entries(topicPerf)) {
        const accs = data.accuracies;
        if (accs.length < 3) continue; // Need minimum data

        // Split into older half and recent half
        const mid = Math.floor(accs.length / 2);
        const olderAvg = accs.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
        const recentAvg = accs.slice(mid).reduce((s, v) => s + v, 0) / (accs.length - mid);
        const delta = recentAvg - olderAvg;
        const currentAccuracy = Math.round(recentAvg);

        const errorCount = errorMap[topic] || 0;
        const reviewsDone = reviewCount[topic] || 0;

        // Determine status with hysteresis to avoid flapping
        let status: EvolutionStatus;
        let label: string;

        if (delta >= 8 || (delta >= 3 && reviewsDone >= 2)) {
          status = "melhorando";
          label = "Você melhorou neste tema";
        } else if (delta <= -8 || (errorCount >= 3 && currentAccuracy < 50)) {
          status = "reforcar";
          label = "Esse ponto ainda precisa de reforço";
        } else {
          status = "estavel";
          label = "Seu desempenho está mais consistente";
        }

        results.push({
          topic,
          specialty: data.specialty,
          status,
          label,
          accuracy: currentAccuracy,
          delta: Math.round(delta),
        });
      }

      // Sort: reforcar first, then melhorando, then estavel
      const order: Record<EvolutionStatus, number> = { reforcar: 0, melhorando: 1, estavel: 2 };
      results.sort((a, b) => order[a.status] - order[b.status]);

      return results;
    },
  });
}

/** Get evolution status for a specific topic (for micro-indicators) */
export function getEvolutionForTopic(
  evolutions: TopicEvolution[] | undefined,
  topic: string
): TopicEvolution | undefined {
  if (!evolutions) return undefined;
  return evolutions.find(
    (e) => e.topic.toLowerCase() === topic.toLowerCase()
  );
}

/** Status display config */
export const EVOLUTION_CONFIG: Record<EvolutionStatus, {
  emoji: string;
  color: string;
  bgColor: string;
  shortLabel: string;
}> = {
  melhorando: {
    emoji: "📈",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    shortLabel: "Melhorando",
  },
  estavel: {
    emoji: "➡️",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    shortLabel: "Estável",
  },
  reforcar: {
    emoji: "⚠️",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    shortLabel: "Reforçar",
  },
};
