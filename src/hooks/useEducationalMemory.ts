import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EducationalLesson {
  id: string;
  user_id: string;
  title: string;
  subtitle: string;
  subject: string;
  topic: string;
  subtopic: string;
  status: 'structuring' | 'pending_review' | 'in_production' | 'needs_adjustment' | 'ready_to_publish' | 'published' | 'unpublished' | 'archived' | 'rejected' | 'deleted';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  structured_content: any;
  video_url: string;
  thumbnail_url: string;
  duration: number;
  source_session_id: string;
  teacher_id: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  deleted_at: string;
  is_favorite: boolean;
  is_recommended: boolean;
  hidden_from_student: boolean;
  // Legacy fields for compatibility
  source_type?: string;
  session_id?: string;
  aggregation_id?: string;
  favorite?: boolean;
  archived?: boolean;
  short_summary?: string;
  estimated_duration?: number;
  difficulty_level?: string;
  progress?: {
    progress_percent: number;
    last_position: number;
    completed: boolean;
  };
}


export const useEducationalMemory = () => {
  const fetchMemory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('tutor_lesson_memory')
      .select(`
        *,
        progress:tutor_lesson_progress(progress_percent, last_position, completed)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transform progress to single object if exists
    return (data || []).map(lesson => ({
      ...lesson,
      // Map legacy fields
      source_type: 'tutor_chat',
      session_id: lesson.source_session_id,
      favorite: lesson.is_favorite,
      archived: lesson.status === 'archived',
      short_summary: lesson.subtitle || lesson.topic,
      estimated_duration: lesson.duration || 900,
      difficulty_level: 'Médio',
      progress: lesson.progress?.[0] || null
    })) as EducationalLesson[];

  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['educational-memory'],
    queryFn: fetchMemory,
  });

  const requestLesson = async (lesson: Partial<EducationalLesson>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Dedup: já existe pedido ativo equivalente?
    const sessionId = lesson.source_session_id ?? lesson.session_id ?? null;
    const topic = lesson.topic ?? null;
    const subject = lesson.subject ?? null;
    if (sessionId || topic) {
      let q = supabase
        .from('tutor_lesson_memory')
        .select('id, status, title')
        .eq('user_id', user.id)
        .not('status', 'in', '("deleted","rejected")');
      if (sessionId) q = q.eq('source_session_id', sessionId);
      if (topic) q = q.eq('topic', topic);
      if (subject) q = q.eq('subject', subject);
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        return { ...existing, _deduped: true } as any;
      }
    }

    const payload: any = {
      ...lesson,
      user_id: user.id,
      status: 'pending_review',
    };
    // Clean up legacy fields before insert
    delete payload.source_type;
    delete payload.session_id;
    delete payload.aggregation_id;
    delete payload.favorite;
    delete payload.archived;
    delete payload.short_summary;
    delete payload.estimated_duration;
    delete payload.difficulty_level;
    delete payload.progress;
    delete payload._deduped;

    const { data: inserted, error } = await supabase
      .from('tutor_lesson_memory')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;

    // Evento "lesson_requested"
    await supabase.from('tutor_lesson_events').insert([{
      lesson_id: inserted.id,
      actor_id: user.id,
      event_type: 'lesson_requested',
      metadata: { source: 'tutor_ia' },
    }] as any);

    // Dispara estruturação (fire-and-forget)
    supabase.functions
      .invoke('tutor-lesson-structure', { body: { lesson_id: inserted.id } })
      .catch((err) => console.warn('[lesson-structure] invoke failed', err))
      .finally(() => refetch());

    refetch();
    return inserted;
  };

  const restructureLesson = async (lessonId: string) => {
    const { data, error } = await supabase.functions.invoke(
      'tutor-lesson-structure',
      { body: { lesson_id: lessonId } },
    );
    if (error) throw error;
    refetch();
    return data;
  };

  const exportLesson = async (
    lessonId: string,
    format: 'notebooklm' | 'gemini' | 'google_vids' | 'markdown' | 'txt',
  ) => {
    const { data, error } = await supabase.functions.invoke(
      'tutor-lesson-export',
      { body: { lesson_id: lessonId, format } },
    );
    if (error) throw error;
    return data as { content: string; file_name: string; mime: string };
  };

  const updateLessonProgress = async (lessonId: string, progress: { progress_percent: number, last_position: number, completed?: boolean }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('tutor_lesson_progress')
      .upsert({
        lesson_id: lessonId,
        user_id: user.id,
        ...progress,
        completed_at: progress.completed ? new Date().toISOString() : undefined
      }, { onConflict: 'lesson_id,user_id' });

    if (error) throw error;
    refetch();
  };

  return {
    memory: data || [],
    isLoading,
    error,
    requestLesson,
    updateLessonProgress,
    refetch,
    // Legacy alias
    addToMemory: requestLesson
  };
};

