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

interface CinematicSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  module?: CinematicModule;
  /** Variantes de forma. */
  shape?: "rect" | "circle" | "pill" | "card";
  /** Intensidade do shimmer e halo. */
  intensity?: "soft" | "normal" | "strong";
  /** Atraso de entrada para staggered loading. */
  delay?: number;
}

/**
 * CinematicSkeleton — placeholder cinematográfico premium.
 * Substitui o Skeleton genérico com:
 *  - shimmer translúcido (gradient sweep)
 *  - halo module-aware respirando
 *  - profundidade glass
 *  - stagger via prop `delay`
 *
 * Use em qualquer lugar que antes usava <Skeleton/>:
 *   <CinematicSkeleton module="tutor" className="h-24 w-full" />
 */
export const CinematicSkeleton = React.forwardRef<HTMLDivElement, CinematicSkeletonProps>(
  ({ module, shape = "rect", intensity = "normal", delay = 0, className, style, ...props }, ref) => {
    const radius =
      shape === "circle"
        ? "rounded-full"
        : shape === "pill"
        ? "rounded-full"
        : shape === "card"
        ? "rounded-2xl"
        : "rounded-xl";

    const haloOpacity = intensity === "soft" ? "opacity-30" : intensity === "strong" ? "opacity-70" : "opacity-50";

    const styles: React.CSSProperties = {
      ["--module-hue" as never]: module ? moduleHueMap[module] : "var(--primary)",
      animationDelay: delay ? `${delay}ms` : undefined,
      ...style,
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          "cinematic-skeleton relative overflow-hidden border border-border/40",
          "bg-[hsl(var(--surface-2))]",
          radius,
          className,
        )}
        style={styles}
        {...props}
      >
        {/* Halo respirando (module-aware) */}
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-0", radius, haloOpacity)}
          style={{
            background:
              "radial-gradient(ellipse at 30% 30%, hsl(var(--module-hue) / 0.18), transparent 60%)",
            animation: "cinematic-skeleton-breath 2.8s ease-in-out infinite",
          }}
        />

        {/* Shimmer sweep */}
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-0", radius)}
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, hsl(var(--foreground) / 0.06) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
            animation: "cinematic-skeleton-sweep 1.8s var(--ease-out-expo) infinite",
          }}
        />
      </div>
    );
  },
);
CinematicSkeleton.displayName = "CinematicSkeleton";
