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
  const currentMode = core?.adaptiveProfile?.current_session_mode ?? 'balanced';

  const paceCfg = isFinalStretch
    ? { icon: AlertTriangle, label: "Reta final", cls: "bg-destructive/10 text-destructive border-destructive/20" }
    : currentMode === 'recovery'
    ? { icon: ShieldCheck, label: "Foco Zen", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" }
    : paceStatus === "behind"
    ? { icon: AlertTriangle, label: "Atrasado", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" }
    : paceStatus === "ahead"
    ? { icon: Zap, label: "Adiantado", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" }
    : { icon: TrendingUp, label: "No ritmo", cls: "bg-primary/10 text-primary border-primary/20" };

  const PaceIcon = paceCfg.icon;

  return (
    <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] ring-1 ring-white/10 ring-inset">
      <div className="flex min-w-0 flex-col">
        {daysToExam !== null ? (
          <div className="flex items-center gap-2 text-[13px] font-bold text-white/90">
            <Calendar className="h-4 w-4 text-[#00d2ff] animate-pulse-slow" />
            <span className="tracking-tight">
              {daysToExam === 0 ? "Prova hoje" : `${daysToExam} ${daysToExam === 1 ? "dia" : "dias"} para a prova`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] font-bold text-white/90">
            <Zap className="h-4 w-4 text-[#00d2ff]" />
            <span className="tracking-tight uppercase">Status do dia</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={`hidden xs:inline-flex gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border-0 ${paceCfg.cls} shadow-sm ring-1 ring-inset ring-white/10`}>
          <PaceIcon className="h-3 w-3" />
          {paceCfg.label}
        </Badge>
        {streak > 0 && (
          <Badge variant="outline" className="gap-1.5 text-[11px] font-black px-3 py-0.5 rounded-full border-0 bg-warning/20 text-warning shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-inset ring-warning/30">
            <Flame className="h-3.5 w-3.5 fill-warning animate-streak-fire" />
            {streak}d
          </Badge>
        )}
        <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />
        <Badge variant="secondary" className="text-[11px] font-black px-3 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/5 ring-1 ring-white/5">
          LVL {level}
        </Badge>
      </div>
    </div>
  );
}

export default memo(DashboardTopBar);
