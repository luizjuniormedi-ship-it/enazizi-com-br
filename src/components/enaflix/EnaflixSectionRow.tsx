import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { EnaflixModuleCard } from "./EnaflixModuleCard";

interface Props {
  title: string;
  subtitle?: string;
  modules: EnaflixModule[];
  onNavigate?: (m: EnaflixModule) => void;
}

export function EnaflixSectionRow({ title, subtitle, modules, onNavigate }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  // Lazy reveal ao entrar no viewport (uma vez só)
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
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

  if (!modules.length) return null;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "space-y-3 group/section transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
      )}
    >
      <div className="flex items-end justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-white/50 mt-0.5">{subtitle}</p>}
        </div>

        {/* Setas desktop */}
        <div className="hidden md:flex gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Rolar para a esquerda"
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Rolar para a direita"
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className={cn(
            "flex gap-3 sm:gap-4 overflow-x-auto pb-2 scroll-smooth",
            "px-4 sm:px-6 lg:px-10",
            "[scrollbar-width:none] [-ms-overflow-style:none]",
            "[&::-webkit-scrollbar]:hidden",
            "snap-x snap-mandatory",
          )}
        >
          {modules.map((m, i) => (
            <div
              key={m.id}
              className={cn(
                "snap-start transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              )}
              style={{ transitionDelay: visible ? `${Math.min(i, 8) * 60}ms` : "0ms" }}
            >
              <EnaflixModuleCard module={m} onNavigate={onNavigate} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
