
/**
 * ENAZIZI — Learning Impact Forensics v3 (Gold Phase 4)
 * Implementation of QIS, EIS, and OIS (Outcome Evidence Layer).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface QISMetrics {
  recoverySuccess: number; // 25%
  retention: number;       // 25%
  transfer: number;        // 20%
  clinicalImpact: number;  // 20%
  approvalCorrelation: number; // 10%
}

export interface EISMetrics {
  blindSim: number;       // External validation
  farTransfer: number;    // Generalization
  hospitalVirtual: number; // Applied clinical impact
  longRetention: number;  // D180+
}

export interface OISMetrics {
  enare: number;     // 30%
  enamed: number;    // 20%
  university: number; // 20%
  osce: number;       // 20%
  internato: number;  // 10%
}

export class ImpactForensics {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * OUTCOME IMPACT SCORE (OIS)
   * Measured only from observed real-world results.
   */
  async calculateOIS(questionId: string): Promise<{ score: number, n: number }> {
    const { data: outcomes } = await this.supabase
      .from("outcome_registry")
      .select("exam_type, exam_score, approval_status")
      .eq("question_id", questionId);

    if (!outcomes || outcomes.length === 0) return { score: 0, n: 0 };

    const n = outcomes.length;
    let scores = { enare: 0, enamed: 0, university: 0, osce: 0, internato: 0 };
    let counts = { enare: 0, enamed: 0, university: 0, osce: 0, internato: 0 };

    outcomes.forEach(o => {
      const type = o.exam_type.toLowerCase() as keyof typeof scores;
      if (scores[type] !== undefined) {
        scores[type] += o.exam_score || 0;
        counts[type]++;
      }
    });

    const getAvg = (type: keyof typeof scores) => counts[type] > 0 ? scores[type] / counts[type] : 0;

    // Adjusted weights logic
    const score = (
      getAvg('enare') * 0.3 +
      getAvg('enamed') * 0.2 +
      getAvg('university') * 0.2 +
      getAvg('osce') * 0.2 +
      getAvg('internato') * 0.1
    );

    return { score: Math.round(score), n };
  }

  async calculateEIS(questionId: string): Promise<number> {
    const { data } = await this.supabase
      .from("question_external_metrics")
      .select("*")
      .eq("question_id", questionId)
      .single();

    if (!data) return 0;
    return Math.round(
      (data.blind_sim_performance || 0) * 0.3 +
      (data.far_transfer_score || 0) * 0.3 +
      (data.hospital_virtual_impact || 0) * 0.2 +
      (data.long_term_retention_d180 || 0) * 0.2
    );
  }

  async calculateQIS(questionId: string): Promise<number> {
    const metrics = await this.getObservedMetrics(questionId);
    return Math.round(
      metrics.recoverySuccess * 0.25 +
      metrics.retention * 0.25 +
      metrics.transfer * 0.20 +
      metrics.clinicalImpact * 0.20 +
      metrics.approvalCorrelation * 0.10
    );
  }

  private async getObservedMetrics(questionId: string): Promise<QISMetrics> {
    return { recoverySuccess: 75, retention: 60, transfer: 55, clinicalImpact: 50, approvalCorrelation: 40 };
  }

  async promoteTier(questionId: string) {
    const qis = await this.calculateQIS(questionId);
    const eis = await this.calculateEIS(questionId);
    const { score: ois, n } = await this.calculateOIS(questionId);

    let tier = "ACCEPT";
    let confidence = "LOW";
    if (n >= 500) confidence = "VERY_HIGH";
    else if (n >= 100) confidence = "HIGH";
    else if (n >= 30) confidence = "MODERATE";

    // Promotion Logic (Phase 4)
    if (qis >= 85 && eis >= 80 && ois >= 75 && n >= 500) {
      tier = "GOLD_VERIFIED_EMPIRICAL";
    } else if (qis >= 85 && eis >= 80 && n >= 100) {
      tier = "GOLD_VERIFIED_HIGH_CONFIDENCE";
    } else if (qis >= 85 && eis >= 80) {
      tier = "GOLD_VERIFIED";
    } else if (qis >= 80) {
      tier = "GOLD";
    }

    await this.supabase
      .from("question_impact_metrics")
      .update({ 
        tier, 
        qis_score: qis, 
        ois_score: ois,
        observation_count: n,
        metadata: { eis_score: eis, confidence_level: confidence } 
      })
      .eq("question_id", questionId);
  }

  async detectDrift(questionId: string, board: string): Promise<number> {
    return 15; // Placeholder
  }
}


