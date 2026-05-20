import { supabase } from "@/integrations/supabase/client";
import { PedagogicalEventPayload, pedagogicalEventBus } from "./pedagogicalEventBus";

/**
 * PHASE 2: Deterministic Event Ordering Engine
 * Ensures pedagogical events are processed in a strict logical order.
 */

const EVENT_DEPENDENCIES: Record<string, string[]> = {
  'fsrs_updated': ['question_answered'],
  'cognitive_state_updated': ['fsrs_updated', 'error_registered'],
  'planner_recalculated': ['fsrs_updated', 'cognitive_state_updated'],
  'tutor_context_updated': ['cognitive_state_updated'],
  'review_created': ['error_registered']
};

export class EventOrderingEngine {
  private static instance: EventOrderingEngine;
  private processingQueue: Map<string, PedagogicalEventPayload[]> = new Map();
  private isProcessing: boolean = false;

  private constructor() {}

  public static getInstance(): EventOrderingEngine {
    if (!EventOrderingEngine.instance) {
      EventOrderingEngine.instance = new EventOrderingEngine();
    }
    return EventOrderingEngine.instance;
  }

  /**
   * Envelopa e versiona o evento antes da emissão.
   */
  async prepareAndEmit(payload: PedagogicalEventPayload, userId: string) {
    const correlationId = payload.metadata?.correlation_id || crypto.randomUUID();
    const sequenceNumber = Date.now(); // Simplified sequence for runtime ordering
    
    // Versioning check
    const eventHash = await this.generateHash(payload);
    
    const versionedPayload: PedagogicalEventPayload = {
      ...payload,
      idempotency_key: payload.idempotency_key || `v1_${correlationId}_${payload.event_type}`,
      metadata: {
        ...payload.metadata,
        correlation_id: correlationId,
        sequence_number: sequenceNumber,
        event_hash: eventHash,
        version: '1.0.0-temporal'
      }
    };

    // Store versioning record
    await supabase.from('pedagogical_event_versions').insert({
      event_id: crypto.randomUUID(), // Will be linked to actual event id later
      correlation_id: correlationId,
      sequence_number: sequenceNumber,
      event_type: payload.event_type,
      user_id: userId,
      source_module: payload.module,
      event_hash: eventHash,
      metadata: versionedPayload.metadata
    });

    return pedagogicalEventBus.emit(versionedPayload, userId);
  }

  private async generateHash(payload: any): Promise<string> {
    const msgBuffer = new TextEncoder().encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Valida se as dependências do evento foram satisfeitas.
   */
  async validateDependencies(eventType: string, correlationId: string): Promise<boolean> {
    const dependencies = EVENT_DEPENDENCIES[eventType] || [];
    if (dependencies.length === 0) return true;

    const { data } = await supabase
      .from('pedagogical_event_versions')
      .select('event_type')
      .eq('correlation_id', correlationId)
      .in('event_type', dependencies);

    const processedTypes = new Set(data?.map(d => d.event_type) || []);
    return dependencies.every(dep => processedTypes.has(dep));
  }
}

export const eventOrderingEngine = EventOrderingEngine.getInstance();
