import { StructuredLogger } from "./structured-logger.ts";

/**
 * ENAZIZI — AI Provider Health
 * Tracks and reports health status of AI providers.
 */
export class AiProviderHealth {
  static async reportStatus(
    supabaseAdmin: any,
    logger: StructuredLogger,
    report: {
      provider: string,
      model: string,
      status: "success" | "error" | "timeout" | "latency_high",
      latencyMs: number,
      error?: string
    }
  ) {
    try {
      const { provider, model, status, latencyMs, error } = report;
      
      // Upsert current health status
      const { error: dbError } = await supabaseAdmin.from("ai_provider_health").upsert({
        provider,
        model,
        status,
        latency_ms: latencyMs,
        last_error: error,
        checked_at: new Date().toISOString(),
        metadata: {
          correlation_id: logger.correlationId
        }
      }, { onConflict: 'provider,model' });

      if (dbError) logger.warn("HEALTH_REPORT_DB_FAIL", dbError.message);
    } catch (err) {
      logger.warn("HEALTH_REPORT_EXCEPTION", err.message);
    }
  }

  static async isHealthy(
    supabaseAdmin: any,
    provider: string,
    model: string
  ): Promise<boolean> {
    try {
      const { data } = await supabaseAdmin
        .from("ai_provider_health")
        .select("status")
        .eq("provider", provider)
        .eq("model", model)
        .single();
      
      return data?.status === "success";
    } catch {
      return true; // Assume healthy if check fails
    }
  }
}
