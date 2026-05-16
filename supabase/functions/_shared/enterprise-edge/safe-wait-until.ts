/**
 * ENAZIZI ENTERPRISE — Safe Background Execution
 * Robust wrapper for context.waitUntil with fallback.
 */

export type SafeWaitUntil = (promise: Promise<any>) => void;

export function createSafeWaitUntil(context?: { waitUntil?: (p: Promise<any>) => void }): SafeWaitUntil {
  return (promise: Promise<any>) => {
    const wrappedPromise = promise.catch((err) => {
      console.error("[enterprise-edge] Background job failed:", err);
    });

    if (context?.waitUntil) {
      context.waitUntil(wrappedPromise);
    } else {
      // Fallback for environments without waitUntil (like local development)
      wrappedPromise;
    }
  };
}
