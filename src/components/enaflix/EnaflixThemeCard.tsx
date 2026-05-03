import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ThemeCardProps {
  title: string;
  icon: string;
  gradient: string;
  onClick?: () => void;
  className?: string;
}

export function EnaflixThemeCard({
  title,
  icon,
  gradient,
  onClick,
  className,
}: ThemeCardProps) {
  return (
    <motion.button
      whileHover={{ y: -8, scale: 1.05, rotateZ: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "group relative flex-shrink-0 w-[140px] sm:w-[180px] aspect-[4/5] rounded-[32px] overflow-hidden p-6 text-left",
        "border border-white/10 shadow-xl",
        className
      )}
    >
      {/* Background Gradient */}
      <div className={cn("absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500", gradient)} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
      
      {/* Animated Glow */}
      <div className={cn("absolute -inset-20 opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-3xl", gradient)} />

      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500">
          {icon}
        </div>
        
        <div className="space-y-1">
          <h3 className="font-black text-lg sm:text-xl text-white leading-tight tracking-tighter drop-shadow-md">
            {title}
          </h3>
          <div className="h-1 w-8 bg-white/20 rounded-full group-hover:w-12 group-hover:bg-primary transition-all duration-500" />
        </div>
      </div>
    </motion.button>
  );
}
