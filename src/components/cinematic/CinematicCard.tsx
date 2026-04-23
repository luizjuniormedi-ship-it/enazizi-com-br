import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * CinematicCard — base premium para todo o sistema.
 * Use no lugar de <Card> quando quiser identidade cinematográfica.
 *
 * Props:
 * - variant: glass | solid | tinted | hero
 * - module: dashboard | enaflix | tutor | flashcard | simulado | analytics | planner | professor | admin | ranking
 * - interactive: ativa lift + cursor-pointer
 * - glow: adiciona halo do módulo
 */

const cardVariants = cva(
  "relative rounded-2xl transition-all duration-500 [transition-timing-function:var(--ease-out-expo)]",
  {
    variants: {
      variant: {
        glass: "glass-premium",
        solid: "surface-2 border border-border/60 shadow-elevated",
        tinted: "gradient-module border border-module backdrop-blur-md",
        hero: "glass-premium-strong shadow-floating overflow-hidden",
      },
      interactive: {
        true: "lift cursor-pointer",
        false: "",
      },
      glow: {
        true: "glow-module",
        false: "",
      },
    },
    defaultVariants: {
      variant: "glass",
      interactive: false,
      glow: false,
    },
  },
);

export type CinematicModule =
  | "dashboard"
  | "enaflix"
  | "tutor"
  | "flashcard"
  | "simulado"
  | "analytics"
  | "planner"
  | "professor"
  | "admin"
  | "ranking";

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

export interface CinematicCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  module?: CinematicModule;
}

export const CinematicCard = React.forwardRef<HTMLDivElement, CinematicCardProps>(
  ({ className, variant, interactive, glow, module, style, children, ...props }, ref) => {
    const moduleStyle = module
      ? ({ ["--module-hue" as never]: moduleHueMap[module], ...style } as React.CSSProperties)
      : style;

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, interactive, glow }), className)}
        style={moduleStyle}
        {...props}
      >
        {variant === "hero" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse at top right, hsl(var(--module-hue, var(--primary)) / 0.22), transparent 55%)",
            }}
          />
        )}
        <div className="relative">{children}</div>
      </div>
    );
  },
);
CinematicCard.displayName = "CinematicCard";
