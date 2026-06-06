import { supabase } from "@/integrations/supabase/client";

/**
 * Registry of all available metrics in the system (P0.6).
 * This ensures consistency across Student, Professor, and AI modules.
 */
export const METRIC_REGISTRY = {
  READINESS: {
    name: "Readiness",
    description: "Projeção de preparação imediata para a prova.",
    formula: "Weighted accuracy (35%) + Domain Mastery (25%) + Volume (20%) + Consistency (20%)",
    action: "Foque em temas de alta incidência com baixo domínio."
  },
  APPROVAL_CHANCE: {
    name: "Approval Chance",
    description: "Probabilidade estatística de aprovação baseada no target.",
    formula: "Comparison of Forecast vs Target Percentile based on historical evidence.",
    action: "Aumente seu volume de simulados para validar sua projeção."
  },
  LEARNING_YIELD: {
    name: "Learning Yield",
    description: "Eficácia real do aprendizado e retenção.",
    formula: "Accuracy * Retention (FSRS) * Study Velocity",
    action: "Mantenha suas revisões FSRS em dia para evitar o 'Knowledge Decay'."
  },
  TRANSFER_SCORE: {
    name: "Transfer Score",
    description: "Capacidade de aplicar conhecimento em novos contextos.",
    formula: "Performance in unseen clinical scenarios vs repeated questions.",
    action: "Pratique casos clínicos simulados para fortalecer o raciocínio."
  }
};

/**
 * Unified logic to fetch metric registry from DB or fallback (P0.6).
 */
export async function getMetricDefinition(name: keyof typeof METRIC_REGISTRY) {
  const { data } = await supabase
    .from('metric_registry')
    .select('*')
    .eq('metric_name', name)
    .maybeSingle();
    
  return data || METRIC_REGISTRY[name];
}
