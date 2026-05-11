/**
 * Dual-write utilities for migration.
 * Writes to new tables in parallel with legacy tables.
 * All operations are fire-and-forget to avoid blocking the UI.
 */
import { supabase } from "@/integrations/supabase/client";
import { ensureFsrsCard } from "@/lib/fsrsAutoCreate";

/**
 * Dual-write performance data to performance_by_topic table.
 * Called alongside medical_domain_map updates.
 */
export function dualWritePerformanceByTopic(params: {
  userId: string;
  specialty: string;
  topic: string;
  subtopic?: string;
  questionsAnswered: number;
  correctAnswers: number;
}): void {
  const { userId, specialty, topic, subtopic, questionsAnswered, correctAnswers } = params;
  const accuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;

  // Fire-and-forget — never blocks the caller
  (async () => {
    try {
      const { data: existing } = await supabase
        .from("performance_by_topic" as any)
        .select("id, total_questions, correct_questions")
        .eq("user_id", userId)
        .eq("specialty", specialty)
        .eq("topic", topic)
        .maybeSingle();

      if (existing) {
        const newTotal = (existing as any).total_questions + questionsAnswered;
        const newCorrect = (existing as any).correct_questions + correctAnswers;
        const newAccuracy = newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 0;
        await supabase
          .from("performance_by_topic" as any)
          .update({
            total_questions: newTotal,
            correct_questions: newCorrect,
            accuracy: newAccuracy,
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("performance_by_topic" as any)
          .insert({
            user_id: userId,
            specialty,
            topic,
            subtopic: subtopic || null,
            total_questions: questionsAnswered,
            correct_questions: correctAnswers,
            accuracy,
            last_activity_at: new Date().toISOString(),
          });
      }
    } catch (e) {
      console.warn("[DualWrite] performance_by_topic:", e);
    }
  })();
}

/**
 * Dual-write user topic profile data.
 * Called alongside study_performance updates.
 */
export function dualWriteUserTopicProfile(params: {
  userId: string;
  topic: string;
  specialty: string;
  questionsAnswered: number;
  correctAnswers: number;
  sessionAccuracy: number;
}): void {
  const { userId, topic, specialty, questionsAnswered, correctAnswers, sessionAccuracy } = params;

  (async () => {
    try {
      const { data: existing } = await supabase
        .from("user_topic_profiles" as any)
        .select("id, total_questions, correct_answers, accuracy, mastery_level")
        .eq("user_id", userId)
        .eq("topic", topic)
        .maybeSingle();

      if (existing) {
        const ex = existing as any;
        const newTotal = ex.total_questions + questionsAnswered;
        const newCorrect = ex.correct_answers + correctAnswers;
        const newAccuracy = newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 0;
        const mastery = newAccuracy >= 90 ? 5 : newAccuracy >= 75 ? 4 : newAccuracy >= 60 ? 3 : newAccuracy >= 40 ? 2 : 1;
        const confidence = newTotal >= 50 ? "high" : newTotal >= 20 ? "medium" : "low";

        await supabase
          .from("user_topic_profiles" as any)
          .update({
            total_questions: newTotal,
            correct_answers: newCorrect,
            accuracy: newAccuracy,
            mastery_level: mastery,
            confidence_level: confidence,
            last_practiced_at: new Date().toISOString(),
          })
          .eq("id", ex.id);
      } else {
        const mastery = sessionAccuracy >= 90 ? 5 : sessionAccuracy >= 75 ? 4 : sessionAccuracy >= 60 ? 3 : sessionAccuracy >= 40 ? 2 : 1;
        await supabase
          .from("user_topic_profiles" as any)
          .insert({
            user_id: userId,
            topic,
            specialty,
            total_questions: questionsAnswered,
            correct_answers: correctAnswers,
            accuracy: sessionAccuracy,
            confidence_level: "low",
            mastery_level: mastery,
            review_interval_days: 1,
            last_practiced_at: new Date().toISOString(),
          });

        // Auto-create FSRS card using temas_estudados UUID (stable ref)
        const { data: temaRow } = await supabase
          .from("temas_estudados")
          .select("id")
          .eq("user_id", userId)
          .eq("tema", topic)
          .maybeSingle();
        if (temaRow) {
          // FSRS cards are now created with initial stability = 1 in ChatGPT/Tutor sessions
          // ensureFsrsCard(userId, "tema", temaRow.id);
        }
      }
    } catch (e) {
      console.warn("[DualWrite] user_topic_profiles:", e);
    }
  })();
}

/**
 * Save Study Engine snapshot after each execution.
 */
export function saveStudyEngineSnapshot(params: {
  userId: string;
  approvalScore: number;
  phase: string;
  memoryPressure: number;
  pendingReviews: number;
  overdueReviews: number;
  contentLock: boolean;
  recoveryMode: boolean;
  heavyRecoveryActive: boolean;
  heavyRecoveryPhase: number;
  chanceScore?: number;
  weakTopics?: string[];
  strongTopics?: string[];
  prepIndex?: number;
}): void {
  (async () => {
    try {
      await supabase
        .from("study_engine_snapshots" as any)
        .insert({
          user_id: params.userId,
          approval_score: params.approvalScore,
          phase: params.phase,
          memory_pressure: params.memoryPressure,
          pending_reviews: params.pendingReviews,
          overdue_reviews: params.overdueReviews,
          content_lock: params.contentLock,
          recovery_mode: params.recoveryMode,
          heavy_recovery_active: params.heavyRecoveryActive,
          heavy_recovery_phase: params.heavyRecoveryPhase,
          chance_score: params.chanceScore || null,
          weak_topics: params.weakTopics ? JSON.stringify(params.weakTopics) : null,
          strong_topics: params.strongTopics ? JSON.stringify(params.strongTopics) : null,
          prep_index: params.prepIndex || null,
        });
    } catch (e) {
      console.warn("[DualWrite] study_engine_snapshots:", e);
    }
  })();
}
