import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** "compact" para mobile (apenas ícone) */
  variant?: "default" | "compact";
}

/**
 * Botão fixo da topbar que abre o hub visual ENAFLIX.
 * Visual premium com gradiente animado e glow.
 */
export function EnaflixButton({ className, variant = "default" }: Props) {
  return (
    <Link
      to="/enaflix"
      aria-label="Abrir ENAFLIX — hub visual"
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full overflow-hidden group shrink-0",
        "transition-transform duration-200 hover:scale-[1.04] active:scale-95",
        variant === "compact" ? "h-9 w-9 justify-center" : "h-9 px-3 sm:px-4",
        className,
      )}
    >
      {/* Gradient bg */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-primary via-violet-500 to-pink-500 opacity-95 group-hover:opacity-100 transition-opacity"
      />
      {/* Glow */}
      <span
        aria-hidden
        className="absolute -inset-1 bg-gradient-to-r from-primary via-violet-500 to-pink-500 blur-md opacity-50 group-hover:opacity-80 transition-opacity"
      />
      {/* Shine animation */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />

      <Sparkles className="relative h-4 w-4 text-white drop-shadow shrink-0" />
      {variant === "default" && (
        <span className="relative text-xs font-black tracking-wider text-white drop-shadow">
          ENAFLIX
        </span>
      )}
    </Link>
  );
}
