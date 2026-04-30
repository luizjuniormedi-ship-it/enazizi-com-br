/**
 * useTutorTemporalContext — FASE 2 Adaptive Video
 *
 * Constrói o payload contextual usado para abrir o Tutor IA num timestamp
 * específico de uma videoaula. Persiste o snapshot em sessionStorage para
 * que a tela do Tutor IA leia sem precisar refazer a query.
 *
 * Gatilho de feature flag:
 *   - tutor_temporal_enabled: se OFF → `buildContext` retorna null e o
 *     consumidor deve cair no fluxo padrão (Tutor IA sem contexto temporal).
 */
import { useCallback } from "react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export interface TutorTemporalPayload {
  video_lesson_id: string;
  segment_id: string | null;
  current_timestamp: number;
  segment_title: string | null;
  segment_summary: string | null;
  segment_key_points: string[];
  specialty: string | null;
  topic: string | null;
  subtopic: string | null;
  tutor_lesson_summary: string | null;
}

const STORAGE_KEY = "enazizi:tutor:temporal-context";

export interface BuildArgs {
  videoLessonId: string;
  segment: {
    id: string | null;
    title?: string | null;
    summary?: string | null;
    key_points?: unknown;
  } | null;
  currentTimestamp: number;
  lesson: {
    specialty?: string | null;
    topic?: string | null;
    subtopic?: string | null;
    tutor_lesson_summary?: string | null;
  };
}

function normalizeKeyPoints(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(x => typeof x === "string") as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

export function useTutorTemporalContext() {
  const { isEnabled } = useFeatureFlags();
  const enabled = isEnabled("tutor_temporal_enabled");

  const buildContext = useCallback(
    (args: BuildArgs): TutorTemporalPayload | null => {
      if (!enabled) return null;
      const payload: TutorTemporalPayload = {
        video_lesson_id: args.videoLessonId,
        segment_id: args.segment?.id ?? null,
        current_timestamp: Math.max(0, Math.floor(args.currentTimestamp)),
        segment_title: args.segment?.title ?? null,
        segment_summary: args.segment?.summary ?? null,
        segment_key_points: normalizeKeyPoints(args.segment?.key_points),
        specialty: args.lesson.specialty ?? null,
        topic: args.lesson.topic ?? null,
        subtopic: args.lesson.subtopic ?? null,
        tutor_lesson_summary: args.lesson.tutor_lesson_summary ?? null,
      };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* sessionStorage cheio / bloqueado — ignora */
      }
      return payload;
    },
    [enabled]
  );

  const readContext = useCallback((): TutorTemporalPayload | null => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as TutorTemporalPayload;
    } catch {
      return null;
    }
  }, []);

  const clearContext = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  return { temporalEnabled: enabled, buildContext, readContext, clearContext };
}
