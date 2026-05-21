/**
 * ENAZIZI ENTERPRISE — Unified Edge Handler (v2026)
 * The master wrapper for all Edge Functions with Governance, Observability, and Self-Healing.
 */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createCorrelationContext, CorrelationContext } from "./correlation.ts";
import { StructuredLogger } from "./structured-logger.ts";
import { createSafeWaitUntil, SafeWaitUntil } from "./safe-wait-until.ts";
import { callAi, AiRequest } from "./ai-router.ts";
import { validateTutorResponse } from "../tutor-quality-validator.ts";
import { AiRoutingEngine, CognitiveState, AiTaskType } from "./ai-routing-engine.ts";
import { CognitiveAiOrchestrator } from "./cognitive-ai-orchestrator.ts";

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
  supabaseAdmin: any;
  /**
   * High-level AI call with integrated governance, quality lock, and cost tracking.
   */
  ai: (request: AiRequest & { cognitiveState?: CognitiveState, complexity?: "baixa" | "média" | "alta" }, options?: { skipQualityLock?: boolean, retries?: number }) => Promise<any>;
}

export type EnterpriseHandler = (ctx: EnterpriseContext) => Promise<Response>;

export function enterpriseEdgeHandler(functionName: string, handler: EnterpriseHandler) {
  return async (req: Request, context: any) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const correlation = createCorrelationContext(req, functionName);
    const logger = new StructuredLogger(correlation);
    const waitUntil = createSafeWaitUntil(context);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    logger.info("BOOT", "Function initialized");

    const aiWrapper = async (request: AiRequest & { cognitiveState?: CognitiveState, complexity?: "baixa" | "média" | "alta" }, options: { skipQualityLock?: boolean, retries?: number } = {}) => {
      const maxRetries = options.retries ?? 1;
      let lastError = null;

      // Ensure userId is passed for routing decisions if not present
      const userId = (request as any).userId;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await callAi({
            ...request,
            userId: userId || correlation.userId
          }, logger, supabaseAdmin, waitUntil);
          
          if (request.stream) return response;

          // Quality Lock
          if (!options.skipQualityLock) {
            const content = response.choices?.[0]?.message?.content || "";
            const quality = validateTutorResponse(content);
            
            // Log quality results
            waitUntil((async () => {
              await supabaseAdmin.from("ai_governance_logs")
                .update({ 
                  hallucination_score: 100,
                  medical_consistency_score: quality.score,
                  quality_lock_status: quality.isValid ? "passed" : "failed"
                })
                .match({ metadata: { request_id: response.id } });
            })());

            if (!quality.isValid) {
              logger.warn("QUALITY_LOCK_FAILED", "AI response failed quality validation", { 
                attempt, 
                issues: quality.missingBlocks, 
                model: response.model 
              });
              
              if (attempt < maxRetries) {
                logger.info("SELF_HEALING", "Triggering retry with reasoning model due to quality failure");
                request.model = "google/gemini-2.5-pro"; // Force higher quality model on retry
                // Let's add a small delay before retry to avoid rapid-fire failures
                await new Promise(r => setTimeout(r, 1000));
                continue;
              }
              
              waitUntil((async () => {
                await supabaseAdmin.from("ai_incidents").insert({
                  function_name: functionName,
                  model_name: response.model,
                  severity: "warning",
                  incident_type: "quality_failure",
                  message: `Quality lock failed after ${attempt + 1} attempts`,
                  correlation_id: correlation.correlationId,
                  metadata: { issues: quality.missingBlocks }
                });
              })());
            }
          }

          return response;
        } catch (err) {
          lastError = err;
          logger.error("AI_RETRY_ERROR", `Attempt \${attempt} failed`, { error: err.message });
          if (attempt === maxRetries) throw err;
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(attempt + 1, 2)));
        }
      }
      throw lastError;
    };

    try {
      const response = await handler({
        req,
        context,
        correlation,
        logger,
        waitUntil,
        supabaseAdmin,
        ai: aiWrapper
      });

      const latency = Date.now() - startTime;
      
      waitUntil((async () => {
        try {
          await supabaseAdmin.from("edge_execution_logs").insert({
            function_name: functionName,
            request_id: correlation.requestId,
            correlation_id: correlation.correlationId,
            method: req.method,
            status_code: response.status,
            latency_ms: latency,
            metadata: { url: req.url, pipeline_id: correlation.pipelineId }
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

      waitUntil((async () => {
        try {
          await supabaseAdmin.from("ai_incidents").insert({
            function_name: functionName,
            severity: "critical",
            incident_type: "runtime_error",
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
