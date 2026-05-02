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
        "card-pixar group relative flex-shrink-0 cursor-pointer",
        sizeClasses[size],
        aspectClasses[aspectRatio],
        "hover:z-10",
      )}
      whileHover={{ scale: 1.05, y: -6 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      {image ? (
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#11132a] to-[#1d1f3a]">
          <Play className="h-12 w-12 text-white/15" />
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />

      {/* Badge */}
      {badge && (
        <div className="absolute left-3 top-3 z-10">
          <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white bg-[var(--pixar-grad-primary)] ring-1 ring-white/30 shadow-[0_4px_14px_-4px_hsl(var(--pixar-blue)/0.7)]">
            {badge}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-white/10 z-10">
          <div
            className="h-full bg-[var(--pixar-grad-primary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content (Visible on Hover) */}
      <div className={cn(
        "absolute inset-0 flex flex-col justify-end p-4 transition-all duration-300 z-10",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              className="btn-pixar h-10 w-10 !p-0 !rounded-full"
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
              aria-label="Reproduzir"
            >
              <Play className="h-4 w-4 fill-white text-white relative z-10" />
            </button>
            <button
              className="btn-pixar btn-pixar-ghost h-10 w-10 !p-0 !rounded-full"
              onClick={(e) => { e.stopPropagation(); onInfoClick?.(); }}
              aria-label="Mais informações"
            >
              <Info className="h-4 w-4 text-white relative z-10" />
            </button>
          </div>

          <h3 className="font-black text-sm sm:text-base leading-tight text-white line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-white/70 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Locked State */}
      {locked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 backdrop-blur-[2px]">
          <Lock className="h-8 w-8 text-white/50" />
        </div>
      )}
    </motion.div>
  );
}
