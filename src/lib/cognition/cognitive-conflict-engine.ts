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

    if (remoteState.event_hash !== localStateHash) {
      console.warn("[COG_CONFLICT] Divergence detected! Initiating reconciliation.");
      
      // Resolve: Last Valid Write Wins (Default strategy)
      // In advanced mode, this could trigger a merge or a partial replay
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
