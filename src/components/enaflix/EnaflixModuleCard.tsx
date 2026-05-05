import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { getHeroArtEntry } from "@/data/enaflix/enaflixArt";
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
 * Halo radial por accent — desenha o glow volumétrico atrás da arte.
 * Em vez de gradiente linear genérico, usamos um radial-gradient ancorado
 * na borda direita (onde a arte vive), criando profundidade Pixar/Disney+.
 */
const ACCENT_HALO: Record<string, string> = {
  primary: "bg-[radial-gradient(circle_at_75%_50%,hsl(var(--primary)/0.55),transparent_65%)]",
  warning: "bg-[radial-gradient(circle_at_75%_50%,hsl(38_92%_50%/0.55),transparent_65%)]",
  success: "bg-[radial-gradient(circle_at_75%_50%,hsl(160_84%_39%/0.55),transparent_65%)]",
  destructive: "bg-[radial-gradient(circle_at_75%_50%,hsl(var(--destructive)/0.55),transparent_65%)]",
  info: "bg-[radial-gradient(circle_at_75%_50%,hsl(199_89%_48%/0.55),transparent_65%)]",
  purple: "bg-[radial-gradient(circle_at_75%_50%,hsl(262_83%_58%/0.55),transparent_65%)]",
  pink: "bg-[radial-gradient(circle_at_75%_50%,hsl(330_81%_60%/0.55),transparent_65%)]",
};

/** Cor do glow externo no hover (rim cinematográfico). */
const ACCENT_RIM: Record<string, string> = {
  primary: "shadow-[0_0_60px_-10px_hsl(var(--primary)/0.65)]",
  warning: "shadow-[0_0_60px_-10px_hsl(38_92%_50%/0.65)]",
  success: "shadow-[0_0_60px_-10px_hsl(160_84%_39%/0.65)]",
  destructive: "shadow-[0_0_60px_-10px_hsl(var(--destructive)/0.65)]",
  info: "shadow-[0_0_60px_-10px_hsl(199_89%_48%/0.65)]",
  purple: "shadow-[0_0_60px_-10px_hsl(262_83%_58%/0.65)]",
  pink: "shadow-[0_0_60px_-10px_hsl(330_81%_60%/0.65)]",
};

/**
 * EnaflixModuleCard V2 — cartão cinematográfico Pixar/Disney+/Netflix.
 *
 * Camadas (de trás para frente):
 *  1. Background base (preto profundo)
 *  2. Halo radial por accent (cor do módulo dominando o lado direito)
 *  3. Backdrop art em modo "cover" (fullbleed, não mais ícone solto)
 *  4. Vinheta esquerda → direita (legibilidade do texto)
 *  5. Vinheta inferior (suaviza a leitura)
 *  6. Noise overlay sutil (textura premium)
 *  7. Shine sweep cinematográfico (apenas no hover)
 *  8. Conteúdo textual + badge + CTA
 *
 * Vida (motion):
 *  - Tilt 3D sutil (max 6deg) reagindo ao mouse no desktop
 *  - Hover lift + glow rim por accent
 *  - Idle float contínuo na arte com paralaxe (translateZ)
 *  - Tudo em transform/opacity (GPU)
 *  - Tilt desativado em pointer:coarse e prefers-reduced-motion
 */
export function EnaflixModuleCard({ module, comingSoon, onNavigate, size = "default" }: Props) {
  const navigate = useNavigate();
  const Icon = module.icon;
  const accent = module.accent ?? "primary";
  const halo = ACCENT_HALO[accent] ?? ACCENT_HALO.primary;
  const rim = ACCENT_RIM[accent] ?? ACCENT_RIM.primary;
  const disabled = comingSoon || !module.route;
  const badge = disabled ? "em-breve" : module.badge;
  const artEntry = getHeroArtEntry(module.id);
  const heroArt = artEntry?.image;

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
    if (module.id === "dashboard") {
      navigate("/dashboard");
    } else {
      navigate(module.route);
    }
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
        "bg-[#0a0a12]",
        "border border-white/[0.08]",
        "transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        "[transform-style:preserve-3d] will-change-transform",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isHero
          ? "w-[280px] sm:w-[340px] h-[200px] sm:h-[230px]"
          : "w-[220px] sm:w-[260px] h-[160px] sm:h-[180px]",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : ["hover:border-white/25", "cursor-pointer", `hover:${rim}`],
      )}
      style={{
        transform: tilt.hovered
          ? `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-4px) scale(1.04)`
          : "perspective(900px) rotateX(0) rotateY(0) translateY(0) scale(1)",
      }}
    >
      {/* CAMADA 1 — Backdrop art em modo cover (full-bleed) */}
      {heroArt && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 transition-transform duration-700 ease-out",
            "group-hover:scale-110",
          )}
          style={{
            backgroundImage: `url(${heroArt})`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
            transform: tilt.hovered ? "translateZ(10px)" : undefined,
            animation: `float 8s ease-in-out infinite`,
            animationDelay: floatDelay,
          }}
        />
      )}

      {/* CAMADA 2 — Halo radial por accent (cor dominando o lado direito) */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 mix-blend-screen opacity-70 transition-opacity duration-500",
          "group-hover:opacity-90",
          halo,
        )}
      />

      {/* CAMADA 3 — Vinheta esquerda → direita (legibilidade) */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0a0a12] via-[#0a0a12]/70 via-30% to-transparent"
      />

      {/* CAMADA 4 — Vinheta inferior (suaviza leitura do título) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
      />

      {/* CAMADA 5 — Noise overlay sutil (textura premium) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* CAMADA 6 — Shine cinematográfico no hover (sweep diagonal premium) */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/2 -skew-x-12",
            "bg-gradient-to-r from-transparent via-white/20 to-transparent",
            "-translate-x-[120%] opacity-0",
            "group-hover:opacity-100 group-hover:animate-shine-sweep",
          )}
        />
      </div>

      {/* CAMADA 7 — Fallback ícone (apenas se não houver arte) */}
      {!heroArt && (
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

      {/* CAMADA 8 — Conteúdo textual */}
      <div
        className="relative h-full flex flex-col justify-end p-4 z-10"
        style={{ transform: tilt.hovered ? "translateZ(30px)" : undefined }}
      >
        <div className="space-y-1 max-w-[65%]">
          <h3
            className={cn(
              "font-black text-white leading-tight line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] tracking-tight",
              isHero ? "text-lg" : "text-base",
            )}
          >
            {module.title}
          </h3>
          <p
            className={cn(
              "text-white/80 line-clamp-2 leading-snug drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]",
              isHero ? "text-sm" : "text-xs",
            )}
          >
            {module.description}
          </p>
        </div>

        {/* CTA arrow */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-20">
          <div
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-md",
              disabled ? "bg-white/20" : "bg-white/30 ring-1 ring-white/40",
            )}
          >
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
