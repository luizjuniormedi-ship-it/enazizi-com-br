import { useNavigate } from "react-router-dom";
import { Play, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { getHeroArt, ENAFLIX_MASCOT } from "@/data/enaflix/enaflixArt";
import { EnaflixBadge } from "./EnaflixBadge";
import { EnaflixContextStrip } from "./EnaflixContextStrip";

interface Props {
  module: EnaflixModule;
  /** Tagline pequena sobre o título (ex.: "Recomendado pela IA") */
  eyebrow?: string;
  onNavigate?: (m: EnaflixModule) => void;
}

/**
 * EnaflixBillboard — hero full-bleed cinematográfico (calibrado).
 *
 * Calibração moderada:
 *  - Removido parallax mouse + scroll (causava motion sickness e overhead RAF)
 *  - Removido animate-breathe (glow respirando)
 *  - Removido shine-sweep no hover do CTA (excesso visual)
 *  - Mantido: zoom-in suave da arte, text-reveal stagger, float discreto
 *  - Adicionado: faixa contextual com revisões/streak/dias até banca
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
      {/* Backdrop art (full-bleed) */}
      <div aria-hidden className="absolute inset-0">
        {/* Camada base ambiente */}
        <div className="absolute inset-0 bg-[#0a0a12]" />

        {/* Glow ambiente atrás da arte — estático (sem breathe) */}
        <div className="absolute right-[5%] top-1/4 h-[60%] w-[45%] bg-gradient-radial from-primary/25 via-violet-500/8 to-transparent blur-3xl pointer-events-none" />

        {/* Arte hero dominante — entrada zoom-in apenas */}
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-[70%] sm:w-[60%] lg:w-[55%]",
            "opacity-90 animate-hero-zoom-in",
          )}
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

        {/* Fade inferior para emergir o conteúdo seguinte */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-[#0a0a12]/80 to-[#0a0a12]" />

        {/* Vinheta superior sutil (deixa a topbar overlay legível) */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      {/* Conteúdo */}
      <div className="relative h-full flex items-end pb-20 sm:pb-28 px-4 sm:px-8 lg:px-14">
        <div className="max-w-2xl space-y-5">
          {/* Faixa contextual: revisões vencidas / streak / dias até banca */}
          <EnaflixContextStrip />

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
                "inline-flex items-center gap-2.5 px-7 py-3 rounded-md",
                "bg-white text-black font-bold text-base",
                "hover:bg-white/95 transition-colors duration-200",
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
                "backdrop-blur-md border border-white/10 hover:border-white/20",
                "transition-colors duration-200",
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
