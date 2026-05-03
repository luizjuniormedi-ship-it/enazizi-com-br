import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Sparkles, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface VideoLesson {
  id: string;
  title: string;
  thumbnail_url?: string;
  specialty: string;
  is_gold_content?: boolean;
  duration_seconds?: number;
  progress?: number;
}

interface Props {
  title: string;
  subtitle?: string;
  lessons: VideoLesson[];
}

export function EnaflixSectionRowVideo({ title, subtitle, lessons }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const navigate = useNavigate();

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [lessons]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (!lessons.length) return null;

  return (
    <section className="space-y-4 group/section relative">
      <div className="flex items-end justify-between gap-3 px-4 sm:px-8 lg:px-14">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="h-4 w-1 bg-primary rounded-full" />
             <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">{title}</h2>
          </div>
          {subtitle && <p className="text-sm text-white/40 font-medium">{subtitle}</p>}
        </div>
      </div>

      <div className="relative group/scroller">
        {/* Navigation Arrows - Premium Overlay */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scrollBy(-1)}
              className="absolute left-0 top-0 bottom-6 z-30 w-12 sm:w-16 bg-gradient-to-r from-[#0a0a12] to-transparent flex items-center justify-start pl-2 sm:pl-4 text-white/40 hover:text-white transition-all group/arrow"
            >
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/40 backdrop-blur-md border border-white/5 flex items-center justify-center group-hover/arrow:scale-110 transition-transform">
                <ChevronLeft className="h-6 w-6" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => scrollBy(1)}
              className="absolute right-0 top-0 bottom-6 z-30 w-12 sm:w-16 bg-gradient-to-l from-[#0a0a12] to-transparent flex items-center justify-end pr-2 sm:pr-4 text-white/40 hover:text-white transition-all group/arrow"
            >
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/40 backdrop-blur-md border border-white/5 flex items-center justify-center group-hover/arrow:scale-110 transition-transform">
                <ChevronRight className="h-6 w-6" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className={cn(
            "flex gap-4 sm:gap-6 overflow-x-auto pb-8 pt-2 scroll-smooth px-4 sm:px-8 lg:px-14",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          )}
        >
          {lessons.map((lesson) => (
            <VideoCard key={lesson.id} lesson={lesson} onClick={() => navigate(`/dashboard/videoaulas/${lesson.id}`)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoCard({ lesson, onClick }: { lesson: VideoLesson; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="snap-start shrink-0 w-[260px] sm:w-[320px] relative"
    >
      <div 
        className={cn(
          "relative aspect-video rounded-2xl overflow-hidden bg-[#1a1a2e] border transition-all duration-500 cursor-pointer shadow-2xl",
          hovered ? "scale-105 z-20 border-primary shadow-primary/20 -translate-y-2" : "border-white/5"
        )}
        onClick={onClick}
      >
        {/* Thumbnail with Overlay */}
        {lesson.thumbnail_url ? (
          <img 
            src={lesson.thumbnail_url} 
            className={cn("w-full h-full object-cover transition-transform duration-700", hovered && "scale-110")} 
            alt={lesson.title} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-violet-500/10">
            <Play className="h-12 w-12 text-white/20" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        {/* Header Badges */}
        <div className="absolute top-3 left-3 flex gap-2 z-10">
          <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] h-5 font-black uppercase tracking-widest">
            {lesson.specialty}
          </Badge>
          {lesson.is_gold_content && (
            <Badge className="bg-yellow-500/90 text-black text-[10px] h-5 font-black gap-1 border-none shadow-lg">
              <Star className="h-3 w-3 fill-black" /> GOLD
            </Badge>
          )}
        </div>

        {/* Play Icon - Premium style */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500",
          hovered ? "bg-black/40 opacity-100" : "opacity-0"
        )}>
          <div className="h-14 w-14 bg-primary rounded-full flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.5)] ring-4 ring-white/10">
            <Play className="h-6 w-6 fill-white ml-1 text-white" />
          </div>
        </div>

        {/* Progress Bar (if exists) */}
        {lesson.progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div 
              className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" 
              style={{ width: `${lesson.progress}%` }} 
            />
          </div>
        )}

        {/* Duration / Info Overlay */}
        {!hovered && (
          <div className="absolute bottom-3 right-3 text-[10px] font-black text-white/60 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/5">
            {lesson.duration_seconds ? `${Math.floor(lesson.duration_seconds / 60)}:00` : "Duração Variável"}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className={cn(
        "mt-4 space-y-2 transition-all duration-500 px-1",
        hovered ? "opacity-100" : "opacity-80"
      )}>
        <h3 className={cn(
          "text-base font-bold text-white line-clamp-1 transition-colors",
          hovered && "text-primary"
        )}>
          {lesson.title}
        </h3>
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/30">
          <div className="flex items-center gap-2">
             <Clock className="h-3 w-3" />
             <span>{lesson.duration_seconds ? `${Math.floor(lesson.duration_seconds / 60)} min` : "Video IA"}</span>
          </div>
          <div className="flex items-center gap-1.5">
             <Sparkles className="h-3 w-3 text-primary" />
             <span>CME v5.0</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
