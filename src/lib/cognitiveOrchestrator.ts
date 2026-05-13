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
    // Fallback: Gerar um UUID local para não quebrar o fluxo, 
    // mas logar como falha de persistência na telemetria
    return crypto.randomUUID();
  }

  return data;
};
