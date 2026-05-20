import { StructuredLogger } from "./structured-logger.ts";

export interface PedagogicalScores {
  pedagogy_score: number;
  reasoning_score: number;
  hallucination_score: number;
  cognitive_alignment_score: number;
  retention_support_score: number;
}

/**
 * ENAZIZI — AI Governance
 * Handles pedagogical scoring and auditing of AI responses.
 */
export class AiGovernance {
  static async logResponse(
    supabaseAdmin: any,
    logger: StructuredLogger,
    data: {
      model: string,
      latency: number,
      cost: number,
      usage: any,
      correlationId: string,
      taskType?: string,
      scores?: Partial<PedagogicalScores>
    }
  ) {
    try {
      const governanceData = {
        function_name: Deno.env.get("FUNCTION_NAME") || "ai-router",
        model_used: data.model,
        model_name: data.model,
        latency_ms: data.latency,
        token_usage: data.usage,
        cost_usd: data.cost,
        status: "success",
        pedagogy_score: data.scores?.pedagogy_score ?? 85, // Default/Estimated
        reasoning_score: data.scores?.reasoning_score ?? 80,
        hallucination_score: data.scores?.hallucination_score ?? 0,
        cognitive_alignment_score: data.scores?.cognitive_alignment_score ?? 90,
        retention_support_score: data.scores?.retention_support_score ?? 85,
        metadata: { 
          task_type: data.taskType,
          correlation_id: data.correlationId
        }
      };
      
      const { error } = await supabaseAdmin.from("ai_governance_logs").insert(governanceData);
      if (error) logger.warn("GOVERNANCE_DB_FAIL", error.message);
    } catch (err) {
      logger.warn("GOVERNANCE_EXCEPTION", err.message);
    }
  }

  static async logIncident(
    supabaseAdmin: any,
    logger: StructuredLogger,
    incident: {
      model: string,
      type: string,
      severity: string,
      message: string,
      metadata?: any
    }
  ) {
    try {
      await supabaseAdmin.from("ai_incidents").insert({
        function_name: Deno.env.get("FUNCTION_NAME") || "ai-router",
        model_name: incident.model,
        severity: incident.severity,
        incident_type: incident.type,
        message: incident.message,
        correlation_id: logger.correlationId,
        metadata: incident.metadata
      });
    } catch (err) {
      logger.warn("INCIDENT_LOG_FAIL", err.message);
    }
  }
}
