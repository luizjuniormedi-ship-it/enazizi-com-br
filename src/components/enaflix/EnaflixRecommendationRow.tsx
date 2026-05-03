import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight, Play } from "lucide-react";

interface RecommendationCardProps {
  title: string;
  reason: string;
  imageUrl?: string;
  onClick?: () => void;
  className?: string;
}

export function EnaflixRecommendationCard({
  title,
  reason,
  imageUrl,
  onClick,
  className,
}: RecommendationCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={cn(
        "group relative w-full h-[180px] sm:h-[220px] rounded-[32px] overflow-hidden cursor-pointer",
        "bg-slate-900 border border-white/5 shadow-2xl",
        className
      )}
    >
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />
      )}
      
      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
      
      <div className="relative z-10 h-full p-6 sm:p-8 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 shadow-[0_0_15px_rgba(var(--pixar-blue),0.3)]">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">IA Sugere</span>
          </div>
          
          <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
             <Play className="h-4 w-4 text-white fill-current" />
          </div>
        </div>

        <div className="space-y-2 max-w-lg">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter drop-shadow-xl group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm sm:text-base text-white/60 italic line-clamp-2">
            "{reason}"
          </p>
        </div>
      </div>
      
      {/* Interactive Edge */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-violet-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
    </motion.div>
  );
}
