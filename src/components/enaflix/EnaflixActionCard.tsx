import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "primary" | "secondary";
  badge?: string;
}

export function EnaflixActionCard({ title, description, icon: Icon, onClick, variant = "secondary", badge }: Props) {
  const accentClass =
    variant === "primary" ? "card-pixar" : "card-pixar card-pixar-violet";
  const iconBg =
    variant === "primary"
      ? "bg-[var(--pixar-grad-primary)] shadow-[0_8px_22px_-8px_hsl(var(--pixar-blue)/0.7),0_1px_0_hsl(0_0%_100%/0.4)_inset]"
      : "bg-[var(--pixar-grad-violet)] shadow-[0_8px_22px_-8px_hsl(var(--pixar-violet)/0.7),0_1px_0_hsl(0_0%_100%/0.4)_inset]";

  return (
    <motion.button
      whileHover={{ y: -6, scale: 1.025 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      onClick={onClick}
      className={cn(
        accentClass,
        "relative flex flex-col p-6 text-left group min-h-[170px]",
      )}
      style={{ ['--card-hover-glow' as any]: 'true' }}
    >
      {badge && (
        <span className="absolute top-4 right-4 z-10 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white bg-[var(--pixar-grad-primary)] shadow-[0_4px_14px_-4px_hsl(var(--pixar-blue)/0.7)] ring-1 ring-white/30">
          {badge}
        </span>
      )}

      <div
        className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-white/25",
          "transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 pixar-breathe",
          iconBg,
        )}
      >
        <Icon className="h-7 w-7 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]" />
      </div>

      <h3 className="text-lg font-black text-white mb-1.5 tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
        {title}
      </h3>
      <p className="text-sm text-white/70 leading-relaxed line-clamp-2">{description}</p>
    </motion.button>
  );
}
