import { AI_MODELS } from "../ai-models.ts";

export type AiTaskType = 
  | "flashcards" 
  | "tutor" 
  | "simulados" 
  | "resumo" 
  | "mnemônicos" 
  | "questões_discursivas" 
  | "interpretação_clínica"
  | "classification"
  | "parsing"
  | "generation";

export type CognitiveState = 
  | "NOVATO" 
  | "EXPOSTO" 
  | "RETENÇÃO_FRACA" 
  | "RECUPERAÇÃO" 
  | "CONSOLIDAÇÃO" 
  | "DOMÍNIO";

export interface RoutingCriteria {
  taskType?: AiTaskType;
  cognitiveState?: CognitiveState;
  complexity?: "baixa" | "média" | "alta";
  budget?: number;
  maxLatency?: number;
}

/**
 * ENAZIZI — AI Routing Engine
 * Selects the optimal model based on pedagogical and technical criteria.
 */
export class AiRoutingEngine {
  static route(criteria: RoutingCriteria): { model: string, reason: string } {
    const { taskType, cognitiveState, complexity } = criteria;

    // 1. DOMÍNIO or HIGH COMPLEXITY reasoning
    if (cognitiveState === "DOMÍNIO" || complexity === "alta") {
      return { 
        model: AI_MODELS.REASONING, 
        reason: "High reasoning requirement for advanced state or high complexity task." 
      };
    }

    // 2. RETENÇÃO_FRACA or RECUPERAÇÃO - prioritize pedagogy (often Reasoning models are better, or standard flash)
    if (cognitiveState === "RETENÇÃO_FRACA" || cognitiveState === "RECUPERAÇÃO") {
      return { 
        model: AI_MODELS.REASONING, // Usually better for analogies and deep pedagogy
        reason: "Cognitive recovery mode requires higher pedagogical depth." 
      };
    }

    // 3. Task specific routing
    switch (taskType) {
      case "flashcards":
        return { 
          model: AI_MODELS.CHEAP, 
          reason: "Flashcards are repetitive, low-cost model preferred." 
        };
      case "tutor":
        return { 
          model: AI_MODELS.REASONING, 
          reason: "Tutor requires deep clinical context." 
        };
      case "simulados":
        return { 
          model: AI_MODELS.FALLBACK, // Using GPT-5.5 as requested for adaptive simulados
          reason: "Simulados require high reliability and complex structuring." 
        };
      case "mnemônicos":
        return { 
          model: AI_MODELS.FAST, 
          reason: "Standard creative generation." 
        };
      case "resumo":
        return { 
          model: AI_MODELS.CHEAP, 
          reason: "Summarization is a standard high-context, lower reasoning task." 
        };
      default:
        return { 
          model: AI_MODELS.FAST, 
          reason: "Defaulting to fast model for standard tasks." 
        };
    }
  }
}
