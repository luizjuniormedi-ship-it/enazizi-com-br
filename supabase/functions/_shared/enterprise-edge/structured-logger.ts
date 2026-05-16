/**
 * ENAZIZI ENTERPRISE — Structured Logger
 * Standardized logging with correlation support.
 */

import { CorrelationContext } from "./correlation.ts";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export class StructuredLogger {
  constructor(private context: CorrelationContext) {}

  private log(level: LogLevel, stage: string, message: string, data?: any) {
    const payload = {
      level,
      timestamp: new Date().toISOString(),
      function: this.context.functionName,
      requestId: this.context.requestId,
      correlationId: this.context.correlationId,
      pipelineId: this.context.pipelineId,
      stage,
      message,
      ...data,
    };

    console.log(JSON.stringify(payload));
    
    // In production, we could also stream this to a logging service
  }

  info(stage: string, message: string, data?: any) {
    this.log("INFO", stage, message, data);
  }

  warn(stage: string, message: string, data?: any) {
    this.log("WARN", stage, message, data);
  }

  error(stage: string, message: string, data?: any) {
    this.log("ERROR", stage, message, data);
  }

  critical(stage: string, message: string, data?: any) {
    this.log("CRITICAL", stage, message, data);
  }
}
