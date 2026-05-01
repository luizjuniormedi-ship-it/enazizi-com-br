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
import { memo, useMemo } from "react";
import { Flame, Calendar, TrendingUp, AlertTriangle, Zap, ShieldCheck } from "lucide-react";
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

function DashboardTopBar() {
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card/40 px-4 py-2.5 backdrop-blur-md shadow-sm">
      <div className="flex min-w-0 flex-col">
        {daysToExam !== null ? (
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <Calendar className="h-4 w-4 text-primary" />
            <span>
              {daysToExam === 0 ? "Prova hoje" : `${daysToExam} ${daysToExam === 1 ? "dia" : "dias"} para a prova`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <Zap className="h-4 w-4 text-primary" />
            <span>Status do dia</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {core?.adaptiveProfile?.recovery_mode_active && (
          <Badge variant="outline" className="xs:inline-flex gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border-0 bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="h-3 w-3" />
            Foco Zen
          </Badge>
        )}
        <Badge variant="outline" className={`hidden xs:inline-flex gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border-0 ${paceCfg.cls}`}>
          <PaceIcon className="h-3 w-3" />
          {paceCfg.label}
        </Badge>
        {streak > 0 && (
          <Badge variant="outline" className="gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-lg border-0 bg-warning/15 text-warning shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <Flame className="h-3 w-3 fill-warning" />
            {streak}d
          </Badge>
        )}
        <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/10 text-foreground/80">
          Nv {level}
        </Badge>
      </div>
    </div>
  );
}

export default memo(DashboardTopBar);
