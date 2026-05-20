import { supabase } from "@/integrations/supabase/client";

/**
 * ENAZIZI ALOS — Fase 2: Pedagogical Event Bus
 * Trilho central que conecta todos os módulos com eventos persistentes e auditáveis.
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
}

export const pedagogicalEventBus = {
  /**
   * Emite um evento pedagógico padronizado e o persiste para consumo.
   */
  async emit(payload: PedagogicalEventPayload, userId: string) {
    console.log(`[ALOS_EVENT_BUS] Emitting: ${payload.event_type}`, payload);

    try {
      const { data, error } = await supabase
        .from("pedagogical_events")
        .insert({
          user_id: userId,
          event_type: payload.event_type,
          module: payload.module,
          source: payload.source,
          severity: payload.severity || 'info',
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          study_context: payload.study_context || {},
          cognitive_context: payload.cognitive_context || {},
          metadata: payload.metadata || {},
          idempotency_key: payload.idempotency_key,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        // Fallback para telemetria genérica se a tabela principal falhar (retrocompatibilidade)
        console.error("[ALOS_EVENT_BUS] Failed to persist in pedagogical_events. Falling back to telemetry.", error);
        this.fallbackEmit(payload, userId);
        return null;
      }

      // 3. Notificar consumidores em tempo real (opcional, via post-insert trigger no backend ou hooks no frontend)
      this.triggerInternalAdaptations(payload, userId);
      
      return data;
    } catch (err) {
      console.error("[ALOS_EVENT_BUS] Critical error emitting event:", err);
      return null;
    }
  },

  /**
   * Fallback para garantir que o sistema não perca rastreabilidade em caso de migração incompleta.
   */
  async fallbackEmit(payload: PedagogicalEventPayload, userId: string) {
    await supabase.from("telemetry_events").insert({
      user_id: userId,
      event_name: payload.event_type,
      properties: {
        ...payload,
        alos_layer: 'event_bus_fallback',
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * Adaptações imediatas que o frontend pode realizar.
   * O processamento pesado deve ocorrer via Consumers no Backend.
   */
  triggerInternalAdaptations(payload: PedagogicalEventPayload, userId: string) {
    if (payload.event_type === 'simulado_error_detected' || (payload.event_type === 'tutor_question_answered' && payload.metadata?.is_correct === false)) {
      console.log("[ALOS_ADAPTATION] High error pressure detected via Event Bus. Topic:", payload.study_context?.topic);
      // Aqui poderiam ser disparados sinais para o sistema de UI
    }
  }
};
