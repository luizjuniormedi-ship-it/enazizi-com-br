import { Navigate, useLocation } from "react-router-dom";

/**
 * P0-bis: react-router's <Navigate> does NOT preserve the current query string.
 * For orchestrator-driven redirects we MUST keep `?did=...` so the destination
 * can close the adaptive loop via study-complete(metadata.decisionId).
 *
 * Usage:
 *   <Route path="revisao" element={
 *     <PreserveQueryNavigate to="/dashboard/sessao-estudo?focus=reviews" />
 *   } />
 */
export default function PreserveQueryNavigate({ to }: { to: string }) {
  const location = useLocation();
  const [path, existingTargetQs = ""] = to.split("?");
  const incomingQs = location.search.startsWith("?")
    ? location.search.slice(1)
    : location.search;

  const merged = new URLSearchParams(existingTargetQs);
  // Incoming params (?did=...) take precedence — they're the live ones.
  for (const [k, v] of new URLSearchParams(incomingQs).entries()) {
    merged.set(k, v);
  }
  const finalQs = merged.toString();
  const target = finalQs ? `${path}?${finalQs}` : path;

  return <Navigate to={target} replace />;
}
