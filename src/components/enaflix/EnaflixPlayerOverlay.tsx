import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EnaflixPlayerOverlay — overlay cinematográfico para players de aula (Fase 5).
 * Inclui:
 *  - vinheta superior/inferior (legibilidade Netflix)
 *  - barra de progresso holográfica
 *  - slot para controles (play/pause/skip)
 *  - slot para metadados (título, capítulo)
 *
 * NÃO controla reprodução. Apenas camada visual.
 */
interface Props {
  title?: string;
  chapter?: string;
  /** 0 a 100 */
  progress?: number;
  controls?: ReactNode;
  topRight?: ReactNode;
  children?: ReactNode;
  className?: string;
}

function PlayerOverlayBase({
  title,
  chapter,
  progress = 0,
  controls,
  topRight,
  children,
  className,
}: Props) {
  return (
    <div className={cn("relative w-full h-full overflow-hidden rounded-[var(--radius-overlay)]", className)}>
      {children}

      {/* Top vignette */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      {/* Bottom vignette */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          {chapter && <div className="enaflix-hud-label">{chapter}</div>}
          {title && (
            <h2 className="text-base sm:text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] truncate">
              {title}
            </h2>
          )}
        </div>
        {topRight}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 px-5 pb-5 space-y-3">
        {/* Holographic progress */}
        <div className="relative h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background:
                "linear-gradient(90deg, hsl(var(--enaflix-cyan)), hsl(var(--enaflix-violet)))",
              boxShadow: "0 0 16px hsl(var(--enaflix-violet) / 0.7)",
              transition: "width 320ms var(--ease-cinematic)",
            }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_10px_hsl(var(--enaflix-cyan))]"
            style={{ left: `calc(${Math.max(0, Math.min(100, progress))}% - 6px)` }}
          />
        </div>

        {controls && <div className="flex items-center gap-2">{controls}</div>}
      </div>
    </div>
  );
}

export const EnaflixPlayerOverlay = memo(PlayerOverlayBase);
