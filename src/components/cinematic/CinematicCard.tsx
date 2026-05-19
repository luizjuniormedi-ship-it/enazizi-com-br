import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { usePointerLight } from "@/hooks/usePointerLight";
import { useTilt } from "@/hooks/useTilt";

/**
 * CinematicCard — base premium para todo o sistema.
 * Use no lugar de <Card> quando quiser identidade cinematográfica.
 *
 * Props:
 * - variant: glass | solid | tinted | hero
 * - module: dashboard | enaflix | tutor | flashcard | simulado | analytics | planner | professor | admin | ranking
 * - interactive: ativa lift + cursor-pointer
 * - glow: adiciona halo do módulo
 * - pointerLight: ativa luz contextual seguindo o cursor (AAA)
 * - tilt: ativa leve tilt 3D Pixar/Apple
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
  | "ranking"
  | "governance";

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
  governance: "var(--hue-governance, 262)",
};

export interface CinematicCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  module?: CinematicModule;
  /** Ativa luz contextual que segue o cursor (AAA polish) */
  pointerLight?: boolean;
  /** Ativa leve tilt 3D Pixar/Apple */
  tilt?: boolean;
}

export const CinematicCard = React.forwardRef<HTMLDivElement, CinematicCardProps>(
  (
    { className, variant, interactive, glow, module, pointerLight, tilt, style, children, ...props },
    ref,
  ) => {
    const lightRef = usePointerLight<HTMLDivElement>();
    const tiltRef = useTilt<HTMLDivElement>({ max: 4, scale: 1.005 });

    const moduleStyle = module
      ? ({ ["--module-hue" as never]: moduleHueMap[module], ...style } as React.CSSProperties)
      : style;

    // Combina refs (forwardedRef + interactionRef)
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (pointerLight) (lightRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (tilt) (tiltRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref, pointerLight, tilt, lightRef, tiltRef],
    );

    return (
      <div
        ref={setRefs}
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
        {pointerLight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500"
            style={{
              opacity: "calc(var(--pointer-active, 0) * 0.9)",
              background:
                "radial-gradient(circle at calc(var(--mx,0.5)*100%) calc(var(--my,0.5)*100%), hsl(var(--module-hue, var(--primary)) / 0.18), transparent 55%)",
            }}
          />
        )}
        <div className="relative">{children}</div>
      </div>
    );
  },
);
CinematicCard.displayName = "CinematicCard";
