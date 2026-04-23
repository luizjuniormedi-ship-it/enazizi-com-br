import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** "compact" para mobile (apenas ícone) */
  variant?: "default" | "compact";
}

/**
 * Botão central da topbar — acesso ao hub visual ENAFLIX.
 * Visual "Netflix Original": gradiente vermelho/violeta, glow pulsante,
 * shine cinematográfico no hover e badge de play estilizado.
 */
export function EnaflixButton({ className, variant = "default" }: Props) {
  const compact = variant === "compact";

  return (
    <Link
      to="/enaflix"
      aria-label="Abrir ENAFLIX — hub visual do ENAZIZI"
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full overflow-hidden group shrink-0 isolate",
        "transition-all duration-300 hover:scale-[1.05] active:scale-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact ? "h-9 w-9 justify-center" : "h-9 px-3.5 sm:px-4",
        className,
      )}
    >
      {/* Glow pulsante externo */}
      <span
        aria-hidden
        className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-red-600 via-fuchsia-600 to-violet-600 opacity-50 blur-lg group-hover:opacity-90 transition-opacity duration-500 animate-pulse-slow"
      />
      {/* Gradient base */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#e50914] via-fuchsia-600 to-violet-600 opacity-100"
      />
      {/* Inner highlight (top sheen) */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent opacity-80"
      />
      {/* Shine animado no hover */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      {/* Borda interna sutil */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20"
      />

      {/* Play icon */}
      <span
        aria-hidden
        className={cn(
          "relative flex items-center justify-center rounded-full bg-white/15 backdrop-blur-sm shrink-0",
          compact ? "h-5 w-5" : "h-5 w-5",
        )}
      >
        <Play className="h-2.5 w-2.5 text-white fill-white drop-shadow" />
      </span>

      {!compact && (
        <span className="relative text-[11px] sm:text-xs font-black tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
          ENAFLIX
        </span>
      )}
    </Link>
  );
}
