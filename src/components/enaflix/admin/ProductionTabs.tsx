import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Tab { value: string; label: string; count?: number }
interface Props {
  tabs: Tab[];
  value: string;
  onChange: (v: string) => void;
}

export function ProductionTabs({ tabs, value, onChange }: Props) {
  return (
    <div className="relative flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-1.5">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "relative px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors",
              active ? "text-white" : "text-white/50 hover:text-white/80",
            )}
          >
            {active && (
              <motion.span
                layoutId="prod-tab-active"
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/30 border border-violet-400/40 shadow-[0_0_24px_-8px_rgba(139,92,246,0.7)]"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {t.label}
              {typeof t.count === "number" && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-white/10 text-white/60",
                )}>
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
