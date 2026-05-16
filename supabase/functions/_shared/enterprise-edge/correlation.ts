/**
 * ENAZIZI ENTERPRISE — Correlation Engine
 * Manages request and pipeline IDs for end-to-end tracing.
 */

export interface CorrelationContext {
  requestId: string;
  correlationId: string;
  pipelineId?: string;
  functionName: string;
}

export function createCorrelationContext(req: Request, functionName: string): CorrelationContext {
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const pipelineId = req.headers.get("x-pipeline-id") || undefined;

  return {
    requestId,
    correlationId,
    pipelineId,
    functionName,
  };
}
