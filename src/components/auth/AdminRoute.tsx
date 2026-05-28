import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import ProtectedRoute from "./ProtectedRoute";

interface AdminRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const AdminRoute = ({ children, requiredRoles }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();

  const loading = authLoading || rolesLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Se requiredRoles fornecido, verifica contra roles do usuário; senão, exige 'admin'
  const hasAccess = requiredRoles
    ? requiredRoles.some((r) => roles.includes(r))
    : roles.includes("admin");

  if (!hasAccess) return <Navigate to="/enaflix" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default AdminRoute;
