import { Navigate } from "react-router-dom";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useExperimentGroup } from "@/hooks/useExperimentGroup";
import { Loader2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";


interface Props {
  moduleKey: string;
  children: React.ReactNode;
}

/**
 * Route guard that checks module access before rendering children.
 * Redirects to dashboard if user doesn't have access.
 */
export const ModuleGuard = ({ moduleKey, children }: Props) => {
  const { user } = useAuth();
  const { isModuleEnabled, loading } = useModuleAccess();
  const { isAdmin, loading: adminLoading } = useAdminCheck();

  if (!user) return <Navigate to="/auth" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isModuleEnabled(moduleKey)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
