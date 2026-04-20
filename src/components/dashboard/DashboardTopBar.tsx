/**
 * DashboardTopBar — Barra superior compacta
 * ─────────────────────────────────────────
 * Mostra em uma única linha:
 *   • Saudação curta
 *   • Dias até a prova (se exam_date estiver setado)
 *   • Status de ritmo (no ritmo / atrasado / reta final)
 *   • XP / streak
 *
 * NÃO substitui nenhum hook ou query existente — apenas consome
 * useCoreData, useMonthlyGoal e useAnalyticsSnapshot já carregados.
 */
import { useMemo } from "react";
import { Flame, Calendar, TrendingUp, AlertTriangle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCoreData } from "@/hooks/useCoreData";
import { useMonthlyGoal } from "@/hooks/useMonthlyGoal";
import { useAnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function daysBetween(target: string): number {
  const t = new Date(target).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((t - now) / (1000 * 60 * 60 * 24)));
}

export default function DashboardTopBar() {
  const { data: core } = useCoreData();
  const { data: goal } = useMonthlyGoal();
  const { data: snap } = useAnalyticsSnapshot();

  const firstName = useMemo(() => {
    return core?.profile.display_name?.split(" ")[0] || "Doutor(a)";
  }, [core?.profile.display_name]);

  const examDate = core?.profile.exam_date ?? null;
  const daysToExam = examDate ? daysBetween(examDate) : null;
  const isFinalStretch = daysToExam !== null && daysToExam <= 30;

  const paceStatus = goal?.paceStatus ?? "on_track";
  const streak = snap?.streak ?? core?.gamification?.current_streak ?? 0;
  const level = core?.gamification?.level ?? 1;

  const paceCfg = isFinalStretch
    ? { icon: AlertTriangle, label: "Reta final", cls: "bg-destructive/10 text-destructive border-destructive/20" }
    : paceStatus === "behind"
    ? { icon: AlertTriangle, label: "Atrasado", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" }
    : paceStatus === "ahead"
    ? { icon: Zap, label: "Adiantado", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" }
    : { icon: TrendingUp, label: "No ritmo", cls: "bg-primary/10 text-primary border-primary/20" };

  const PaceIcon = paceCfg.icon;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-col">
        <p className="text-xs text-muted-foreground leading-tight">
          {getGreeting()}, <span className="font-semibold text-foreground">{firstName}</span>
        </p>
        {daysToExam !== null && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {daysToExam === 0 ? "prova hoje" : `${daysToExam} ${daysToExam === 1 ? "dia" : "dias"} até a prova`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className={`gap-1 text-[10px] px-1.5 py-0.5 ${paceCfg.cls}`}>
          <PaceIcon className="h-3 w-3" />
          {paceCfg.label}
        </Badge>
        {streak > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0.5 border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Flame className="h-3 w-3" />
            {streak}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
          Nv {level}
        </Badge>
      </div>
    </div>
  );
}
