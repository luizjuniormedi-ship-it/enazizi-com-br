
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface VideoLesson {
  id: string;
  title: string;
  thumbnail_url?: string;
  specialty: string;
  is_gold_content?: boolean;
  duration_seconds?: number;
}

interface Props {
  title: string;
  subtitle?: string;
  lessons: VideoLesson[];
}

export function EnaflixSectionRowVideo({ title, subtitle, lessons }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (!lessons.length) return null;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "space-y-3 group/section transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
      )}
    >
      <div className="flex items-end justify-between gap-3 px-4 sm:px-8 lg:px-14">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-white/50 mt-0.5">{subtitle}</p>}
        </div>

        <div className="hidden md:flex gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className={cn(
            "flex gap-4 overflow-x-auto pb-6 scroll-smooth px-4 sm:px-8 lg:px-14",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          )}
        >
          {lessons.map((lesson, i) => (
            <div
              key={lesson.id}
              className={cn(
                "snap-start shrink-0 w-[240px] sm:w-[280px] group/card transition-all duration-700",
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              )}
              style={{ transitionDelay: visible ? `${Math.min(i, 8) * 60}ms` : "0ms" }}
            >
              <div 
                className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer group-hover/card:scale-105 group-hover/card:border-primary/50 transition-all duration-500 shadow-xl"
                onClick={() => navigate(`/dashboard/videoaulas/${lesson.id}`)}
              >
                {lesson.thumbnail_url ? (
                  <img src={lesson.thumbnail_url} className="w-full h-full object-cover" alt={lesson.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10"><Play className="h-10 w-10" /></div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 left-2 flex gap-1">
                  <Badge className="bg-primary/80 text-[9px] h-4">{lesson.specialty}</Badge>
                  {lesson.is_gold_content && (
                    <Badge className="bg-yellow-500 text-black text-[9px] h-4 gap-1">
                      <Sparkles className="h-2 w-2" /> OURO
                    </Badge>
                  )}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity bg-black/40">
                  <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <h3 className="text-sm font-bold text-white line-clamp-1 group-hover/card:text-primary transition-colors">{lesson.title}</h3>
                <div className="flex justify-between text-[10px] text-white/40">
                  <span>{lesson.duration_seconds ? `${Math.floor(lesson.duration_seconds / 60)} min` : "Vídeo IA"}</span>
                  <span className="flex items-center gap-1"><Sparkles className="h-2 w-2 text-primary" /> CME 9.2</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
