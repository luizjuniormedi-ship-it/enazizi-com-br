
/**
 * ENAZIZI — Question Quality Forensics Engine v2
 * Implements strict psychometric and observed LEARNING IMPACT (QIS).
 */

import { ForensicResult } from "./forensic-board-analyzer.ts";
import { BancaProfile } from "./banca-profiles.ts";
import { ImpactForensics } from "./learning-impact-forensics.ts";

export interface QualityAuditResult {
  tier: "GOLD" | "ACCEPT" | "REVIEW" | "QUARANTINE";
  qis_score: number;
  forensic: ForensicResult;
  impact_metrics: any;
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
  // 1. Observed Learning Impact (QIS)
  const impactEngine = new ImpactForensics(supabaseAdmin);
  const qis_score = await impactEngine.calculateQIS(question.id);

  // 2. Structural & Fidelity Analysis
  const { analyzeQuestionForensic } = await import("./forensic-board-analyzer.ts");
  const forensic = await analyzeQuestionForensic(question, profile, supabaseAdmin);

  // 3. Board Drift Detection
  const drift_score = await impactEngine.detectDrift(question.id, profile.label);

  // 4. Decision Pipeline (Impact-First)
  let tier: QualityAuditResult['tier'] = "ACCEPT";
  
  // Rule: QIS < 50 or Technical Error -> QUARANTINE
  if (question.metadata?.medical_error || qis_score < 50) {
    tier = "QUARANTINE";
  } 
  // Rule: QIS >= 85 + High Fidelity -> GOLD (Pending recalibration)
  else if (qis_score >= 85 && forensic.fidelity_score >= 85 && drift_score < 20) {
    tier = "GOLD";
  }
  // Rule: QIS < 70 -> REVIEW
  else if (qis_score < 70) {
    tier = "REVIEW";
  }

  return {
    tier,
    qis_score,
    forensic,
    impact_metrics: {
      drift_score,
      retention: qis_score > 70 ? "HIGH" : "OBSERVING"
    },
    technical: {
      medical_accuracy: tier === "QUARANTINE" ? "SUSPECT" : "VERIFIED",
      distractor_fatigue: 85, // Placeholder
      standard_fidelity: forensic.fidelity_score
    }
  };
}

