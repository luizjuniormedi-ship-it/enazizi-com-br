import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EducationalMemory {
  id: string;
  user_id: string;
  title: string;
  subtitle: string;
  subject: string;
  topic: string;
  subtopic: string;
  source_type: 'tutor_chat' | 'pdf' | 'cme' | 'notebooklm' | 'flashcard' | 'simulado' | 'manual';
  session_id: string;
  aggregation_id: string;
  conversation_id: string;
  generated_summary: string;
  short_summary: string;
  tags: string[];
  difficulty_level: string;
  estimated_duration: number;
  teaching_style: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  access_count: number;
  memory_score: number;
  favorite: boolean;
  archived: boolean;
  thumbnail_url: string;
  status: string;
  metadata: any;
}

export const useEducationalMemory = () => {
  const fetchMemory = async () => {
    const { data, error } = await supabase
      .from('educational_memory')
      .select('*')
      .order('last_accessed_at', { ascending: false });

    if (error) throw error;
    return data as EducationalMemory[];
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['educational-memory'],
    queryFn: fetchMemory,
  });

  const addToMemory = async (memory: Partial<EducationalMemory>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const payload: any = { ...memory, user_id: user.id };

    const { data: inserted, error } = await supabase
      .from('educational_memory')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    refetch();
    return inserted;
  };

  const updateMemory = async (id: string, updates: Partial<EducationalMemory>) => {
    const { error } = await supabase
      .from('educational_memory')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    refetch();
  };

  return {
    memory: data || [],
    isLoading,
    error,
    addToMemory,
    updateMemory,
    refetch
  };
};
