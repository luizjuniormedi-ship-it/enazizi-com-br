
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PedagogicalSession, TutorMode, CognitiveState } from '@/types/pedagogical';
import { useAuth } from './useAuth';

export function usePedagogicalSession() {
  const { user } = useAuth();
  const [session, setSession] = useState<PedagogicalSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getOrCreateSession = useCallback(async (conversationId: string, topic: string, specialty?: string) => {
    if (!user) return null;
    setIsLoading(true);
    
    try {
      // 1. Tentar buscar sessão existente
      const { data: existing, error: fetchError } = await supabase
        .from('pedagogical_sessions')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (existing) {
        const mapped: PedagogicalSession = {
          id: existing.id,
          userId: existing.user_id,
          conversationId: existing.conversation_id,
          topic: existing.topic,
          specialty: existing.specialty,
          currentBlock: existing.current_block,
          completedBlocks: existing.completed_blocks,
          totalBlocks: existing.total_blocks,
          tutorMode: existing.tutor_mode as TutorMode,
          cognitiveState: existing.cognitive_state as CognitiveState,
          comprehensionScore: existing.comprehension_score,
          difficultyLevel: existing.difficulty_level,
          metadata: existing.metadata as PedagogicalSession['metadata'],
          createdAt: existing.created_at,
          updatedAt: existing.updated_at
        };
        setSession(mapped);
        return mapped;
      }

      // 2. Criar nova sessão se não existir
      const { data: inserted, error: insertError } = await supabase
        .from('pedagogical_sessions')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          topic,
          specialty: specialty || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const mapped: PedagogicalSession = {
        id: inserted.id,
        userId: inserted.user_id,
        conversationId: inserted.conversation_id,
        topic: inserted.topic,
        specialty: inserted.specialty,
        currentBlock: inserted.current_block,
        completedBlocks: inserted.completed_blocks,
        totalBlocks: inserted.total_blocks,
        tutorMode: inserted.tutor_mode as TutorMode,
        cognitiveState: inserted.cognitive_state as CognitiveState,
        comprehensionScore: inserted.comprehension_score,
        difficultyLevel: inserted.difficulty_level,
        metadata: inserted.metadata as PedagogicalSession['metadata'],
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at
      };
      setSession(mapped);
      return mapped;
    } catch (err) {
      console.error("[usePedagogicalSession] Error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateSession = useCallback(async (updates: Partial<PedagogicalSession>) => {
    if (!session || !user) return;

    // Converter camelCase para snake_case para o Supabase
    const dbUpdates: any = {};
    if (updates.currentBlock !== undefined) dbUpdates.current_block = updates.currentBlock;
    if (updates.completedBlocks !== undefined) dbUpdates.completed_blocks = updates.completedBlocks;
    if (updates.tutorMode !== undefined) dbUpdates.tutor_mode = updates.tutorMode;
    if (updates.cognitiveState !== undefined) dbUpdates.cognitive_state = updates.cognitiveState;
    if (updates.comprehensionScore !== undefined) dbUpdates.comprehension_score = updates.comprehensionScore;
    if (updates.difficultyLevel !== undefined) dbUpdates.difficulty_level = updates.difficultyLevel;
    if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;

    const { error } = await supabase
      .from('pedagogical_sessions')
      .update(dbUpdates)
      .eq('id', session.id);

    if (error) {
      console.error("[usePedagogicalSession] Update error:", error);
    } else {
      setSession(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [session, user]);

  return { session, isLoading, getOrCreateSession, updateSession };
}
