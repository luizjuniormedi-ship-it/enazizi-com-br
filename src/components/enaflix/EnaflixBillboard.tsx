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
 * EnaflixBillboard — hero full-bleed estilo Netflix/Apple TV.
 *
 * Ocupa o topo da tela, com arte gigante à direita, fade cinematográfico
 * para o fundo (#0a0a12), CTAs primários grandes e respiração generosa.
 *
 * O conteúdo abaixo "emerge" do gradiente, criando profundidade real —
 * a topbar overlay flutua sobre tudo isso.
 */
export function EnaflixBillboard({ module, eyebrow, onNavigate }: Props) {
  const navigate = useNavigate();
  const art = getHeroArt(module.id) ?? ENAFLIX_MASCOT;

  const handlePlay = () => {
    if (!module.route) return;
    onNavigate?.(module);
    navigate(module.route);
  };

  return (
    <section
      aria-label={`Destaque: ${module.title}`}
      className="relative w-full h-[78vh] min-h-[520px] max-h-[820px] overflow-hidden"
    >
      {/* Backdrop art (full-bleed, deslocado à direita) */}
      <div aria-hidden className="absolute inset-0">
        {/* Camada base ambiente */}
        <div className="absolute inset-0 bg-[#0a0a12]" />

        {/* Arte hero dominante */}
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-[70%] sm:w-[60%] lg:w-[55%]",
            "opacity-90",
          )}
        >
          <img
            src={art}
            alt=""
            className="h-full w-full object-contain object-right drop-shadow-[0_30px_60px_rgba(0,0,0,0.7)] animate-[float_8s_ease-in-out_infinite]"
            loading="eager"
          />
        </div>

        {/* Glow ambiente atrás da arte */}
        <div className="absolute right-[5%] top-1/4 h-[60%] w-[45%] bg-gradient-radial from-primary/30 via-violet-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Gradiente cinematográfico esquerda → direita (legibilidade do texto) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a12] via-[#0a0a12]/85 via-40% to-transparent" />

        {/* Fade inferior para emergir o conteúdo seguinte (essencial para o efeito Netflix) */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-[#0a0a12]/80 to-[#0a0a12]" />

        {/* Vinheta superior sutil (deixa a topbar overlay legível) */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      {/* Conteúdo */}
      <div className="relative h-full flex items-end pb-20 sm:pb-28 px-4 sm:px-8 lg:px-14">
        <div className="max-w-2xl space-y-5 animate-fade-in">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.25em] font-bold text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{eyebrow}</span>
            </div>
          )}

          {module.badge && (
            <div>
              <EnaflixBadge type={module.badge} />
            </div>
          )}

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[0.95] drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
            {module.title}
          </h1>

          <p className="text-base sm:text-lg text-white/80 leading-relaxed max-w-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {module.description}
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePlay}
              className={cn(
                "inline-flex items-center gap-2.5 px-7 py-3 rounded-md",
                "bg-white text-black font-bold text-base",
                "hover:bg-white/90 transition-all duration-200",
                "shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12]",
              )}
            >
              <Play className="h-5 w-5 fill-black" />
              <span>Começar agora</span>
            </button>

            <button
              type="button"
              onClick={handlePlay}
              className={cn(
                "inline-flex items-center gap-2.5 px-6 py-3 rounded-md",
                "bg-white/15 hover:bg-white/25 text-white font-semibold text-base",
                "backdrop-blur-md border border-white/10",
                "transition-all duration-200",
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
