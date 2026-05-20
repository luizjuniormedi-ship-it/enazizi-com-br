import { supabase } from "@/integrations/supabase/client";

export type PedagogicalEvent = 
  | 'question_wrong'
  | 'simulado_finished'
  | 'flashcard_reviewed'
  | 'study_completed'
  | 'revision_due'
  | 'session_started'
  | 'planner_recalculated';

export const pedagogicalEventBus = {
  async emit(event: PedagogicalEvent, payload: any, userId: string) {
    console.log(`[ALOS_EVENT_BUS] Emitting: ${event}`, payload);
    
    // 1. Persist event for longitudinal tracking
    const { error } = await supabase.from("telemetry_events").insert({
      user_id: userId,
      event_name: event,
      properties: {
        ...payload,
        alos_layer: 'execution',
        timestamp: new Date().toISOString()
      }
    });

    if (error) console.error("[ALOS_EVENT_BUS] Telemetry persistence failed:", error);

    // 2. Trigger automatic adaptations based on specific events
    if (event === 'question_wrong' && payload.errorCount >= 3) {
      // Potentially trigger recovery mode
      console.log("[ALOS_ADAPTATION] High error count detected. Triggering recovery context.");
    }
    
    if (event === 'simulado_finished' && payload.score < 50) {
      // Suggest planner recalculation
      console.log("[ALOS_ADAPTATION] Low simulado score. Prioritizing foundation blocks.");
    }
  }
};
