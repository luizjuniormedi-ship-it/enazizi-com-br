import { Outlet } from "react-router-dom";
import { SessionMemoryProvider } from "@/contexts/SessionMemoryContext";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useJourneyRefresh } from "@/hooks/useJourneyRefresh";
import { useLandscapeTablet } from "@/hooks/useLandscapeTablet";
import { useAlertTelemetry } from "@/hooks/useAlertTelemetry";
import { useAlertResolutionTracker } from "@/hooks/useAlertResolutionTracker";
import { useTimeToAction } from "@/hooks/useTimeToAction";
import { EnaflixLayout } from "@/components/enaflix/EnaflixLayout";

export default function EnaflixDashboardLayout() {
  usePresenceHeartbeat();
  useJourneyRefresh();
  useLandscapeTablet();
  useAlertTelemetry();
  useAlertResolutionTracker();
  useTimeToAction();

  return (
    <SessionMemoryProvider>
      <EnaflixLayout>
        <Outlet />
      </EnaflixLayout>
    </SessionMemoryProvider>
  );
}
