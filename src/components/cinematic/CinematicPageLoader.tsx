import * as React from "react";
import { cn } from "@/lib/utils";
import { CinematicSkeleton } from "./CinematicSkeleton";
import { AmbientAtmosphere } from "./AmbientAtmosphere";
import type { CinematicModule } from "./CinematicCard";

interface CinematicPageLoaderProps {
  /** Módulo para tonalidade do halo. */
  module?: CinematicModule;
  /** Mensagem opcional sob o pulso central. */
  hint?: string;
  /** Variante de layout. */
  variant?: "default" | "minimal" | "session";
  className?: string;
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
 * CinematicPageLoader — substitui o PageSkeleton genérico.
 *
 * Layout cinematográfico:
 *  - hero placeholder com halo módulo-aware
 *  - 4 cards KPI staggered
 *  - 1 bloco principal
 *  - 2 blocos secundários
 *  - hint opcional em texto suave
 *
 * Use no Suspense fallback global:
 *   <Suspense fallback={<CinematicPageLoader module="tutor" />}>
 */
export const CinematicPageLoader: React.FC<CinematicPageLoaderProps> = ({
  module = "dashboard",
  hint,
  variant = "default",
  className,
}) => {
  const style: React.CSSProperties = {
    ["--module-hue" as never]: moduleHueMap[module],
  };

  if (variant === "minimal") {
    return (
      <div
        className={cn("flex min-h-[40vh] flex-col items-center justify-center gap-4 animate-fade-in", className)}
        style={style}
      >
        <CinematicPulse module={module} />
        {hint && <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  if (variant === "session") {
    return (
      <div
        className={cn("p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in", className)}
        style={style}
      >
        <CinematicSkeleton module={module} shape="card" className="h-40" />
        <CinematicSkeleton module={module} shape="card" className="h-[420px]" intensity="strong" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CinematicSkeleton module={module} shape="card" className="h-20" delay={0} />
          <CinematicSkeleton module={module} shape="card" className="h-20" delay={120} />
          <CinematicSkeleton module={module} shape="card" className="h-20" delay={240} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in", className)}
      style={style}
    >
      {/* Hero ambient placeholder */}
      <div className="relative overflow-hidden rounded-3xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 25% 20%, hsl(var(--module-hue) / 0.18), transparent 60%), radial-gradient(ellipse at 80% 90%, hsl(var(--accent) / 0.10), transparent 60%)",
            filter: "blur(40px)",
          }}
        />
        <CinematicSkeleton module={module} shape="card" className="h-36 sm:h-44" intensity="strong" />
      </div>

      {/* KPI row staggered */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <CinematicSkeleton
            key={i}
            module={module}
            shape="card"
            className="h-28"
            delay={i * 100}
          />
        ))}
      </div>

      {/* Primary block */}
      <CinematicSkeleton module={module} shape="card" className="h-64" intensity="strong" delay={400} />

      {/* Secondary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CinematicSkeleton module={module} shape="card" className="h-44" delay={500} />
        <CinematicSkeleton module={module} shape="card" className="h-44" delay={600} />
      </div>

      {hint && (
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
          {hint}
        </p>
      )}
    </div>
  );
};

/** Pulso central — usado no minimal e exportável avulso. */
export const CinematicPulse: React.FC<{ module?: CinematicModule; size?: number }> = ({
  module = "dashboard",
  size = 96,
}) => {
  const style: React.CSSProperties = {
    ["--module-hue" as never]: moduleHueMap[module],
    width: size,
    height: size,
  };
  return (
    <div className="relative" style={style}>
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-2xl opacity-70"
        style={{
          background: "radial-gradient(circle, hsl(var(--module-hue)) 0%, transparent 70%)",
          animation: "cinematic-skeleton-breath 2.4s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-[18%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--module-hue) / 0.9) 0%, hsl(var(--module-hue) / 0.2) 60%, transparent 100%)",
          boxShadow: "0 0 40px hsl(var(--module-hue) / 0.5)",
          animation: "cinematic-pulse-core 2s ease-in-out infinite",
        }}
      />
    </div>
  );
};
