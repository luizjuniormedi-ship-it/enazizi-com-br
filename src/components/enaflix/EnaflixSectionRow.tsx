import { useRef } from "react";
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

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (!modules.length) return null;

  return (
    <section className="space-y-3 group/section">
      <div className="flex items-end justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-white/50 mt-0.5">{subtitle}</p>}
        </div>

        {/* Setas desktop */}
        <div className="hidden md:flex gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Rolar para a esquerda"
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Rolar para a direita"
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
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
          {modules.map((m) => (
            <div key={m.id} className="snap-start">
              <EnaflixModuleCard module={m} onNavigate={onNavigate} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
