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
  const { data, error } = await supabase.rpc('create_adaptive_decision', {
    p_user_id: userId,
    p_module_source: moduleSource,
    p_context: context
  });

  if (error) {
    console.error("[Orchestrator] Falha ao criar decisão adaptativa:", error);
    return crypto.randomUUID();
  }

  // Persistir globalmente para acesso fácil em componentes profundos sem prop-drilling excessivo
  (window as any)._lastDecisionId = data;
  
  return data;
};
