/**
 * ENAZIZI ENTERPRISE — Unified Edge Handler
 * The master wrapper for all Edge Functions.
 */

import { createCorrelationContext, CorrelationContext } from "./correlation.ts";
import { StructuredLogger } from "./structured-logger.ts";
import { createSafeWaitUntil, SafeWaitUntil } from "./safe-wait-until.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id, x-pipeline-id, x-regression-test",
};

export interface EnterpriseContext {
  req: Request;
  context: any;
  correlation: CorrelationContext;
  logger: StructuredLogger;
  waitUntil: SafeWaitUntil;
}

export type EnterpriseHandler = (ctx: EnterpriseContext) => Promise<Response>;

export function enterpriseEdgeHandler(functionName: string, handler: EnterpriseHandler) {
  return async (req: Request, context: any) => {
    // 1. CORS
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const correlation = createCorrelationContext(req, functionName);
    const logger = new StructuredLogger(correlation);
    const waitUntil = createSafeWaitUntil(context);

    logger.info("BOOT", "Function initialized");

    try {
      // 2. Execute Handler
      const response = await handler({
        req,
        context,
        correlation,
        logger,
        waitUntil,
      });

      const latency = Date.now() - startTime;
      
      // 3. Global Telemetry (After response is ready)
      // Note: We don't block the response for telemetry
      waitUntil((async () => {
        try {
          const { createClient } = await import("npm:@supabase/supabase-js@2.45.0");
          const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          await supabaseAdmin.from("edge_execution_logs").insert({
            function_name: functionName,
            request_id: correlation.requestId,
            correlation_id: correlation.correlationId,
            method: req.method,
            status_code: response.status,
            latency_ms: latency,
            metadata: {
              url: req.url,
              pipeline_id: correlation.pipelineId,
            }
          });
        } catch (telemetryErr) {
          console.error("[enterprise-edge] Global telemetry failed:", telemetryErr);
        }
      })());

      return response;

    } catch (err) {
      const latency = Date.now() - startTime;
      const status = err.message?.includes("UNAUTHORIZED") ? 401 : 
                    err.message?.includes("FORBIDDEN") ? 403 : 500;

      logger.critical("FATAL_ERROR", err.message, { stack: err.stack });

      // 4. Incident Reporting
      waitUntil((async () => {
        try {
          const { createClient } = await import("npm:@supabase/supabase-js@2.45.0");
          const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          await supabaseAdmin.from("runtime_incidents").insert({
            function_name: functionName,
            severity: "critical",
            message: err.message,
            stack_trace: err.stack,
            correlation_id: correlation.correlationId,
          });

          await supabaseAdmin.from("edge_execution_logs").insert({
            function_name: functionName,
            request_id: correlation.requestId,
            correlation_id: correlation.correlationId,
            method: req.method,
            status_code: status,
            latency_ms: latency,
            error_message: err.message,
          });
        } catch (incidentErr) {
          console.error("[enterprise-edge] Incident reporting failed:", incidentErr);
        }
      })());

      return new Response(
        JSON.stringify({
          success: false,
          error: err.message,
          correlation_id: correlation.correlationId,
          request_id: correlation.requestId,
        }),
        { 
          status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
  };
}
