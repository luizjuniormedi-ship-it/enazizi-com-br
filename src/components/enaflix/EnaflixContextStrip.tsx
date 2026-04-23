/**
 * EnaflixContextStrip — faixa contextual fina exibida acima do título do billboard.
 *
 * Mostra apenas o que é genuinamente útil ao aluno no momento da abertura do hub:
 *  - Revisões vencidas (urgência real)
 *  - Streak (continuidade)
 *  - Dias até a banca (pressão temporal)
 *
 * Visual silencioso: sem glow, sem gradients fucsia. Apenas tipografia +
 * separadores. Quando não há dados relevantes, o componente não renderiza.
 */
import { Clock, Flame, CalendarDays } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function EnaflixContextStrip() {
  const navigate = useNavigate();
  const { data } = useDashboardData();
  const metrics = data?.metrics;
  const stats = data?.stats;

  const pending = metrics?.pendingRevisoes ?? 0;
  const streak = metrics?.gamificationStreak ?? 0;
  const days = stats?.daysUntilExam ?? null;

  const items: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    urgent?: boolean;
    onClick?: () => void;
  }> = [];

  if (pending > 0) {
    items.push({
      icon: Clock,
      label: `${pending} revis${pending === 1 ? "ão" : "ões"} vencida${pending === 1 ? "" : "s"}`,
      urgent: true,
      onClick: () => navigate("/dashboard/sessao-estudo?focus=reviews&auto=1"),
    });
  }
  if (streak >= 2) {
    items.push({
      icon: Flame,
      label: `${streak} dias seguidos`,
    });
  }
  if (days !== null) {
    items.push({
      icon: CalendarDays,
      label: `${days} dia${days === 1 ? "" : "s"} até a banca`,
      urgent: days <= 30,
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      className="inline-flex items-center gap-3 sm:gap-4 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-sm opacity-0 animate-text-reveal"
      style={{ animationDelay: "60ms" }}
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        const Comp = item.onClick ? "button" : "span";
        return (
          <Comp
            key={i}
            onClick={item.onClick}
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium",
              item.onClick && "hover:text-white transition-colors",
              item.urgent ? "text-amber-300" : "text-white/75",
              i > 0 && "border-l border-white/10 pl-3 sm:pl-4",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
          </Comp>
        );
      })}
    </div>
  );
}
