import { supabase } from "@/integrations/supabase/client";

/**
 * PHASE 3: Cognitive Snapshot Engine
 * Captures the full system state for rollback and temporal debugging.
 */

export interface SnapshotState {
  cognitive_state: any;
  planner_state: any;
  fsrs_state: any;
  tutor_context: any;
  difficulty_state?: any;
  fatigue_state?: any;
}

export class CognitiveSnapshotEngine {
  private static instance: CognitiveSnapshotEngine;

  private constructor() {}

  public static getInstance(): CognitiveSnapshotEngine {
    if (!CognitiveSnapshotEngine.instance) {
      CognitiveSnapshotEngine.instance = new CognitiveSnapshotEngine();
    }
    return CognitiveSnapshotEngine.instance;
  }

  /**
   * Captura um snapshot completo do estado atual do usuário.
   */
  async capture(userId: string, sourceEventId?: string) {
    console.log(`[COG_SNAPSHOT] Capturing state for user ${userId}`);

    // Fetch multiple states in parallel
    const [cogRes, plannerRes, fsrsRes] = await Promise.all([
      supabase.from('cognitive_states').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('study_plans').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('adaptive_student_profiles').select('*').eq('user_id', userId).maybeSingle()
    ]);

    const snapshotData = {
      user_id: userId,
      source_event_id: sourceEventId,
      cognitive_state: (cogRes.data as any) || {},
      planner_state: (plannerRes.data as any) || {},
      fsrs_state: (fsrsRes.data as any) || {},
      tutor_context: { last_topics: (cogRes.data as any)?.metadata?.last_topics || [] },
      difficulty_state: { stress: fsrsRes.data?.cognitive_stress_index || 0 },
      fatigue_state: { fatigue: fsrsRes.data?.fatigue_index || 0 }
    };

    // Phase 4: Use upsert for snapshots to prevent race condition conflicts
    const { data, error } = await supabase
      .from('cognitive_snapshots')
      .upsert(snapshotData, { onConflict: 'user_id, source_event_id' })
      .select()
      .single();

    if (error) {
      console.error("[COG_SNAPSHOT] Capture failed:", error);
      throw error;
    }

    return data;
  }

  /**
   * Restaura o sistema para um snapshot específico.
   */
  async rollback(snapshotId: string) {
    const { data: snapshot, error: fetchError } = await supabase
      .from('cognitive_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (fetchError || !snapshot) throw new Error("Snapshot not found");

    console.warn(`[COG_SNAPSHOT] ROLLING BACK to snapshot ${snapshotId}`);

    // Deterministic Rollback Sequence
    const cog = snapshot.cognitive_state as any;
    const plan = snapshot.planner_state as any;
    const fsrs = snapshot.fsrs_state as any;

    await Promise.all([
      supabase.from('cognitive_states').upsert(cog, { onConflict: 'user_id' }),
      supabase.from('study_plans').upsert(plan, { onConflict: 'user_id' }),
      supabase.from('adaptive_student_profiles').upsert(fsrs, { onConflict: 'user_id' })
    ]);

    return true;
  }
}

export const cognitiveSnapshotEngine = CognitiveSnapshotEngine.getInstance();
