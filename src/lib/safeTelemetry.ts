/**
 * ENAZIZI — Safe Telemetry Wrapper
 * Ensures background telemetry never interrupts the main user experience.
 */
export async function safeTelemetry(
  fn: () => Promise<any>,
  label = 'telemetry'
) {
  try {
    console.log(`[SAFE_TELEMETRY:${label}] Starting...`);
    const result = await fn();
    console.log(`[SAFE_TELEMETRY:${label}] OK`);
    return result;
  } catch (err) {
    console.error(`[SAFE_TELEMETRY:${label}] FAILED:`, err);
    return null;
  }
}
