/**
 * Idempotency Utility for ENAZIZI Telemetry
 * ───────────────────────────────────────
 * Generates stable hashes for events to avoid HTTP 409 (Conflict) 
 * on tables with unique constraints like assistant_decisions.
 */

/**
 * Simple hash function for strings.
 * Based on Java's String.hashCode() but for JS.
 */
export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates an event hash based on user, module, type and a key payload part.
 */
export function generateEventHash(
  userId: string, 
  module: string, 
  type: string, 
  payload: any
): string {
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  // We include a coarse timestamp (10 min window) if we want periodic updates, 
  // or omit it if we want strict once-per-session-content idempotency.
  // For most telemetry, content-based hashing + 5 min window is good.
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return generateHash(`${userId}:${module}:${type}:${payloadStr}:${timeBucket}`);
}
