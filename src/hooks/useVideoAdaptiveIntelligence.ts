import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { toast } from "@/hooks/use-toast";

export interface AdaptiveRecommendation {
  type: 'review' | 'feynman' | 'quiz' | 'tutor_hint';
  title: string;
  description: string;
  priority: number;
}

export function useVideoAdaptiveIntelligence(videoLessonId: string, segmentId: string | null) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const [recommendation, setRecommendation] = useState<AdaptiveRecommendation | null>(null);

  const evaluateFriction = useCallback(async () => {
    if (!user || !segmentId || !isEnabled('adaptive_decisions_enabled')) return;

    try {
      // Busca eventos recentes do usuário para este segmento
      const { data: events } = await supabase
        .from('video_segment_events')
        .select('event_type')
        .eq('user_id', user.id)
        .eq('video_lesson_id', videoLessonId)
        .eq('segment_id', segmentId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!events) return;

      const replays = events.filter(e => e.event_type === 'replay').length;
      const longPauses = events.filter(e => e.event_type === 'long_pause').length;
      const quizErrors = events.filter(e => e.event_type === 'quiz_error').length;
      const frictionScore = (replays * 2) + longPauses + (quizErrors * 3);

      // Trigger actual ACE evaluation via RPC if friction is significant
      if (frictionScore >= 4) {
        await supabase.rpc('evaluate_adaptive_intervention', {
          p_user_id: user.id,
          p_trigger_type: quizErrors >= 1 ? 'quiz_fail_streak' : 'high_friction',
          p_node_id: null, 
          p_lesson_id: videoLessonId,
          p_friction_score: frictionScore
        });
      }

      // Legacy notification logic (Preventive Tutor)
      if (replays >= 2 || (replays >= 1 && longPauses >= 1) || quizErrors >= 1) {
        const rec: AdaptiveRecommendation = {
          type: quizErrors >= 1 ? 'review' : 'tutor_hint',
          title: quizErrors >= 1 ? 'Reforço sugerido' : 'Dúvida comum detectada',
          description: quizErrors >= 1 
            ? 'Parece que este trecho foi desafiador. Deseja uma micro-revisão de 2 min?' 
            : 'Muitos alunos têm dúvida aqui. Deseja uma explicação simplificada do Tutor?',
          priority: 0.8
        };
        setRecommendation(rec);
      } else {
        setRecommendation(null);
      }
    } catch (e) {
      console.warn("[useVideoAdaptiveIntelligence] evaluation failed:", e);
    }
  }, [user, videoLessonId, segmentId, isEnabled]);

  useEffect(() => {
    if (segmentId) {
      evaluateFriction();
    }
  }, [segmentId, evaluateFriction]);

  return { recommendation, resetRecommendation: () => setRecommendation(null) };
}
