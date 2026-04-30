/**
 * useVideoSegmentAnalytics — FASE 2 Adaptive Video
 *
 * Agrega eventos da tabela `video_segment_events` por segmento e calcula
 * indicadores básicos para Smart Replay:
 *   - watchedSeconds (estimado por play/pause/heartbeat)
 *   - replayCount
 *   - tutorOpenCount
 *   - abandonCount
 *   - quizCompleteCount
 *   - difficultyLikely (heurística)
 *
 * Heurística inicial (Smart Replay v1):
 *   replay >= 2  OU  abandon >= 1  OU  tutor_open >= 2  → difficultyLikely=true
 *
 * Gatilhos de feature flag:
 *   - smart_replay_enabled: se OFF → `difficultyLikely` sempre false (UI esconde sugestões)
 *   - multimodal_analytics_enabled: se OFF → não consulta a tabela (retorna mapa vazio)
 *
 * Compatível com vídeos sem segmentação: chave especial "__single__" agrega tudo.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export interface SegmentAnalytics {
  segmentId: string | null;
  playCount: number;
  pauseCount: number;
  replayCount: number;
  abandonCount: number;
  tutorOpenCount: number;
  quizCompleteCount: number;
  totalWatchedMs: number;
  difficultyLikely: boolean;
  difficultyReasons: string[];
}

const SINGLE_KEY = "__single__";

export function useVideoSegmentAnalytics(videoLessonId: string | undefined) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const analyticsOn = isEnabled("multimodal_analytics_enabled");
  const smartReplayOn = isEnabled("smart_replay_enabled");

  const query = useQuery({
    queryKey: ["video-segment-analytics", videoLessonId, user?.id],
    enabled: !!videoLessonId && !!user && analyticsOn,
    queryFn: async (): Promise<Record<string, SegmentAnalytics>> => {
      const { data, error } = await supabase
        .from("video_segment_events")
        .select("segment_id, event_type, duration_ms")
        .eq("video_lesson_id", videoLessonId!)
        .eq("user_id", user!.id);

      if (error) {
        console.warn("[useVideoSegmentAnalytics] fetch error", error.message);
        return {};
      }

      const map = new Map<string, SegmentAnalytics>();
      const ensure = (segId: string | null): SegmentAnalytics => {
        const key = segId ?? SINGLE_KEY;
        let entry = map.get(key);
        if (!entry) {
          entry = {
            segmentId: segId,
            playCount: 0,
            pauseCount: 0,
            replayCount: 0,
            abandonCount: 0,
            tutorOpenCount: 0,
            quizCompleteCount: 0,
            totalWatchedMs: 0,
            difficultyLikely: false,
            difficultyReasons: [],
          };
          map.set(key, entry);
        }
        return entry;
      };

      for (const row of data ?? []) {
        const e = ensure(row.segment_id);
        switch (row.event_type) {
          case "play": e.playCount++; break;
          case "pause": e.pauseCount++; break;
          case "replay": e.replayCount++; break;
          case "abandon": e.abandonCount++; break;
          case "tutor_open": e.tutorOpenCount++; break;
          case "quiz_complete": e.quizCompleteCount++; break;
        }
        if (row.duration_ms && row.duration_ms > 0) {
          e.totalWatchedMs += row.duration_ms;
        }
      }

      // Heurística Smart Replay (apenas se flag ON)
      if (smartReplayOn) {
        for (const entry of map.values()) {
          const reasons: string[] = [];
          if (entry.replayCount >= 2) reasons.push("replay_high");
          if (entry.abandonCount >= 1) reasons.push("abandoned");
          if (entry.tutorOpenCount >= 2) reasons.push("tutor_repeated");
          entry.difficultyReasons = reasons;
          entry.difficultyLikely = reasons.length > 0;
        }
      }

      const obj: Record<string, SegmentAnalytics> = {};
      map.forEach((v, k) => { obj[k] = v; });
      return obj;
    },
    staleTime: 30_000,
  });

  const getForSegment = (segmentId: string | null | undefined): SegmentAnalytics | null => {
    if (!query.data) return null;
    return query.data[segmentId ?? SINGLE_KEY] ?? null;
  };

  return {
    analytics: query.data ?? {},
    getForSegment,
    isLoading: query.isLoading,
    refetch: query.refetch,
    smartReplayEnabled: smartReplayOn,
    analyticsEnabled: analyticsOn,
  };
}
