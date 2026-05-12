import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { telemetry } from '@/lib/pedagogicalTelemetry';

export const useTelemetry = () => {
  const location = useLocation();
  const recentRoutesRef = useRef<Array<{ path: string; ts: number }>>([]);

  useEffect(() => {
    // Track page view and performance
    const now = Date.now();
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const loadTime = navigationEntry ? Math.round(navigationEntry.duration) : 0;

    // Check for hydration mismatch (heuristic: if the first render is delayed significantly)
    const isFirstRender = !recentRoutesRef.current.length;
    if (isFirstRender && loadTime > 0) {
      const hydrationTime = performance.now() - navigationEntry.domContentLoadedEventEnd;
      if (hydrationTime > 2000) { // arbitrary threshold for slow hydration
        telemetry.track('hydration_mismatch' as any, { 
          hydration_time_ms: Math.round(hydrationTime),
          route: location.pathname
        });
      }
    }

    telemetry.track('page_view' as any, { 
      route: location.pathname, 
      load_time_ms: loadTime,
      is_initial_load: isFirstRender && loadTime > 0 
    });

    if (location.pathname === '/dashboard') {
      telemetry.track('dashboard_opened');
    }
    
    // Detect repeated_navigation: same path visited 3+ times within 60s
    const recent = recentRoutesRef.current.filter((r) => now - r.ts < 60000);
    recent.push({ path: location.pathname, ts: now });
    recentRoutesRef.current = recent;
    const sameCount = recent.filter((r) => r.path === location.pathname).length;
    if (sameCount >= 3) {
      telemetry.track('repeated_navigation', { path: location.pathname, count: sameCount, window_ms: 60000 });
      // Reset for this path to avoid spam
      recentRoutesRef.current = recent.filter((r) => r.path !== location.pathname);
    }
  }, [location.pathname]);

  const trackAction = useCallback(
    (eventName: Parameters<typeof telemetry.track>[0], props?: any) => {
      telemetry.track(eventName, props);
    },
    []
  );

  return { trackAction };
};
