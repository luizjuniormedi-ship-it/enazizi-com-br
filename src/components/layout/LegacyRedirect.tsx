import { Navigate, useLocation } from "react-router-dom";

/**
 * Redirect que PRESERVA search params e state ao migrar rotas legadas
 * (ex.: /dashboard/mentor?specialty=Cardiologia&topic=IAM →
 * /dashboard/sessao-estudo?specialty=Cardiologia&topic=IAM).
 *
 * React Router `<Navigate to="/x" />` descarta a query string por padrão,
 * o que quebra a propagação de contexto (Fase 2 do plano Mentor IA).
 */
export function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const target = `${to}${location.search || ""}${location.hash || ""}`;
  return <Navigate to={target} replace state={location.state} />;
}

export default LegacyRedirect;
