import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENAFLIX_ACCENT_GRADIENTS } from "@/data/enaflix/enaflixBadges";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { getHeroArt } from "@/data/enaflix/enaflixArt";
import { EnaflixBadge } from "./EnaflixBadge";

interface Props {
  module: EnaflixModule;
  /** Quando true, marca como bloqueado (sem rota / em breve) */
  comingSoon?: boolean;
  onNavigate?: (m: EnaflixModule) => void;
  /** Tamanho visual do card */
  size?: "default" | "hero";
}

/**
 * EnaflixModuleCard — cartão cartoon premium com vida cinematográfica.
 *
 * Vida adicionada:
 * - Tilt 3D sutil (max 6deg) reagindo ao mouse no desktop
 * - Hover lift + zoom + shine sweep elegante
 * - Idle float contínuo na arte (com delay determinístico por id)
 * - Tudo em transform/opacity (GPU) — sem reflow
 * - Tilt desativado em pointer:coarse e prefers-reduced-motion
 */
export function EnaflixModuleCard({ module, comingSoon, onNavigate, size = "default" }: Props) {
  const navigate = useNavigate();
  const Icon = module.icon;
  const accent = module.accent ?? "primary";
  const gradient = ENAFLIX_ACCENT_GRADIENTS[accent] ?? ENAFLIX_ACCENT_GRADIENTS.primary;
  const disabled = comingSoon || !module.route;
  const badge = disabled ? "em-breve" : module.badge;
  const heroArt = getHeroArt(module.id);

  // Delay determinístico por id (varia 0–1.6s) para o float não ficar sincronizado
  const floatDelay = `${(module.id.charCodeAt(0) % 8) * 0.2}s`;

  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, hovered: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    // tilt limitado a ±6deg
    const ry = (px - 0.5) * 12;
    const rx = (0.5 - py) * 8;
    setTilt({ rx, ry, hovered: true });
  };

  const handleMouseLeave = () => setTilt({ rx: 0, ry: 0, hovered: false });

  const handleClick = () => {
    if (disabled || !module.route) return;
    onNavigate?.(module);
    navigate(module.route);
  };

  const isHero = size === "hero";

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      aria-label={`${module.title} — ${module.description}`}
      className={cn(
        "group relative shrink-0 rounded-2xl overflow-hidden text-left isolate",
        "bg-gradient-to-br from-white/[0.07] to-white/[0.02]",
        "border border-white/10",
        "transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        "[transform-style:preserve-3d] will-change-transform",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isHero
          ? "w-[280px] sm:w-[340px] h-[200px] sm:h-[230px]"
          : "w-[220px] sm:w-[260px] h-[160px] sm:h-[180px]",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:border-white/30 hover:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.7)] cursor-pointer",
      )}
      style={{
        transform: tilt.hovered
          ? `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-4px) scale(1.04)`
          : "perspective(900px) rotateX(0) rotateY(0) translateY(0) scale(1)",
      }}
    >
      {/* Accent gradient overlay */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-90 transition-opacity duration-500 group-hover:opacity-100",
          gradient,
        )}
      />
      {/* Inner top sheen */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent opacity-70"
      />
      {/* Vignette inferior para legibilidade do texto */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
      />
      {/* Glow externo no hover */}
      <div
        aria-hidden
        className={cn(
          "absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none",
          "bg-gradient-to-br from-primary/30 via-transparent to-transparent blur-xl",
        )}
      />
      {/* Shine cinematográfico no hover (sweep diagonal premium) */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/2 -skew-x-12",
            "bg-gradient-to-r from-transparent via-white/25 to-transparent",
            "-translate-x-[120%] opacity-0",
            "group-hover:opacity-100 group-hover:animate-shine-sweep",
          )}
        />
      </div>

      {/* Arte hero (ilustração 3D ou ícone fallback) */}
      {heroArt ? (
        <div
          aria-hidden
          className={cn(
            "absolute pointer-events-none transition-transform duration-700 ease-out",
            "group-hover:scale-110 group-hover:-rotate-3",
            isHero
              ? "right-1 -bottom-2 h-[140%] w-[60%]"
              : "right-0 -bottom-3 h-[120%] w-[55%]",
          )}
          style={{
            animation: `float 6s ease-in-out infinite`,
            animationDelay: floatDelay,
            transform: tilt.hovered
              ? `translateZ(20px)`
              : undefined,
          }}
        >
          <img
            src={heroArt}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className={cn(
            "absolute right-3 top-3 flex items-center justify-center rounded-2xl",
            "bg-white/15 backdrop-blur-md border border-white/20 shadow-lg",
            "transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6",
            isHero ? "h-14 w-14" : "h-12 w-12",
          )}
          style={{ animation: `float 6s ease-in-out infinite`, animationDelay: floatDelay }}
        >
          <Icon className={cn("text-white drop-shadow-lg", isHero ? "h-7 w-7" : "h-6 w-6")} />
        </div>
      )}

      {/* Badge */}
      {badge && (
        <div className="absolute top-3 left-3 z-10">
          <EnaflixBadge type={badge} />
        </div>
      )}

      {/* Conteúdo textual (overlay sobre a arte) */}
      <div
        className="relative h-full flex flex-col justify-end p-4 z-10"
        style={{ transform: tilt.hovered ? "translateZ(30px)" : undefined }}
      >
        <div className="space-y-1 max-w-[60%]">
          <h3 className={cn(
            "font-black text-white leading-tight line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]",
            isHero ? "text-lg" : "text-base",
          )}>
            {module.title}
          </h3>
          <p className={cn(
            "text-white/85 line-clamp-2 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]",
            isHero ? "text-sm" : "text-xs",
          )}>
            {module.description}
          </p>
        </div>

        {/* CTA arrow */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-20">
          <div className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-md",
            disabled ? "bg-white/20" : "bg-white/30 ring-1 ring-white/40",
          )}>
            {disabled ? (
              <Lock className="h-3.5 w-3.5 text-white" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
