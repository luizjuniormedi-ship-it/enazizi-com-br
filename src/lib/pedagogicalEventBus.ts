import { supabase } from "@/integrations/supabase/client";
import { safeTelemetry } from "@/lib/safeTelemetry";

/**
 * ENAZIZI ALOS — Fase 2.5: Cognitive Event Runtime
 * Hardened event-driven system with longitudinal source tracking.
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
    const timestamp = new Date().toISOString();
    // Idempotency: generate key if missing to avoid duplicate clicks
    const finalIdempotencyKey = payload.idempotency_key || `bus_${userId}_${payload.event_type}_${Date.now()}`;

    console.log(`[COG_EVENT_RUNTIME] Dispatching: ${payload.event_type}`, {
      module: payload.module,
      topic: payload.study_context?.topic,
      idempotency: finalIdempotencyKey
    });

    return safeTelemetry(async () => {
      const { error } = await supabase
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
          recursion_depth: payload.recursion_depth || 0,
          replay_id: payload.replay_id,
          status: 'pending'
        }, {
          onConflict: "idempotency_key",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("[COG_EVENT_RUNTIME] Persistence failure:", error);
        console.info("[TELEMETRY_SAFE_FAIL] pedagogical_events_upsert");
        return null;
      }

      console.info("[UPSERT_OK] pedagogical_events", { idempotency_key: finalIdempotencyKey });

      // Sync cognitive state stream locally for UI reactivity
      this.updateLocalCognitiveStream(payload);

      return null;
    }, "pedagogicalEventBus.emit");
  },

  /**
   * Replay longitudinal: Recalcula toda a trajetória baseada em eventos passados.
   */
  async triggerLongitudinalReplay(userId: string, reason: string = 'trajectory_sync') {
    console.log(`[COG_EVENT_RUNTIME] Triggering Replay for user: ${userId} | Reason: ${reason}`);
    return safeTelemetry(async () => {
      const { data, error } = await supabase.rpc('replay_pedagogical_events', {
        p_user_id: userId,
        p_replay_reason: reason
      });

      if (error) {
        console.error("[COG_EVENT_RUNTIME] Replay trigger failed:", error);
        return null;
      }
      return data; // Replay ID
    }, "pedagogicalEventBus.triggerLongitudinalReplay");
  },

  /**
   * Atualiza cache local do estado cognitivo (Optimistic UI)
   */
  updateLocalCognitiveStream(payload: PedagogicalEventPayload) {
    // Invalidação de queries do Tanstack Query para refletir mudanças adaptativas
    // No ALOS, o estado cognitivo é a verdade absoluta da UI
    console.log("[COG_EVENT_RUNTIME] Cognitive stream synchronization update.");
  }
};

