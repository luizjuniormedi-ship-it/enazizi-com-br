import * as React from "react";
import { cn } from "@/lib/utils";
import type { CinematicModule } from "./CinematicCard";

interface CinematicHeroProps extends React.HTMLAttributes<HTMLElement> {
  module?: CinematicModule;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  media?: React.ReactNode;
}

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

/**
 * CinematicHero — header cinematográfico para qualquer página.
 * Inclui ambient glow, eyebrow, título grande, subtítulo, ações e mídia opcional.
 */
export const CinematicHero = React.forwardRef<HTMLElement, CinematicHeroProps>(
  ({ module = "dashboard", eyebrow, title, subtitle, actions, media, className, style, ...props }, ref) => {
    const heroStyle = {
      ["--module-hue" as never]: moduleHueMap[module],
      ...style,
    } as React.CSSProperties;

    return (
      <section
        ref={ref}
        className={cn(
          "hero-ambient relative overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-12 mb-6",
          "glass-premium animate-fade-in",
          className,
        )}
        style={heroStyle}
        {...props}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            {eyebrow && (
              <div className="inline-flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-module">
                {eyebrow}
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.05] text-foreground animate-text-reveal">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                {subtitle}
              </p>
            )}
            {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
          </div>
          {media && <div className="shrink-0">{media}</div>}
        </div>
      </section>
    );
  },
);
CinematicHero.displayName = "CinematicHero";
