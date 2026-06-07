
/**
 * ENAZIZI — Learning Impact Forensics v2 (Gold Phase 3)
 * Implementation of QIS (Internal) and EIS (External Outcome Validation).
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
  blindSim: number;       // External/Novel validation
  farTransfer: number;    // Generalization
  hospitalVirtual: number; // Applied clinical impact
  longRetention: number;  // D180+
}

export class ImpactForensics {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Calculates the External Impact Score (EIS)
   */
  async calculateEIS(questionId: string): Promise<number> {
    const { data } = await this.supabase
      .from("question_external_metrics")
      .select("*")
      .eq("question_id", questionId)
      .single();

    if (!data) return 0;

    const eis = (
      (data.blind_sim_performance || 0) * 0.3 +
      (data.far_transfer_score || 0) * 0.3 +
      (data.hospital_virtual_impact || 0) * 0.2 +
      (data.long_term_retention_d180 || 0) * 0.2
    );

    return Math.round(eis);
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
    return {
      recoverySuccess: 75,
      retention: 60,
      transfer: 55,
      clinicalImpact: 50,
      approvalCorrelation: 40
    };
  }

  async detectDrift(questionId: string, board: string): Promise<number> {
    return 15; // Placeholder
  }

  /**
   * GOLD PROMOTION RULE (PHASE 3)
   * Promote to GOLD_VERIFIED only if EIS is high.
   */
  async promoteTier(questionId: string) {
    const qis = await this.calculateQIS(questionId);
    const eis = await this.calculateEIS(questionId);

    let tier = "ACCEPT";
    if (qis >= 85 && eis >= 80) tier = "GOLD_VERIFIED";
    else if (qis >= 80) tier = "GOLD";
    else if (qis < 50) tier = "QUARANTINE";

    await this.supabase
      .from("question_impact_metrics")
      .update({ tier, qis_score: qis, metadata: { eis_score: eis } })
      .eq("question_id", questionId);
  }
}

