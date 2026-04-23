import { Link } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** "compact" para mobile (apenas ícone) */
  variant?: "default" | "compact";
}

/**
 * Botão central da topbar — portal de acesso ao hub ENAFLIX.
 * Visual "Netflix Original Premium":
 *  - halo orbital pulsante (vermelho → fuchsia → violeta)
 *  - shine cinematográfico no hover
 *  - badge play 3D com glow interno
 *  - mini-sparkle decorativo (IA / streaming inteligente)
 */
export function EnaflixButton({ className, variant = "default" }: Props) {
  const compact = variant === "compact";

  return (
    <Link
      to="/enaflix"
      aria-label="Abrir ENAFLIX — hub visual do ENAZIZI"
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full overflow-visible group shrink-0 isolate",
        "transition-all duration-300 ease-out hover:scale-[1.06] active:scale-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact ? "h-9 w-9 justify-center" : "h-9 px-3.5 sm:px-4",
        className,
      )}
    >
      {/* Halo orbital — anel externo desfocado pulsando */}
      <span
        aria-hidden
        className="absolute -inset-2 rounded-full bg-gradient-to-r from-red-600 via-fuchsia-600 to-violet-600 opacity-50 blur-xl group-hover:opacity-90 transition-opacity duration-500 animate-pulse-slow"
      />
      {/* Anel rotativo decorativo (apenas no hover) */}
      <span
        aria-hidden
        className="absolute -inset-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(229,9,20,0.0), rgba(229,9,20,0.6), rgba(217,70,239,0.6), rgba(139,92,246,0.6), rgba(229,9,20,0.0))",
          mask: "radial-gradient(circle, transparent 65%, black 66%)",
          WebkitMask: "radial-gradient(circle, transparent 65%, black 66%)",
          animation: "spin 6s linear infinite",
        }}
      />
      {/* Wrapper que clipa o conteúdo interno (gradiente, shine, sheen) */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full overflow-hidden"
      >
        {/* Gradient base Netflix */}
        <span className="absolute inset-0 bg-gradient-to-r from-[#e50914] via-fuchsia-600 to-violet-600" />
        {/* Inner highlight (top sheen) */}
        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
        {/* Vignette inferior para profundidade */}
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent" />
        {/* Shine cinematográfico no hover */}
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      </span>
      {/* Borda interna sutil */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25 pointer-events-none"
      />

      {/* Play badge 3D */}
      <span
        aria-hidden
        className={cn(
          "relative flex items-center justify-center rounded-full shrink-0",
          "bg-gradient-to-br from-white/30 to-white/5 backdrop-blur-md",
          "ring-1 ring-white/40 shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
          "group-hover:scale-110 transition-transform duration-300",
          "h-5 w-5",
        )}
      >
        <Play className="h-2.5 w-2.5 text-white fill-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]" />
      </span>

      {!compact && (
        <span className="relative text-[11px] sm:text-xs font-black tracking-[0.20em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
          ENAFLIX
        </span>
      )}

      {/* Sparkle decorativo (canto superior) — só no default */}
      {!compact && (
        <Sparkles
          aria-hidden
          className="absolute -top-1 -right-1 h-3 w-3 text-white/90 drop-shadow-[0_0_4px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />
      )}
    </Link>
  );
}
