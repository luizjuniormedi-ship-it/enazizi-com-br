/**
 * useVideoSegmentEvents — FASE 1 Adaptive Video
 *
 * Hook leve para registrar interações granulares no player de videoaulas
 * (play, pause, replay, abandon, tutor_open, quiz_complete, seek).
 *
 * Comportamento de segurança:
 *  - Se a flag `multimodal_analytics_enabled` estiver OFF → no-op silencioso.
 *  - Falhas de rede/RLS são engolidas (console.warn) — UI nunca quebra.
 *  - Compatível com videoaulas v1.5 sem segmentação (segment_id opcional).
 */
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export type VideoEventType =
  | "play"
  | "pause"
  | "replay"
  | "abandon"
  | "tutor_open"
  | "quiz_complete"
  | "quiz_error"
  | "long_pause"
  | "flashcard_view"
  | "seek"
  | "complete";

export interface LogVideoEventArgs {
  videoLessonId: string;
  segmentId?: string | null;
  eventType: VideoEventType;
  timestampSeconds?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}

export function useVideoSegmentEvents() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  // Anti-spam: dedupe eventos idênticos em < 1.5s (ex: pause repetido)
  const lastEventRef = useRef<Map<string, number>>(new Map());

  const logEvent = useCallback(
    async (args: LogVideoEventArgs) => {
      if (!user) return;
      // Flag-gated: se analytics multimodais OFF, não grava nada
      if (!isEnabled("multimodal_analytics_enabled")) return;

      const dedupeKey = `${args.videoLessonId}::${args.segmentId ?? "none"}::${args.eventType}::${Math.floor((args.timestampSeconds ?? 0) / 2)}`;
      const now = Date.now();
      const last = lastEventRef.current.get(dedupeKey) ?? 0;
      if (now - last < 1500) return;
      lastEventRef.current.set(dedupeKey, now);

      try {
        const { error } = await supabase.from("video_segment_events").insert([
          {
            user_id: user.id,
            video_lesson_id: args.videoLessonId,
            segment_id: args.segmentId ?? null,
            event_type: args.eventType,
            timestamp_seconds: args.timestampSeconds ?? null,
            duration_ms: args.durationMs ?? null,
            metadata: (args.metadata ?? {}) as never,
          },
        ]);
        if (error) {
          console.warn("[useVideoSegmentEvents] insert failed:", error.message);
        }
      } catch (e) {
        console.warn("[useVideoSegmentEvents] exception:", e);
      }
    },
    [user, isEnabled]
  );

  return { logEvent, analyticsEnabled: isEnabled("multimodal_analytics_enabled") };
}
