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
  longPauseCount: number; // FASE 2.1
  replayCount: number;
  abandonCount: number;
  tutorOpenCount: number;
  quizCompleteCount: number;
  quizErrorCount: number; // FASE 2.1
  completionRate: number; // FASE 2.1
  totalWatchedMs: number;
  difficultyLikely: boolean;
  difficultyLevel: "baixa" | "média" | "alta"; // FASE 2.1
  difficultyReasons: string[];
  suggestedActions: string[]; // FASE 2.1
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
            longPauseCount: 0,
            replayCount: 0,
            abandonCount: 0,
            tutorOpenCount: 0,
            quizCompleteCount: 0,
            quizErrorCount: 0,
            completionRate: 0,
            totalWatchedMs: 0,
            difficultyLikely: false,
            difficultyLevel: "baixa",
            difficultyReasons: [],
            suggestedActions: [],
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
          case "quiz_error": e.quizErrorCount++; break;
          case "long_pause": e.longPauseCount++; break;
        }
        if (row.duration_ms && row.duration_ms > 0) {
          e.totalWatchedMs += row.duration_ms;
        }
      }

      // Heurística Smart Replay v2.1
      if (smartReplayOn) {
        for (const entry of map.values()) {
          const reasons: string[] = [];
          if (entry.replayCount >= 2) reasons.push("replay_high");
          if (entry.abandonCount >= 1) reasons.push("abandoned");
          if (entry.tutorOpenCount >= 2) reasons.push("tutor_repeated");
          if (entry.quizErrorCount >= 1) reasons.push("quiz_errors");
          if (entry.longPauseCount >= 1) reasons.push("long_pause");
          
          entry.difficultyReasons = reasons;
          entry.difficultyLikely = reasons.length > 0;

          // Define nível de dificuldade
          const score = (entry.replayCount * 2) + (entry.tutorOpenCount * 1.5) + (entry.quizErrorCount * 3) + (entry.longPauseCount * 1);
          if (score >= 10 || entry.abandonCount > 0) {
            entry.difficultyLevel = "alta";
          } else if (score >= 4) {
            entry.difficultyLevel = "média";
          } else {
            entry.difficultyLevel = "baixa";
          }

          // Ações sugeridas
          const actions: string[] = [];
          if (entry.difficultyLikely) {
            actions.push("revisar_trecho");
            actions.push("abrir_tutor");
          }
          if (entry.quizErrorCount > 0) {
            actions.push("fazer_quiz_rapido");
          }
          if (entry.difficultyLevel === "alta") {
            actions.push("revisar_flashcards_fsrs");
          }
          entry.suggestedActions = actions;
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
