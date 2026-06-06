import { supabase } from "@/integrations/supabase/client";

/**
 * Registra um evento de auditoria de recuperação para garantir rastreabilidade (P0.2).
 */
export async function auditRecoveryAttempt(params: {
  userId: string;
  topic: string;
  errorDetected?: string;
  flashcardCreated?: boolean;
  fsrsCreated?: boolean;
  plannerUpdated?: boolean;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  attemptId?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('recovery_audit_log')
      .insert({
        user_id: params.userId,
        topic: params.topic,
        error_detected: params.errorDetected,
        flashcard_created: params.flashcardCreated,
        fsrs_created: params.fsrsCreated,
        planner_updated: params.plannerUpdated,
        status: params.status,
        error_message: params.errorMessage,
        attempt_id: params.attemptId
      })
      .select('attempt_id')
      .single();

    if (error) throw error;
    
    // Log traceability event (P0.9)
    await supabase.from('system_trace_log').insert({
      event_type: params.status === 'success' ? 'RECOVERY_CREATED' : 'RECOVERY_FAILED',
      user_id: params.userId,
      metadata: { 
        topic: params.topic, 
        attempt_id: data?.attempt_id,
        error: params.errorMessage 
      }
    });

    return data?.attempt_id;
  } catch (err) {
    console.error("[AUDIT_RECOVERY_FAIL]", err);
    return null;
  }
}
