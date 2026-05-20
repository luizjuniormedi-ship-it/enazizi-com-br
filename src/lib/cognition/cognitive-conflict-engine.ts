import { supabase } from "@/integrations/supabase/client";

/**
 * PHASE 5: Cognitive Conflict Engine
 * Detects and resolves race conditions from multiple devices/tabs.
 */

export class CognitiveConflictEngine {
  private static instance: CognitiveConflictEngine;

  private constructor() {}

  public static getInstance(): CognitiveConflictEngine {
    if (!CognitiveConflictEngine.instance) {
      CognitiveConflictEngine.instance = new CognitiveConflictEngine();
    }
    return CognitiveConflictEngine.instance;
  }

  /**
   * Detecta se houve divergência entre o estado local e o global.
   */
  async detectAndResolve(userId: string, localStateHash: string) {
    const { data: remoteState } = await supabase
      .from('cognitive_states')
      .select('event_hash, updated_at')
      .eq('user_id', userId)
      .single();

    if (!remoteState) return;

    // Use type casting to avoid TS error on new column
    const remoteHash = (remoteState as any).event_hash;

    if (remoteHash && remoteHash !== localStateHash) {
      console.warn("[COG_CONFLICT] Divergence detected! Initiating reconciliation.");
      
      // Resolve: Last Valid Write Wins (Default strategy)
      return this.reconcile(userId);
    }
  }

  private async reconcile(userId: string) {
    // Force refresh of all cognitive hooks
    window.dispatchEvent(new CustomEvent('ena:cognitive_conflict_resolved', {
      detail: { userId, timestamp: new Date().toISOString() }
    }));
    
    return { strategy: 'sync_refresh' };
  }
}

export const cognitiveConflictEngine = CognitiveConflictEngine.getInstance();
