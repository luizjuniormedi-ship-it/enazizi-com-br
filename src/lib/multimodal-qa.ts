import { supabase } from "@/integrations/supabase/client";

/**
 * Logs an event to the multimodal audit logs if audit mode is enabled.
 */
export async function logMultimodalAudit({
  module,
  action,
  payload,
  response,
  latencyMs,
  status,
  error
}: {
  module: string;
  action: string;
  payload?: any;
  response?: any;
  latencyMs?: number;
  status: 'success' | 'error' | 'warning';
  error?: string;
}) {
  try {
    // We call the RPC function to handle the flag check and insertion server-side
    const { error: rpcError } = await supabase.rpc('log_multimodal_audit', {
      p_module: module,
      p_action: action,
      p_payload: payload,
      p_response: response,
      p_latency_ms: latencyMs,
      p_status: status,
      p_error: error
    });

    if (rpcError) {
      console.error('Error logging multimodal audit:', rpcError);
    }
  } catch (err) {
    console.error('Failed to log multimodal audit:', err);
  }
}

/**
 * Validates a video lesson before publication.
 */
export async function validateVideoLessonPublication(lessonId: string) {
  const { data: lesson, error: lessonError } = await supabase
    .from('ai_video_lessons')
    .select('*, lesson_segments(*), video_lesson_quizzes(*)')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) return { valid: false, errors: ['Aula não encontrada'] };

  const errors: string[] = [];

  if (!lesson.video_url && !lesson.notebooklm_video_url) errors.push('URL do vídeo ausente');
  if (!lesson.lesson_segments || lesson.lesson_segments.length === 0) errors.push('Segmentação ausente');
  if (!lesson.video_lesson_quizzes || lesson.video_lesson_quizzes.length === 0) errors.push('Quizzes não gerados');
  if (lesson.media_status !== 'reviewed') errors.push('Status da mídia não revisado');

  return {
    valid: errors.length === 0,
    errors
  };
}
