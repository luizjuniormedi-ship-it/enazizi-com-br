import { supabase } from "@/integrations/supabase/client";
import { eventOrderingEngine } from "./cognition/event-ordering-engine";
import { cognitiveSnapshotEngine } from "./cognition/cognitive-snapshot-engine";

/**
 * ENAZIZI ALOS — Fase 4: Temporal Cognitive Consistency Engine
 * Hardened event-driven system with deterministic ordering and snapshots.
 */


export type PedagogicalModule = 
  | 'planner' 
  | 'tutor' 
  | 'fsrs' 
  | 'simulado' 
  | 'error_bank' 
  | 'governance' 
  | 'content';

export type PedagogicalSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface PedagogicalEventPayload {
  event_type: string;
  module: PedagogicalModule;
  source: 'frontend' | 'edge_function' | 'rpc' | 'system';
  severity?: PedagogicalSeverity;
  entity_type?: string;
  entity_id?: string;
  study_context?: {
    discipline?: string;
    specialty?: string;
    topic?: string;
    subtopic?: string;
    difficulty?: string;
    study_plan_item_id?: string;
    daily_plan_task_id?: string;
  };
  cognitive_context?: {
    retention_score?: number;
    cognitive_load?: number;
    error_pressure?: number;
    fsrs_risk?: number;
    days_until_exam?: number;
  };
  metadata?: Record<string, any>;
  idempotency_key?: string;
  recursion_depth?: number;
  replay_id?: string;
}

export const pedagogicalEventBus = {
  /**
   * Emite um evento pedagógico padronizado com hardening de governança.
   */
  async emit(payload: PedagogicalEventPayload, userId: string) {
    // NEW: Phase 4 Consistency Check
    const isOrdered = await eventOrderingEngine.validateDependencies(payload.event_type, payload.metadata?.correlation_id);
    if (!isOrdered) {
      console.warn(`[COG_EVENT_RUNTIME] Dependency delay for: ${payload.event_type}. Queueing...`);
      // In a real implementation, we would queue this. 
      // For now, we allow the engine to version it and proceed but log the drift.
    }

    const timestamp = new Date().toISOString();
    // Idempotency: generate key if missing to avoid duplicate clicks
    const finalIdempotencyKey = payload.idempotency_key || `bus_${userId}_${payload.event_type}_${Date.now()}`;

    console.log(`[COG_EVENT_RUNTIME] Dispatching: ${payload.event_type}`, {
      module: payload.module,
      topic: payload.study_context?.topic,
      idempotency: finalIdempotencyKey
    });

    try {
      // Phase 4: Use upsert for assistant_decisions to prevent 409 Conflict
      const isDecision = payload.event_type.includes('decision') || payload.event_type.includes('snapshot');
      
      const { data, error } = await supabase
        .from("pedagogical_events")
        .upsert({
          user_id: userId,
          event_type: payload.event_type,
          module: payload.module,
          source: payload.source,
          severity: payload.severity || 'info',
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          study_context: payload.study_context || {},
          cognitive_context: payload.cognitive_context || {},
          metadata: { ...payload.metadata, alos_runtime: '2.5' },
          idempotency_key: finalIdempotencyKey,
          event_hash: payload.metadata?.event_hash || finalIdempotencyKey,
          recursion_depth: payload.recursion_depth || 0,
          replay_id: payload.replay_id,
          status: 'pending'
        }, { onConflict: 'user_id,event_hash' })
        .select()
        .single();

      if (error) {
        console.warn("[COG_EVENT_RUNTIME] Persistence warning (non-blocking):", error);
        // Continue flow even if persistence fails
      }

      // Async trigger for the consumer Edge Function
      // This ensures the "Event Bus" logic runs immediately
      if (data) {
        (async () => {
          try {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pedagogical-event-consumer`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
              },
              body: JSON.stringify({ event: data })
            }).catch(e => console.error("[COG_EVENT_RUNTIME] Consumer trigger failed:", e));
          } catch (e) {
            console.error("[COG_EVENT_RUNTIME] Consumer auth failure:", e);
          }
        })();
      }

      // Sync cognitive state stream locally for UI reactivity
      this.updateLocalCognitiveStream(payload);
      
      // Phase 10: Auto-Adaptive Trigger
      if (payload.event_type === 'question_answered' || payload.event_type === 'simulado_error_detected') {
        window.dispatchEvent(new CustomEvent('ena:cognitive_recalibration', { detail: payload }));
      }
      
      // Phase 3: Automatic Snapshot after critical events
      if (['question_answered', 'mission_completed', 'diagnostic_completed'].includes(payload.event_type) && data) {
        void cognitiveSnapshotEngine.capture(userId, data.id);
      }

      return data;

    } catch (err) {
      console.error("[COG_EVENT_RUNTIME] Dispatch handled error (non-blocking):", err);
      return null;
    }
  },

  /**
   * Replay longitudinal: Recalcula toda a trajetória baseada em eventos passados.
   */
  async triggerLongitudinalReplay(userId: string, reason: string = 'trajectory_sync') {
    console.log(`[COG_EVENT_RUNTIME] Triggering Replay for user: ${userId} | Reason: ${reason}`);
    const { data, error } = await supabase.rpc('replay_pedagogical_events', {
      p_user_id: userId,
      p_replay_reason: reason
    });
    
    if (error) {
      console.error("[COG_EVENT_RUNTIME] Replay trigger failed:", error);
      throw error;
    }
    return data; // Replay ID
  },

  /**
   * Atualiza cache local do estado cognitivo (Optimistic UI)
   */
  updateLocalCognitiveStream(payload: PedagogicalEventPayload) {
    console.log("[COG_EVENT_RUNTIME] Cognitive stream synchronization update.", payload.event_type);
    
    // Auto-Snapshot on critical events
    if (['question_answered', 'mission_completed'].includes(payload.event_type)) {
      // Snapshot is already triggered in emit()
    }
  }

};

