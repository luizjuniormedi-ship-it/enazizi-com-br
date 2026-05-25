import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { telemetry } from "./pedagogicalTelemetry";

const LAZY_RETRY_PREFIX = "enazizi_lazy_retry";

export const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk [\d]+ failed|error loading dynamically imported module/i.test(
    message,
  );
};

export const lazyWithRetry = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  cacheKey: string,
): LazyExoticComponent<T> =>
  lazy(async () => {
    const startTime = performance.now();
    try {
      const module = await importer();
      const loadTime = performance.now() - startTime;
      console.debug(`[LAZY_MODULE_LOAD] ${cacheKey} in ${Math.round(loadTime)}ms`);

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${LAZY_RETRY_PREFIX}:${cacheKey}:${window.location.pathname}`);
        
        // Log successful load performance for heavy modules
        if (loadTime > 1000) {
          telemetry.track('session_progress', {
            action: 'chunk_loaded',
            module: cacheKey,
            load_time_ms: Math.round(loadTime)
          });
        }
      }

      return module;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      
      if (typeof window !== "undefined" && isChunkLoadError(error)) {
        const retryKey = `${LAZY_RETRY_PREFIX}:${cacheKey}:${window.location.pathname}`;
        const hasRetried = sessionStorage.getItem(retryKey) === "1";

        telemetry.track('supabase_timeout', {
          reason: 'chunk_load_fail',
          module: cacheKey,
          load_time_ms: Math.round(loadTime),
          retry_count: hasRetried ? 1 : 0
        });

        if (!hasRetried) {
          sessionStorage.setItem(retryKey, "1");
          window.location.reload();
          return new Promise<never>(() => {});
        }
      }

      throw error;
    }
  });
