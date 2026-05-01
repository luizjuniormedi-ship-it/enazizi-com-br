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
  const lessonData = lesson as any;

  const playbackUrl = lessonData.hls_url || lessonData.video_url || lessonData.playback_url || lessonData.notebooklm_video_url;
  const isPlaceholder = !playbackUrl || 
                       playbackUrl.includes('example.com') || 
                       playbackUrl.includes('placeholder') ||
                       playbackUrl.includes('dummy') ||
                       playbackUrl.includes('localhost');

  if (isPlaceholder) errors.push('URL de mídia real ausente (placeholder detectado)');
  if (!lessonData.lesson_segments || lessonData.lesson_segments.length === 0) errors.push('Segmentação ausente');
  if (!lessonData.video_lesson_quizzes || lessonData.video_lesson_quizzes.length === 0) errors.push('Quizzes não gerados');
  
  // Explicitly require a ready status for publication
  if (!['ready', 'published', 'ready_for_students'].includes(lessonData.media_status)) {
    errors.push(`Mídia não pronta (status atual: ${lessonData.media_status || 'nenhum'})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
