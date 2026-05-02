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
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col p-6 rounded-2xl border text-left transition-all duration-300 overflow-hidden group",
        variant === "primary"
          ? "bg-primary/10 border-primary/20 hover:bg-primary/20"
          : "bg-white/5 border-white/5 hover:bg-white/10"
      )}
    >
      {/* Glow Effect */}
      <div className={cn(
        "absolute -top-12 -right-12 w-24 h-24 blur-[40px] rounded-full opacity-20 transition-opacity group-hover:opacity-40",
        variant === "primary" ? "bg-primary" : "bg-white"
      )} />

      {badge && (
        <span className="absolute top-4 right-4 bg-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider text-white">
          {badge}
        </span>
      )}

      <div className={cn(
        "h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
        variant === "primary" ? "bg-primary text-white shadow-glow-sm" : "bg-white/10 text-white/60"
      )}>
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed line-clamp-2">{description}</p>
    </motion.button>
  );
}
