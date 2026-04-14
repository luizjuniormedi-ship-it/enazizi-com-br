/**
 * Study Loop Tracking — fire-and-forget telemetry
 * Writes to study_loop_events + upserts user_engagement_daily
 */
import { supabase } from "@/integrations/supabase/client";

export type LoopEventType =
  | "loop_start"
  | "loop_complete"
  | "loop_abandon"
  | "answer_correct"
  | "answer_wrong"
  | "quick_action"
  | "error"
  | "reinforcement"
  | "elegant_exit";

interface TrackLoopEventParams {
  userId: string;
  sessionId?: string;
  eventType: LoopEventType;
  recommendationType?: string;
  theme?: string;
  subtopic?: string;
  targetId?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget: insert one event row */
export function trackLoopEvent(params: TrackLoopEventParams): void {
  const { userId, sessionId, eventType, recommendationType, theme, subtopic, targetId, durationSeconds, metadata } = params;
  supabase
    .from("study_loop_events" as any)
    .insert({
      user_id: userId,
      session_id: sessionId || null,
      event_type: eventType,
      recommendation_type: recommendationType || null,
      theme: theme || null,
      subtopic: subtopic || null,
      target_id: targetId || null,
      duration_seconds: durationSeconds || null,
      metadata: metadata || {},
    })
    .then(({ error }) => {
      if (error) console.warn("[LoopTracking] insert failed:", error.message);
    });
}

/** Fire-and-forget: increment daily engagement counters */
export function incrementDailyEngagement(
  userId: string,
  increments: Partial<Record<
    "loops_started" | "loops_completed" | "loops_abandoned" |
    "questions_answered" | "questions_correct" | "quick_actions_used" |
    "total_study_seconds" | "reinforcements_triggered" | "elegant_exits" |
    "errors_encountered" | "sessions_count",
    number
  >>,
): void {
  const today = new Date().toISOString().slice(0, 10);

  // Try upsert: insert if not exists, otherwise we need to read + update
  // Since we can't do atomic increment via PostgREST, use a simple approach:
  // 1. Try insert with the increments as initial values
  // 2. On conflict, read current + update
  (async () => {
    try {
      const { data: existing } = await (supabase as any)
        .from("user_engagement_daily")
        .select("id, loops_started, loops_completed, loops_abandoned, questions_answered, questions_correct, quick_actions_used, total_study_seconds, reinforcements_triggered, elegant_exits, errors_encountered, sessions_count")
        .eq("user_id", userId)
        .eq("metric_date", today)
        .maybeSingle();

      if (existing) {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [key, val] of Object.entries(increments)) {
          updates[key] = (existing[key] || 0) + (val || 0);
        }
        await (supabase as any)
          .from("user_engagement_daily")
          .update(updates)
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("user_engagement_daily")
          .insert({
            user_id: userId,
            metric_date: today,
            ...increments,
          });
      }
    } catch (e) {
      console.warn("[LoopTracking] daily engagement update failed:", e);
    }
  })();
}
