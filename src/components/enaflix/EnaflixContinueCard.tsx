import { MessageSquare, ArrowRight, Clock, Target, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ContinueCardProps {
  title: string;
  category: string;
  /** Progresso real (0-100). Se omitido, a barra é ocultada para evitar dado fake. */
  progress?: number;
  lastAccess: string;
  timeLeft?: string;
  onClick?: () => void;
  className?: string;
}

export function EnaflixContinueCard({
  title,
  category,
  progress,
  lastAccess,
  timeLeft,
  onClick,
  className,
}: ContinueCardProps) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative flex-shrink-0 cursor-pointer w-[280px] sm:w-[320px]",
        "bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 overflow-hidden",
        "shadow-2xl hover:shadow-primary/20 hover:border-primary/30 transition-all duration-500",
        className
      )}
    >
      {/* Glow Effect */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="relative z-10 flex flex-col h-full gap-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
              {category}
            </span>
            <h3 className="text-lg font-black text-white line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
            <Rocket className="h-4 w-4 text-white/40 group-hover:text-primary" />
          </div>
        </div>

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
              className="h-full bg-gradient-to-r from-primary via-violet-500 to-primary/80 shadow-[0_0_10px_rgba(var(--pixar-blue),0.5)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40">
              <Clock className="h-3 w-3" />
              <span>{lastAccess}</span>
            </div>
            {timeLeft && (
              <span className="text-[10px] font-bold text-primary/60">
                ⏱ {timeLeft} restantes
              </span>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
             <div className="flex items-center gap-1.5 text-xs font-black text-primary uppercase tracking-tighter">
               Continuar <ArrowRight className="h-3 w-3" />
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
