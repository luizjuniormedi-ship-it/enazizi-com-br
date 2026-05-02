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
  status: 'pending_review' | 'in_production' | 'needs_adjustment' | 'ready_to_publish' | 'published' | 'unpublished' | 'archived' | 'rejected' | 'deleted';
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

    const payload: any = {
      ...lesson,
      user_id: user.id,
      status: 'pending_review'
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

    const { data: inserted, error } = await supabase
      .from('tutor_lesson_memory')
      .insert([payload])
      .select()
      .single();


    if (error) throw error;
    
    // Log event
    await supabase.from('tutor_lesson_events').insert({
      lesson_id: inserted.id,
      actor_id: user.id,
      event_type: 'lesson_requested',
      metadata: { source: 'tutor_ia' }
    });

    refetch();
    return inserted;
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

