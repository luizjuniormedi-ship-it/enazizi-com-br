/**
 * ProtectedRoute — Sprint 1 slim guard.
 *
 * Single responsibility: ensure there is an authenticated session,
 * then delegate every profile-status concern to OnboardingGate.
 *
 * The previous 467-line monolith mixed auth, profile fetch, onboarding
 * forms, welcome screens and side effects in one component, which was
 * the root cause of "tela piscando" and "preso no onboarding" reports.
 */
import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import OnboardingGate from "@/components/auth/OnboardingGate";

const RESET_VERSION = "4";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  // One-time onboarding cache reset — kept for backwards compatibility
  // with users who carry stale localStorage flags from older releases.
  useEffect(() => {
    if (localStorage.getItem("enazizi_onboarding_reset_v") !== RESET_VERSION) {
      localStorage.removeItem("enazizi_v2_welcome_seen");
      localStorage.removeItem("enazizi_v2_onboarding_done");
      localStorage.removeItem("enazizi_exam_setup_skipped");
      localStorage.setItem("enazizi_onboarding_reset_v", RESET_VERSION);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <OnboardingGate>{children}</OnboardingGate>;
};

export default ProtectedRoute;
