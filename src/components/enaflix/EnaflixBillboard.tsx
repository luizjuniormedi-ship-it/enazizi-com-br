import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { getHeroArt, ENAFLIX_MASCOT } from "@/data/enaflix/enaflixArt";
import { EnaflixBadge } from "./EnaflixBadge";

interface Props {
  module: EnaflixModule;
  /** Tagline pequena sobre o título (ex.: "Recomendado pela IA") */
  eyebrow?: string;
  onNavigate?: (m: EnaflixModule) => void;
}

/**
 * EnaflixBillboard — hero full-bleed cinematográfico (Netflix/Apple TV).
 *
 * Vida adicionada nesta versão:
 * - Entrada cinematográfica (zoom suave + fade) na arte
 * - Stagger reveal de eyebrow → título → descrição → CTAs
 * - Parallax sutil reagindo a mouse (desktop) + scroll
 * - Glow ambient com "respiração" (breathe)
 * - Tudo em transform/opacity (GPU) e desligado em prefers-reduced-motion
 */
export function EnaflixBillboard({ module, eyebrow, onNavigate }: Props) {
  const navigate = useNavigate();
  const art = getHeroArt(module.id) ?? ENAFLIX_MASCOT;

  const sectionRef = useRef<HTMLElement>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  // Mouse parallax (desktop only). Movimento muito sutil (max ±10px).
  useEffect(() => {
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isCoarse || reduce) return;

    let raf = 0;
    const handler = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // -1 .. 1
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (e.clientY - cy) / (rect.height / 2);
        setParallax({ x: nx * 10, y: ny * 6 });
      });
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll parallax sutil (arte sobe lentamente — efeito cinematográfico)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handlePlay = () => {
    if (!module.route) return;
    onNavigate?.(module);
    navigate(module.route);
  };

  // Parallax compostos
  const artTransform = `translate3d(${parallax.x}px, ${parallax.y - scrollY * 0.08}px, 0)`;
  const glowTransform = `translate3d(${parallax.x * 1.4}px, ${parallax.y * 1.4 - scrollY * 0.04}px, 0)`;
  const textTransform = `translate3d(${parallax.x * -0.25}px, ${scrollY * 0.06}px, 0)`;

  return (
    <section
      ref={sectionRef}
      aria-label={`Destaque: ${module.title}`}
      className="relative w-full h-[78vh] min-h-[520px] max-h-[820px] overflow-hidden"
    >
      {/* Backdrop art (full-bleed, deslocado à direita) */}
      <div aria-hidden className="absolute inset-0">
        {/* Camada base ambiente */}
        <div className="absolute inset-0 bg-[#0a0a12]" />

        {/* Glow ambiente atrás da arte — respiração lenta */}
        <div
          className="absolute right-[5%] top-1/4 h-[60%] w-[45%] bg-gradient-radial from-primary/30 via-violet-500/10 to-transparent blur-3xl pointer-events-none animate-breathe will-change-transform"
          style={{ transform: glowTransform }}
        />

        {/* Arte hero dominante — entrada zoom-in + parallax */}
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-[70%] sm:w-[60%] lg:w-[55%]",
            "opacity-90 will-change-transform animate-hero-zoom-in",
          )}
          style={{ transform: artTransform }}
        >
          <img
            src={art}
            alt=""
            className="h-full w-full object-contain object-right drop-shadow-[0_30px_60px_rgba(0,0,0,0.7)] animate-float"
            loading="eager"
          />
        </div>

        {/* Gradiente cinematográfico esquerda → direita (legibilidade do texto) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a12] via-[#0a0a12]/85 via-40% to-transparent" />

        {/* Fade inferior para emergir o conteúdo seguinte (essencial para o efeito Netflix) */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-[#0a0a12]/80 to-[#0a0a12]" />

        {/* Vinheta superior sutil (deixa a topbar overlay legível) */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      {/* Conteúdo */}
      <div className="relative h-full flex items-end pb-20 sm:pb-28 px-4 sm:px-8 lg:px-14">
        <div
          className="max-w-2xl space-y-5 will-change-transform"
          style={{ transform: textTransform }}
        >
          {eyebrow && (
            <div
              className="inline-flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.25em] font-bold text-white/70 opacity-0 animate-text-reveal"
              style={{ animationDelay: "120ms" }}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{eyebrow}</span>
            </div>
          )}

          {module.badge && (
            <div
              className="opacity-0 animate-text-reveal"
              style={{ animationDelay: "240ms" }}
            >
              <EnaflixBadge type={module.badge} />
            </div>
          )}

          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[0.95] drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] opacity-0 animate-text-reveal"
            style={{ animationDelay: "320ms" }}
          >
            {module.title}
          </h1>

          <p
            className="text-base sm:text-lg text-white/80 leading-relaxed max-w-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] opacity-0 animate-text-reveal"
            style={{ animationDelay: "460ms" }}
          >
            {module.description}
          </p>

          <div
            className="flex items-center gap-3 pt-2 opacity-0 animate-text-reveal"
            style={{ animationDelay: "600ms" }}
          >
            <button
              type="button"
              onClick={handlePlay}
              className={cn(
                "group relative overflow-hidden inline-flex items-center gap-2.5 px-7 py-3 rounded-md",
                "bg-white text-black font-bold text-base",
                "hover:bg-white/95 transition-all duration-300 ease-out hover:scale-[1.04] active:scale-[0.98]",
                "shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)] hover:shadow-[0_14px_36px_-10px_rgba(255,255,255,0.55)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12]",
              )}
            >
              {/* Shine sweep on hover */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shine-sweep pointer-events-none"
              />
              <Play className="relative h-5 w-5 fill-black" />
              <span className="relative">Começar agora</span>
            </button>

            <button
              type="button"
              onClick={handlePlay}
              className={cn(
                "inline-flex items-center gap-2.5 px-6 py-3 rounded-md",
                "bg-white/15 hover:bg-white/25 text-white font-semibold text-base",
                "backdrop-blur-md border border-white/10 hover:border-white/20",
                "transition-all duration-300 ease-out hover:scale-[1.03] active:scale-[0.98]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              )}
            >
              <Info className="h-5 w-5" />
              <span>Saiba mais</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
