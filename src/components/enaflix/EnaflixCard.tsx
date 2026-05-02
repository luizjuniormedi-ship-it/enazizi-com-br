import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Play, Info, Lock } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  title: string;
  subtitle?: string;
  image?: string;
  badge?: string;
  progress?: number;
  locked?: boolean;
  onClick?: () => void;
  onInfoClick?: () => void;
  aspectRatio?: "video" | "poster" | "square";
  size?: "sm" | "md" | "lg";
}

export function EnaflixCard({
  title,
  subtitle,
  image,
  badge,
  progress,
  locked,
  onClick,
  onInfoClick,
  aspectRatio = "video",
  size = "md"
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const aspectClasses = {
    video: "aspect-video",
    poster: "aspect-[2/3]",
    square: "aspect-square"
  };

  const sizeClasses = {
    sm: "w-[160px] sm:w-[200px]",
    md: "w-[240px] sm:w-[300px]",
    lg: "w-[320px] sm:w-[400px]"
  };

  return (
    <motion.div
      ref={cardRef}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-xl bg-[#1a1a1e] transition-all duration-500",
        sizeClasses[size],
        aspectClasses[aspectRatio],
        "hover:z-10 hover:ring-2 hover:ring-white/20 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      )}
      whileHover={{ scale: 1.05, y: -5 }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1e] to-[#2a2a2e]">
          <Play className="h-12 w-12 text-white/10" />
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Badge */}
      {badge && (
        <div className="absolute left-3 top-3">
          <span className="rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            {badge}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-white/10">
          <div 
            className="h-full bg-primary transition-all duration-500" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}

      {/* Content (Visible on Hover) */}
      <div className={cn(
        "absolute inset-0 flex flex-col justify-end p-4 transition-all duration-300",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
            <button 
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onInfoClick?.();
              }}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          
          <h3 className="font-bold text-sm sm:text-base leading-tight text-white line-clamp-2">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-white/60 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Locked State */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <Lock className="h-8 w-8 text-white/40" />
        </div>
      )}
    </motion.div>
  );
}
