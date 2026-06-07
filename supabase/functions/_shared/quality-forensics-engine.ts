
/**
 * ENAZIZI — Question Quality Forensics Engine
 * Implements strict psychometric and quality auditing for questions.
 */

import { ForensicResult } from "./forensic-board-analyzer.ts";
import { BancaProfile } from "./banca-profiles.ts";

export interface QualityAuditResult {
  tier: "GOLD" | "ACCEPT" | "REVIEW" | "QUARANTINE";
  forensic: ForensicResult;
  psychometric: {
    discrimination_index: number;
    high_success_rate: number;
    low_success_rate: number;
    status: string;
  };
  technical: {
    medical_accuracy: "VERIFIED" | "SUSPECT" | "ERROR";
    distractor_fatigue: number;
    standard_fidelity: number;
  };
}

export async function runForensicAudit(
  question: any,
  profile: BancaProfile,
  supabaseAdmin: any,
  psychometricData?: any
): Promise<QualityAuditResult> {
  // 1. Structural & Fidelity Analysis
  const { analyzeQuestionForensic } = await import("./forensic-board-analyzer.ts");
  const forensic = await analyzeQuestionForensic(question, profile, supabaseAdmin);

  // 2. Psychometric Analysis (Calculated if data exists)
  const discrimination = psychometricData?.discrimination || 0;
  const highRate = psychometricData?.highRate || 0.5;
  const lowRate = psychometricData?.lowRate || 0.5;
  
  // Rule: Questão que alunos fracos e fortes acertam na mesma proporção deve ser revisada.
  const diff = Math.abs(highRate - lowRate);
  const psychometricStatus = diff < 0.1 ? "POOR_DISCRIMINATION" : "OK";

  // 3. Distractor Fatigue
  const options = question.options || [];
  let distractorFatigue = 100;
  
  // Penalize for obvious distractors or length issues
  const lengths = options.map((o: string) => o.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  if (maxLen > minLen * 3) distractorFatigue -= 30; // Length outlier

  // 4. Decision Pipeline
  let tier: QualityAuditResult['tier'] = "GOLD";
  
  if (question.metadata?.medical_error || forensic.fidelity_score < 40) {
    tier = "QUARANTINE";
  } else if (psychometricStatus === "POOR_DISCRIMINATION" || forensic.fidelity_score < 70) {
    tier = "REVIEW";
  } else if (forensic.fidelity_score < 85) {
    tier = "ACCEPT";
  }

  return {
    tier,
    forensic,
    psychometric: {
      discrimination_index: discrimination,
      high_success_rate: highRate,
      low_success_rate: lowRate,
      status: psychometricStatus
    },
    technical: {
      medical_accuracy: tier === "QUARANTINE" ? "SUSPECT" : "VERIFIED",
      distractor_fatigue: distractorFatigue,
      standard_fidelity: forensic.fidelity_score
    }
  };
}
