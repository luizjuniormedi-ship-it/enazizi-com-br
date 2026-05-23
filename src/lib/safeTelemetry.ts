/**
 * ENAZIZI — Safe Telemetry Wrapper
 * Ensures background telemetry never interrupts the main user experience.
 */

export async function safeTelemetry<T>(
  fn: () => Promise<T>,
  label = 'telemetry'
): Promise<T | null> {
  try {
    console.log(`[SAFE_TELEMETRY:${label}] Starting background task...`);
    const result = await fn();
    console.log(`[SAFE_TELEMETRY:${label}] Background task completed successfully.`);
    return result;
  } catch (err) {
    console.error(`[SAFE_TELEMETRY:${label}] Background task failed but was suppressed:`, err);
    console.log(`[SAFE_TELEMETRY_FALLBACK] Continuing UX without ${label}.`);
    return null;
  }
}
