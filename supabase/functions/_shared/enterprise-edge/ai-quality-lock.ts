/**
 * ENAZIZI ENTERPRISE — AI Quality Lock
 * Validates AI responses for hallucinations, medical consistency, and pedagogical integrity.
 */

import { StructuredLogger } from "./structured-logger.ts";

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  hallucination_detected: boolean;
  issues: string[];
  medical_consistency_score: number;
}

/**
 * High-level quality validation for AI responses.
 */
export function validateAiQuality(
  content: string, 
  context: { taskType: string, expectedFormat?: "json" | "text" },
  logger: StructuredLogger
): QualityCheckResult {
  const issues: string[] = [];
  let score = 100;
  let medicalConsistency = 100;
  let hallucinationDetected = false;

  // 1. Structural Check
  if (context.expectedFormat === "json") {
    const hasBraces = content.includes("{") && content.includes("}");
    if (!hasBraces) {
      issues.push("Missing JSON structure");
      score -= 40;
    }
  }

  // 2. Pedagogical Check (ENAZIZI 15 Blocks)
  if (context.taskType === "tutor_deep" || context.taskType === "tutor") {
    const mandatoryKeywords = [
      "MISSÃO CLÍNICA", "ROADMAP COGNITIVO", "EXPLICAÇÃO LEIGA", 
      "FISIOPATOLOGIA PROFUNDA", "RACIOCÍNIO CLÍNICO", "DIAGNÓSTICO",
      "CONDUTA", "PEGADINHAS DE PROVA", "ACTIVE RECALL",
      "QUESTÃO RESIDÊNCIA", "FLASHCARDS", "RESUMO ULTRAOBJETIVO",
      "FLUXOGRAMA DECISÓRIO", "INTEGRAÇÃO FARMACOLÓGICA", "MODO PRECEPTOR"
    ];
    
    let blocksFound = 0;
    for (const kw of mandatoryKeywords) {
      if (content.toUpperCase().includes(kw)) {
        blocksFound++;
      } else {
        issues.push(`Missing pedagogical block: ${kw}`);
      }
    }
    
    const blockScore = (blocksFound / mandatoryKeywords.length) * 100;
    score = Math.min(score, blockScore);
  }

  // 3. Medical Consistency / Hallucination Detection (Heuristics)
  // Check for common red flags or forbidden terms
  const redFlags = ["segundo o chatgpt", "de acordo com a inteligência artificial", "não tenho certeza", "pode ser que"];
  for (const flag of redFlags) {
    if (content.toLowerCase().includes(flag)) {
      hallucinationDetected = true;
      issues.push(`Hallucination red flag detected: "${flag}"`);
      score -= 30;
      medicalConsistency -= 20;
    }
  }

  // 4. Length / Depth Check
  if (content.length < 200 && (context.taskType === "tutor_deep" || context.taskType === "reasoning")) {
    issues.push("Response too shallow for task type");
    score -= 20;
  }

  return {
    passed: score >= 70 && !hallucinationDetected,
    score: Math.max(0, score),
    hallucination_detected: hallucinationDetected,
    issues,
    medical_consistency_score: medicalConsistency
  };
}
