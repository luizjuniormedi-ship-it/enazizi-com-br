/**
 * ENAZIZI Edge Function Contract — Telemetry v1
 *
 * Tags padronizadas + safe fallback obrigatório.
 */

export const CONTRACT_VERSION = "v1";

export const EDGE_LOG = {
  BOOT_OK: "[EDGE_BOOT_OK]",
  BOOT_FAIL: "[EDGE_BOOT_FAIL]",
  AUTH_OK: "[EDGE_AUTH_OK]",
  AUTH_FAIL: "[EDGE_AUTH_FAIL]",
  AI_START: "[EDGE_AI_START]",
  AI_OK: "[EDGE_AI_OK]",
  AI_FAIL: "[EDGE_AI_FAIL]",
  PARSE_OK: "[EDGE_PARSE_OK]",
  PARSE_FAIL: "[EDGE_PARSE_FAIL]",
  RESPONSE_OK: "[EDGE_RESPONSE_OK]",
  RESPONSE_FAIL: "[EDGE_RESPONSE_FAIL]",
  IMPORT_FAIL: "[EDGE_IMPORT_FAIL]",
} as const;

export function logEdge(
  tag: keyof typeof EDGE_LOG,
  fn: string,
  data?: Record<string, unknown>,
) {
  try {
    console.log(EDGE_LOG[tag], fn, data ? JSON.stringify(data) : "");
  } catch {
    console.log(EDGE_LOG[tag], fn);
  }
}

/**
 * Resposta segura padronizada — nenhuma função pode quebrar em boot/runtime
 * sem responder este envelope. Frontend nunca vê stack trace cru.
 */
export function safeFallbackResponse(
  message: string,
  correlationId: string,
  status = 503,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      safe_mode: true,
      message,
      correlation_id: correlationId,
      ...extra,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    },
  );
}
