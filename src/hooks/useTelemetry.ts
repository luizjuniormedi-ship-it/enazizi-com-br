import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { telemetry } from '@/lib/pedagogicalTelemetry';

export const useTelemetry = () => {
  const location = useLocation();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      telemetry.track('dashboard_opened');
    }
  }, [location.pathname]);

  const trackAction = (eventName: Parameters<typeof telemetry.track>[0], props?: any) => {
    telemetry.track(eventName, props);
  };

  return { trackAction };
};
