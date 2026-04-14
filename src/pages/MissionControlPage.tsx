import { Navigate } from "react-router-dom";

// MissionControlPage is now merged into the main Dashboard.
// Redirect any legacy links to /dashboard.
export default function MissionControlPage() {
  return <Navigate to="/dashboard" replace />;
}
