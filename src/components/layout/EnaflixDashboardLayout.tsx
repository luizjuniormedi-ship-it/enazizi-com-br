import { Outlet } from "react-router-dom";
import { Suspense, useEffect } from "react";
import { SessionMemoryProvider } from "@/contexts/SessionMemoryContext";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useJourneyRefresh } from "@/hooks/useJourneyRefresh";
import { useLandscapeTablet } from "@/hooks/useLandscapeTablet";
import { useAlertTelemetry } from "@/hooks/useAlertTelemetry";
import { useAlertResolutionTracker } from "@/hooks/useAlertResolutionTracker";
import { useTimeToAction } from "@/hooks/useTimeToAction";
import { EnaflixLayout } from "@/components/enaflix/EnaflixLayout";
import { useSessionAbandonmentTracker } from "@/hooks/useSessionAbandonmentTracker";
import { Loader2 } from "lucide-react";

const LayoutContentLoader = () => {
  useEffect(() => {
    console.debug("[LAYOUT_SUSPENSE_START]");
    const timer = setTimeout(() => {
      console.warn("[LAYOUT_SUSPENSE_STUCK] Sub-rota demorando > 8s para hidratar");
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-[60vh] w-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-t-2 border-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-primary animate-pulse" />
        </div>
      </div>
      <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest animate-pulse">
        Sincronizando Módulo Cognitivo...
      </p>
    </div>
  );
};

export default function EnaflixDashboardLayout() {
  usePresenceHeartbeat();
  useJourneyRefresh();
  useLandscapeTablet();
  useAlertTelemetry();
  useAlertResolutionTracker();
  useTimeToAction();
  useSessionAbandonmentTracker();

  return (
    <SessionMemoryProvider>
      <EnaflixLayout>
        <Suspense fallback={<LayoutContentLoader />}>
          <Outlet />
        </Suspense>
      </EnaflixLayout>
    </SessionMemoryProvider>
  );
}
