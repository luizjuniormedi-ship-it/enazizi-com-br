/**
 * ENAZIZI ENTERPRISE — Correlation Engine
 * Manages request and pipeline IDs for end-to-end tracing.
 */

export interface CorrelationContext {
  requestId: string;
  correlationId: string;
  pipelineId?: string;
  functionName: string;
  userId?: string;
}

export function createCorrelationContext(req: Request, functionName: string): CorrelationContext {
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const pipelineId = req.headers.get("x-pipeline-id") || undefined;
  
  // Extract userId from Authorization header if present
  let userId: string | undefined = undefined;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const [_header, payload, _signature] = token.split(".");
      if (payload) {
        const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        userId = decoded.sub;
      }
    } catch (e) {
      console.warn("[correlation] Failed to decode JWT:", e.message);
    }
  }

  return {
    requestId,
    correlationId,
    pipelineId,
    functionName,
    userId,
  };
}
