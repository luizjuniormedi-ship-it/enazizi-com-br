
/**
 * Pedagogical Quality Lock Utility
 * Implements Layer 4 Governance rules for AI responses.
 */

export interface AuditResult {
  isValid: boolean;
  score: number; // 0-100
  incidents: string[];
  metadata: {
    blocksDetected: number;
    hasClinicalEvidence: boolean;
    hasNextStep: boolean;
  };
}

export function auditTutorResponse(text: string, isIncremental: boolean = false): AuditResult {
  const incidents: string[] = [];
  let score = 100;

  // 1. Check for basic block structure (numbered sections or emojis)
  const blockRegex = /(?:\d+\.\s|🎯|🧬|🚨|📊|🛠️|💊|🔬|🧠|⚠️|🗂️|💡|📝|🔄|# BLOCO)/g;
  const blocks = text.match(blockRegex) || [];
  
  if (!isIncremental && blocks.length < 5) {
    incidents.push("Insufficient pedagogical depth (too few blocks in monolithic response)");
    score -= 30;
  }

  if (isIncremental && blocks.length === 0) {
    incidents.push("Zero pedagogical markers detected in block");
    score -= 20;
  }

  // 2. Check for "Próximo Passo" (The core of adaptive loops)
  if (!text.toLowerCase().includes("próximo passo") && !text.includes("🔄")) {
    incidents.push("Missing 'Próximo Passo' adaptive trigger");
    score -= 20;
  }

  // 3. Check for specific medical evidence signals
  const evidenceKeywords = ["diretriz", "guideline", "estudo", "evidência", "padrão-ouro", "consenso"];
  const hasEvidence = evidenceKeywords.some(k => text.toLowerCase().includes(k));
  if (!hasEvidence) {
    incidents.push("Low clinical evidence density");
    score -= 10;
  }

  // 4. Hallucination heuristic (very basic: long repetitive sequences)
  const longRepetitions = /(.)\1{15,}/g;
  if (longRepetitions.test(text)) {
    incidents.push("Potential hallucination/drift detected");
    score -= 50;
  }

  return {
    isValid: score > 50,
    score: Math.max(0, score),
    incidents,
    metadata: {
      blocksDetected: blocks.length,
      hasClinicalEvidence: hasEvidence,
      hasNextStep: text.toLowerCase().includes("próximo passo")
    }
  };
}
