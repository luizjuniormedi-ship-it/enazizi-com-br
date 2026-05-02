import { LucideIcon, Play, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
      whileHover={{ 
        y: -10, 
        scale: 1.04,
        rotateY: variant === 'primary' ? 5 : -5,
        z: 50
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 350, damping: 15 }}
      onClick={onClick}
      className={cn(
        accentClass,
        "relative flex flex-col p-8 text-left group min-h-[190px] overflow-hidden perspective-1000",
      )}
      style={{ ['--card-hover-glow' as any]: 'true' }}
    >
      {/* Background Ambient Glow */}
      <div className={cn(
        "absolute -inset-24 opacity-0 group-hover:opacity-20 transition-opacity duration-700 blur-[80px] -z-10",
        variant === 'primary' ? "bg-primary" : "bg-violet-500"
      )} />
      
      {/* Animated Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
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

      <div className="mt-auto">
        <h3 className="text-xl font-black text-white mb-2 tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] group-hover:text-primary transition-colors duration-300">
          {title}
        </h3>
        <p className="text-sm text-white/60 leading-relaxed line-clamp-2 group-hover:text-white/80 transition-colors duration-300">
          {description}
        </p>
      </div>

      <div className="absolute bottom-6 right-8 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
          <Play className="h-4 w-4 text-white fill-current" />
        </div>
      </div>
    </motion.button>
  );
}
