import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EnaflixCinematicCard — Pixar cinematic card (Fase 5 Global Engine).
 * Reaproveita .card-pixar (+ .card-pixar-violet / .card-pixar-mint).
 *
 * Variants:
 *  - poster     → cartaz cinematográfico (default, blue)
 *  - lesson     → aulas / videoteca (violet)
 *  - dashboard  → KPIs / cockpit
 *  - analytics  → painel de dados
 *  - exam       → simulado / prova (danger glow)
 *  - tutor      → IA / chat (violet/cyan)
 *  - medical    → saúde / fisiologia (mint)
 */
export type EnaflixCardVariant =
  | "poster"
  | "lesson"
  | "dashboard"
  | "analytics"
  | "exam"
  | "tutor"
  | "medical";

export interface EnaflixCinematicCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: EnaflixCardVariant;
  interactive?: boolean;
  overlay?: ReactNode;
  glow?: boolean;
  asChild?: never;
}

const VARIANT_CLASSES: Record<EnaflixCardVariant, string> = {
  poster: "card-pixar",
  lesson: "card-pixar card-pixar-violet",
  dashboard: "card-pixar",
  analytics: "card-pixar",
  exam: "card-pixar",
  tutor: "card-pixar card-pixar-violet",
  medical: "card-pixar card-pixar-mint",
};

const VARIANT_GLOW_RING: Record<EnaflixCardVariant, string> = {
  poster: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-medical-blue)/0.45)]",
  lesson: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-violet)/0.5)]",
  dashboard: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-cyan)/0.5)]",
  analytics: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-cyan)/0.5)]",
  exam: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-danger)/0.5)]",
  tutor: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-violet)/0.55)]",
  medical: "shadow-[0_0_60px_-10px_hsl(var(--enaflix-mint)/0.5)]",
};

export const EnaflixCinematicCard = forwardRef<
  HTMLDivElement,
  EnaflixCinematicCardProps
>(
  (
    {
      variant = "poster",
      interactive = true,
      overlay,
      glow = false,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          VARIANT_CLASSES[variant],
          interactive ? "cursor-pointer" : "pointer-events-none-children",
          glow && VARIANT_GLOW_RING[variant],
          "relative",
          className,
        )}
        {...rest}
      >
        {/* Holographic edge ring */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/5"
        />
        {children}
        {overlay && (
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            {overlay}
          </div>
        )}
      </div>
    );
  },
);

EnaflixCinematicCard.displayName = "EnaflixCinematicCard";
