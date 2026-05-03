import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { telemetry } from '@/lib/pedagogicalTelemetry';
import { useAuth } from '@/hooks/useAuth';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export function useSessionAbandonmentTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const lastActivityRef = useRef<number>(Date.now());
  const currentSessionIdRef = useRef<string>(telemetry.getSessionId());
  const activeModuleRef = useRef<string>(location.pathname);

  useEffect(() => {
    if (!user) return;

    // Track session start
    telemetry.track('session_started', {
      module: location.pathname,
      device: navigator.userAgent,
    });

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      // Optionally track progress periodically
    };

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > INACTIVITY_TIMEOUT) {
        telemetry.track('session_abandoned', {
          reason: 'inactivity',
          last_module: activeModuleRef.current,
          duration_ms: now - lastActivityRef.current,
        });
        // Reset last activity to avoid multiple triggers
        lastActivityRef.current = now;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        telemetry.track('session_paused', {
          module: location.pathname,
          time: new Date().toISOString(),
        });
      } else {
        telemetry.track('session_progress', {
          action: 'resume',
          module: location.pathname,
        });
      }
    };

    const handleBeforeUnload = () => {
      telemetry.track('session_completed', {
        module: location.pathname,
        final_route: location.pathname,
      });
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const intervalId = setInterval(checkInactivity, 60000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    // Update active module when location changes
    if (location.pathname !== activeModuleRef.current) {
      telemetry.track('session_progress', {
        from: activeModuleRef.current,
        to: location.pathname,
      });
      activeModuleRef.current = location.pathname;
    }
  }, [location.pathname]);
}
