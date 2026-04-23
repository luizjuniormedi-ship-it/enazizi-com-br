import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useMagneticHover } from "@/hooks/useMagneticHover";
import { usePointerLight } from "@/hooks/usePointerLight";
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

interface MagneticButtonProps extends ButtonProps {
  module?: CinematicModule;
  /** Força do magnetismo. Default 0.2 */
  magneticStrength?: number;
  /** Glow seguindo o cursor */
  pointerLight?: boolean;
}

/**
 * MagneticButton — CTA cinematográfico AAA.
 * - Magnetic hover (cursor puxa o botão sutilmente)
 * - Pointer light (luz contextual segue o cursor)
 * - Halo tonal do módulo
 * - Press depth real (active:scale + sombra reduzida)
 *
 * Mantém 100% da API do Button base. Drop-in replacement.
 */
export const MagneticButton = React.forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ module, magneticStrength = 0.2, pointerLight = true, className, style, children, ...rest }, _forwardedRef) => {
    const magneticRef = useMagneticHover<HTMLDivElement>({ strength: magneticStrength, radius: 110 });
    const lightRef = usePointerLight<HTMLDivElement>();

    const wrapperStyle: React.CSSProperties = {
      ...(module ? ({ ["--module-hue" as never]: moduleHueMap[module] } as React.CSSProperties) : {}),
      ...style,
    };

    return (
      <div ref={magneticRef} className="inline-block will-change-transform" style={wrapperStyle}>
        <div ref={lightRef} className="relative inline-block group">
          {pointerLight && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle at calc(var(--mx,0.5)*100%) calc(var(--my,0.5)*100%), hsl(var(--module-hue, var(--primary)) / 0.35), transparent 55%)",
                filter: "blur(8px)",
              }}
            />
          )}
          <Button
            {...rest}
            className={cn(
              "relative magnetic-btn",
              "shadow-[0_8px_24px_-8px_hsl(var(--module-hue,var(--primary))/0.5)]",
              "hover:shadow-[0_14px_32px_-8px_hsl(var(--module-hue,var(--primary))/0.65)]",
              className,
            )}
          >
            {children}
          </Button>
        </div>
      </div>
    );
  },
);
MagneticButton.displayName = "MagneticButton";
