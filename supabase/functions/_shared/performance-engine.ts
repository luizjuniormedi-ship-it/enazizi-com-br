/**
 * performance-engine.ts
 * Logic to update the performance_metrics table based on student outcomes.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface OutcomeData {
  userId: string;
  specialty: string;
  discipline?: string;
  topic?: string;
  isCorrect: boolean;
  responseTimeSeconds?: number;
  fsrsStability?: number;
  difficulty?: string;
}

export async function updatePerformanceMetrics(
  supabase: SupabaseClient,
  data: OutcomeData
) {
  const { userId, specialty, topic, isCorrect, fsrsStability } = data;
  
  // 1. Get existing metric or initialize
  const { data: existing } = await supabase
    .from("performance_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("specialty", specialty)
    .eq("topic", topic || "Geral")
    .maybeSingle();

  if (existing) {
    const total = existing.questions_answered + 1;
    const correctCount = Math.round((existing.accuracy_rate / 100) * existing.questions_answered) + (isCorrect ? 1 : 0);
    const newAccuracy = (correctCount / total) * 100;
    
    // Simple trend detection
    let trend = existing.trend;
    if (newAccuracy > existing.accuracy_rate + 2) trend = "improving";
    else if (newAccuracy < existing.accuracy_rate - 2) trend = "declining";
    else trend = "stable";

    // Mastery level based on accuracy
    let mastery = "beginner";
    if (newAccuracy >= 85) mastery = "expert";
    else if (newAccuracy >= 70) mastery = "proficient";
    else if (newAccuracy >= 50) mastery = "intermediate";

    await supabase
      .from("performance_metrics")
      .update({
        accuracy_rate: newAccuracy,
        questions_answered: total,
        fsrs_stability: fsrsStability || existing.fsrs_stability,
        mastery_level: mastery,
        trend: trend,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);
  } else {
    // Initialize new row
    await supabase
      .from("performance_metrics")
      .insert({
        user_id: userId,
        specialty: specialty,
        topic: topic || "Geral",
        accuracy_rate: isCorrect ? 100 : 0,
        questions_answered: 1,
        fsrs_stability: fsrsStability || 5,
        mastery_level: isCorrect ? "intermediate" : "beginner",
        trend: "stable",
        last_activity_at: new Date().toISOString()
      });
  }
}
