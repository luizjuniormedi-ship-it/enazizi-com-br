import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CognitiveHealth {
    overallRetention: number;
    recoverySuccessRate: number;
    fatigueScore: number;
    cognitivePressure: number;
    memoryDecayRate: number;
    overloadFlag: boolean;
    computedAt: string;
}

export interface RetentionMetric {
    topic: string;
    subtopic: string;
    predictedStability: number;
    realRetention: number;
    lapsesCount: number;
    lastReviewAt: string;
}

export function useCognitiveObservatory() {
    const { user } = useAuth();

    const healthQuery = useQuery({
        queryKey: ["cognitive-health", user?.id],
        enabled: !!user,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("cognitive_analytics")
                .select("*")
                .eq("user_id", user!.id)
                .order("computed_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            return {
                overallRetention: Number(data.overall_retention),
                recoverySuccessRate: Number(data.recovery_success_rate),
                fatigueScore: Number(data.fatigue_score),
                cognitivePressure: Number(data.cognitive_pressure),
                memoryDecayRate: Number(data.memory_decay_rate),
                overloadFlag: data.overload_flag,
                computedAt: data.computed_at
            } as CognitiveHealth;
        }
    });

    const retentionQuery = useQuery({
        queryKey: ["retention-metrics", user?.id],
        enabled: !!user,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("retention_metrics")
                .select("*")
                .eq("user_id", user!.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (error) throw error;

            return (data || []).map(row => ({
                topic: row.topic,
                subtopic: row.subtopic,
                predictedStability: Number(row.predicted_stability),
                realRetention: Number(row.real_retention),
                lapsesCount: row.lapses_count,
                lastReviewAt: row.last_review_at
            })) as RetentionMetric[];
        }
    });

    return {
        health: healthQuery.data,
        isLoadingHealth: healthQuery.isLoading,
        retention: retentionQuery.data,
        isLoadingRetention: retentionQuery.isLoading,
        refetch: () => {
            healthQuery.refetch();
            retentionQuery.refetch();
        }
    };
}
