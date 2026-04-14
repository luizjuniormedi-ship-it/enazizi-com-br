import { Navigate, useSearchParams } from "react-router-dom";

// MissionControlPage is now merged into Dashboard.
// Forward any query params (like autostart) to /dashboard.
export default function MissionControlPage() {
  const [searchParams] = useSearchParams();
  const target = searchParams.toString()
    ? `/dashboard?${searchParams.toString()}`
    : "/dashboard";
  return <Navigate to={target} replace />;
}
