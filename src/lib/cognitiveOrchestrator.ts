import { supabase } from "@/integrations/supabase/client";

/**
 * Orquestrador central de decisões cognitivas.
 * Garante que toda ação da IA tenha um decisionId rastreável.
 */
export const getOrchestratorDecision = async (
  userId: string,
  moduleSource: string,
  context: Record<string, any> = {}
): Promise<string> => {
  const { telemetry } = await import("./pedagogicalTelemetry");
  const startTime = Date.now();

  const { data, error } = await supabase.rpc('create_adaptive_decision', {
    p_user_id: userId,
    p_module_source: moduleSource,
    p_context: context
  });

  if (error) {
    console.error("[Orchestrator] Falha ao criar decisão adaptativa:", error);
    telemetry.track('cognitive_decision_created', { 
      module: moduleSource, 
      status: 'failed', 
      error: error.message 
    });
    return crypto.randomUUID();
  }

  // Persistir globalmente para acesso fácil em componentes profundos
  (window as any)._lastDecisionId = data;
  
  telemetry.track('cognitive_decision_created', { 
    module: moduleSource, 
    status: 'success', 
    decision_id: data,
    latency_ms: Date.now() - startTime
  });

  return data;
};
