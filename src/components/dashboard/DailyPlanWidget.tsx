import { useEffect, useState } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DailyPlanWidget = () => {
  const { user } = useAuth();
  const [data, setData] = useState<{ total: number; completed: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // BR timezone (America/Sao_Paulo)
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    supabase
      .from("daily_plans")
      .select("total_blocks, completed_count")
      .eq("user_id", user.id)
      .eq("plan_date", today)
      .maybeSingle()
      .then(({ data: d, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[DailyPlanWidget] load failed:", error.message);
          return;
        }
        if (d && d.total_blocks > 0) {
          setData({ total: d.total_blocks, completed: d.completed_count });
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!data) return null;

  const pct = Math.round((data.completed / data.total) * 100);

  return (
    <Link to="/dashboard/plano-dia" className="glass-card p-4 hover:border-primary/30 transition-all flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Zap className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-2">
          Missão do Dia

          <span className="text-xs text-muted-foreground">{data.completed}/{data.total} blocos</span>
        </div>
        <div className="h-2 rounded-full bg-secondary mt-1.5">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {pct === 100 && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
    </Link>
  );
};

export default DailyPlanWidget;
