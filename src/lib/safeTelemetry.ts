/**
 * safeTelemetry — Global non-blocking telemetry guard.
 *
 * Telemetry must never break UX, AI rendering, tutor flows, mnemonic generation,
 * navigation, or study interactions. Wrap every best-effort analytics/persistence
 * call that is not part of the user's requested action.
 */
export async function safeTelemetry<T>(
  fn: () => Promise<T> | PromiseLike<T>,
  label = "telemetry"
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[SAFE_TELEMETRY]", label, err);
    console.info("[TELEMETRY_SAFE_FAIL]", label);
    return null;
  }
}

export function safeTelemetryFireAndForget<T>(
  fn: () => Promise<T> | PromiseLike<T>,
  label = "telemetry"
): void {
  void safeTelemetry(fn, label);
}
