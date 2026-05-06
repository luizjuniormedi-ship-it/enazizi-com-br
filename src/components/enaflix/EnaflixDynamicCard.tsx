import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock, Rocket, Target, Sparkles, Brain, Award, Play, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DynamicCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  progress?: number;
  footerInfo?: string;
  ctaText: string;
  onClick: () => void;
  accent?: "primary" | "warning" | "destructive" | "purple" | "info";
}

export function EnaflixDynamicCard({
  title,
  subtitle,
  description,
  badge,
  progress,
  footerInfo,
  ctaText,
  onClick,
  accent = "primary"
}: DynamicCardProps) {
  const accentClasses = {
    primary: "from-primary/20 to-transparent border-primary/20 text-primary",
    warning: "from-amber-500/20 to-transparent border-amber-500/20 text-amber-500",
    destructive: "from-destructive/20 to-transparent border-destructive/20 text-destructive",
    purple: "from-purple-500/20 to-transparent border-purple-500/20 text-purple-500",
    info: "from-blue-500/20 to-transparent border-blue-500/20 text-blue-500",
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative flex-shrink-0 cursor-pointer w-[280px] sm:w-[320px] h-full",
        "bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 overflow-hidden",
        "shadow-2xl transition-all duration-500",
        `hover:border-${accent}`
      )}
      onClick={onClick}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700", accentClasses[accent])} />
      
      <div className="relative z-10 flex flex-col h-full gap-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            {badge && (
              <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-white/10", accentClasses[accent].split(' ')[2])}>
                {badge}
              </span>
            )}
            <h3 className="text-lg font-black text-white line-clamp-1 group-hover:text-white transition-colors mt-2">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-white/40 font-medium line-clamp-1">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            {accent === "destructive" ? <AlertTriangle className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
          </div>
        </div>

        {description && (
          <p className="text-xs text-white/60 line-clamp-2 italic">
            "{description}"
          </p>
        )}

        {progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-tighter">
              <span className="text-white/40">Progresso</span>
              <span className="text-white/80">{progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn("h-full bg-gradient-to-r", accent === "primary" ? "from-primary to-blue-500" : `from-${accent} to-white`)}
              />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          {footerInfo ? (
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-black uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              <span>{footerInfo}</span>
            </div>
          ) : <div />}
          
          <div className="flex items-center gap-1.5 text-xs font-black text-white/90 uppercase tracking-tighter opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
            {ctaText} <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
