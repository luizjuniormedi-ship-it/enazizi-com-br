import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PedagogicalSession, TutorMode, CognitiveState } from '@/types/pedagogical';
import { useAuth } from './useAuth';

export function usePedagogicalSession() {
  const { user } = useAuth();
  const [session, setSession] = useState<PedagogicalSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * getOrCreateSession — ENTERPRISE HARDENING
   * Uses idempotent upsert to prevent duplication errors during revisit.
   */
  const getOrCreateSession = useCallback(async (conversationId: string, topic: string, specialty?: string) => {
    if (!user || !conversationId) return null;
    setIsLoading(true);
    
    try {
      // 1. Tentar buscar sessão existente primeiro (Otimização)
      const { data: existing } = await supabase
        .from('pedagogical_sessions')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (existing) {
        const mapped = mapDbToSession(existing);
        setSession(mapped);
        return mapped;
      }

      // 2. Criar ou Recuperar via UPSERT (Hardening contra Race Conditions)
      const { data: upserted, error } = await supabase
        .from('pedagogical_sessions')
        .upsert({
          user_id: user.id,
          conversation_id: conversationId,
          topic,
          specialty: specialty || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'conversation_id' })
        .select()
        .single();

      if (error) throw error;

      const mapped = mapDbToSession(upserted);
      setSession(mapped);
      return mapped;
    } catch (err) {
      console.error("[usePedagogicalSession] Resiliency failure:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateSession = useCallback(async (updates: Partial<PedagogicalSession>, retryCount = 0) => {
    if (!session || !user) return;

    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.currentBlock !== undefined) dbUpdates.current_block = updates.currentBlock;
    if (updates.completedBlocks !== undefined) dbUpdates.completed_blocks = updates.completedBlocks;
    if (updates.tutorMode !== undefined) dbUpdates.tutor_mode = updates.tutorMode;
    if (updates.cognitiveState !== undefined) dbUpdates.cognitive_state = updates.cognitiveState;
    if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;

    // Optimistic Update
    setSession(prev => prev ? { ...prev, ...updates } : null);

    try {
      const { error } = await supabase
        .from('pedagogical_sessions')
        .update(dbUpdates)
        .eq('id', session.id);

      if (error) throw error;
    } catch (err) {
      console.warn(`[usePedagogicalSession] Update retry ${retryCount + 1}:`, err);
      if (retryCount < 2) {
        setTimeout(() => updateSession(updates, retryCount + 1), 1000);
      }
    }
  }, [session, user]);

  return { session, isLoading, getOrCreateSession, updateSession };
}

function mapDbToSession(db: any): PedagogicalSession {
  return {
    id: db.id,
    userId: db.user_id,
    conversationId: db.conversation_id,
    topic: db.topic,
    specialty: db.specialty,
    currentBlock: db.current_block,
    completedBlocks: db.completed_blocks || [],
    totalBlocks: db.total_blocks || 15,
    tutorMode: db.tutor_mode as TutorMode,
    cognitiveState: db.cognitive_state as CognitiveState,
    comprehensionScore: db.comprehension_score,
    difficultyLevel: db.difficulty_level,
    metadata: db.metadata,
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}
