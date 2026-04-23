import * as React from "react";
import { cn } from "@/lib/utils";
import type { CinematicModule } from "./CinematicCard";

const moduleHueMap: Record<CinematicModule, string> = {
  dashboard: "var(--hue-dashboard)",
  enaflix: "var(--hue-enaflix)",
  tutor: "var(--hue-tutor)",
  flashcard: "var(--hue-flashcard)",
  simulado: "var(--hue-simulado)",
  analytics: "var(--hue-analytics)",
  planner: "var(--hue-planner)",
  professor: "var(--hue-professor)",
  admin: "var(--hue-admin)",
  ranking: "var(--hue-ranking)",
};

interface Props {
  /** Módulo (define hue). Default dashboard */
  module?: CinematicModule;
  /** Tamanho em px. Default 96 */
  size?: number;
  /** Variante visual */
  variant?: "neural" | "crystal" | "orbit";
  /** Animar (pulsação + rotação). Default true */
  animated?: boolean;
  /** Intensidade do glow externo. Default md */
  glow?: "none" | "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

/**
 * EnaziziSymbol — símbolo abstrato animado oficial do ENAZIZI.
 * Substitui mascote tradicional por uma forma neural/cristalina viva,
 * estilo Apple Intelligence + Pixar light.
 *
 * Usa SVG puro (sem dependência) + CSS animations já definidas em index.css
 * (`enazizi-orbit-slow`, `enazizi-orbit-fast`, `enazizi-core-pulse`).
 *
 * Cada módulo recebe a mesma forma com hue diferente — coerência visual total.
 */
export const EnaziziSymbol: React.FC<Props> = ({
  module = "dashboard",
  size = 96,
  variant = "neural",
  animated = true,
  glow = "md",
  className,
  "aria-label": ariaLabel = "ENAZIZI",
}) => {
  const hue = moduleHueMap[module];
  const style = {
    ["--module-hue" as never]: hue,
    width: size,
    height: size,
  } as React.CSSProperties;

  const glowFilter =
    glow === "none"
      ? undefined
      : glow === "sm"
        ? `drop-shadow(0 0 ${size * 0.08}px hsl(${hue} / 0.45))`
        : glow === "lg"
          ? `drop-shadow(0 0 ${size * 0.25}px hsl(${hue} / 0.55))`
          : `drop-shadow(0 0 ${size * 0.15}px hsl(${hue} / 0.5))`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={style}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        style={{ filter: glowFilter }}
      >
        <defs>
          <radialGradient id={`enazizi-core-${module}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`hsl(${hue} / 1)`} />
            <stop offset="55%" stopColor={`hsl(${hue} / 0.55)`} />
            <stop offset="100%" stopColor={`hsl(${hue} / 0)`} />
          </radialGradient>
          <linearGradient id={`enazizi-ring-${module}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} / 0.9)`} />
            <stop offset="50%" stopColor={`hsl(${hue} / 0.25)`} />
            <stop offset="100%" stopColor={`hsl(${hue} / 0.9)`} />
          </linearGradient>
        </defs>

        {/* Núcleo pulsante */}
        <g className={animated ? "enazizi-core" : undefined} style={{ transformOrigin: "50px 50px" }}>
          <circle cx="50" cy="50" r="22" fill={`url(#enazizi-core-${module})`} opacity="0.95" />
          <circle cx="50" cy="50" r="12" fill={`hsl(${hue} / 0.95)`} />
          <circle cx="46" cy="46" r="3.5" fill="white" opacity="0.9" />
        </g>

        {/* Anéis orbitais */}
        {variant !== "crystal" && (
          <g
            className={animated ? "enazizi-orbit-slow" : undefined}
            style={{ transformOrigin: "50px 50px" }}
          >
            <ellipse
              cx="50"
              cy="50"
              rx="38"
              ry="14"
              fill="none"
              stroke={`url(#enazizi-ring-${module})`}
              strokeWidth="1.2"
              opacity="0.85"
            />
          </g>
        )}
        {variant !== "crystal" && (
          <g
            className={animated ? "enazizi-orbit-fast" : undefined}
            style={{ transformOrigin: "50px 50px", transform: "rotate(60deg)" }}
          >
            <ellipse
              cx="50"
              cy="50"
              rx="38"
              ry="14"
              fill="none"
              stroke={`url(#enazizi-ring-${module})`}
              strokeWidth="1"
              opacity="0.7"
            />
          </g>
        )}

        {/* Cristais (variant crystal/neural) */}
        {variant !== "orbit" && (
          <g
            className={animated ? "enazizi-orbit-slow" : undefined}
            style={{ transformOrigin: "50px 50px", transform: "rotate(20deg)" }}
          >
            <polygon
              points="50,8 54,22 50,28 46,22"
              fill={`hsl(${hue} / 0.85)`}
              opacity="0.85"
            />
            <polygon
              points="50,92 54,78 50,72 46,78"
              fill={`hsl(${hue} / 0.7)`}
              opacity="0.85"
            />
            <polygon
              points="92,50 78,54 72,50 78,46"
              fill={`hsl(${hue} / 0.7)`}
              opacity="0.7"
            />
            <polygon
              points="8,50 22,46 28,50 22,54"
              fill={`hsl(${hue} / 0.7)`}
              opacity="0.7"
            />
          </g>
        )}

        {/* Sinapses */}
        <g
          className={animated ? "enazizi-orbit-fast" : undefined}
          style={{ transformOrigin: "50px 50px" }}
        >
          <circle cx="86" cy="50" r="2.2" fill={`hsl(${hue} / 1)`} />
          <circle cx="14" cy="50" r="1.8" fill={`hsl(${hue} / 0.85)`} />
          <circle cx="50" cy="86" r="1.6" fill={`hsl(${hue} / 0.7)`} />
        </g>
      </svg>
    </div>
  );
};

EnaziziSymbol.displayName = "EnaziziSymbol";
