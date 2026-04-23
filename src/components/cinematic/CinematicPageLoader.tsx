import * as React from "react";
import { cn } from "@/lib/utils";
import { CinematicSkeleton } from "./CinematicSkeleton";
import { ModuleScene } from "./ModuleScene";
import type { CinematicModule } from "./CinematicCard";

interface CinematicPageLoaderProps {
  /** Módulo para tonalidade do halo. */
  module?: CinematicModule;
  /** Mensagem opcional sob o pulso central. */
  hint?: string | string[];
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
 * CinematicPageLoader — fallback de página cinematográfico.
 *
 * IMPORTANTE: este componente é **transparente** — não renderiza atmosfera
 * própria. O `AmbientPersistenceLayer` (montado em App.tsx) já cobre o
 * background com o hue do módulo ativo. Renderizar atmosfera aqui causaria
 * duplicação visual e quebra de continuidade emocional entre rotas.
 *
 * Layout:
 *  - cena central identitária (ModuleScene) — a "alma" do módulo
 *  - esqueleto suplementar abaixo (sugestão de layout)
 *  - hint contextual rotativo
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
        className={cn(
          "relative flex min-h-[40vh] flex-col items-center justify-center gap-4 animate-fade-in",
          className,
        )}
        style={style}
      >
        <ModuleScene module={module} size={96} hint={hint} />
      </div>
    );
  }

  if (variant === "session") {
    return (
      <div
        className={cn(
          "relative p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in",
          className,
        )}
        style={style}
      >
        <div className="flex min-h-[280px] items-center justify-center">
          <ModuleScene module={module} size={140} hint={hint} />
        </div>
        <CinematicSkeleton module={module} shape="card" className="h-40" />
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
      className={cn(
        "relative p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in",
        className,
      )}
      style={style}
    >
      {/* Cena central — alma do módulo */}
      <div className="flex min-h-[260px] items-center justify-center">
        <ModuleScene module={module} size={128} hint={hint} />
      </div>

      {/* KPI row staggered */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <CinematicSkeleton
            key={i}
            module={module}
            shape="card"
            className="h-24"
            delay={i * 100}
          />
        ))}
      </div>

      {/* Primary block */}
      <CinematicSkeleton
        module={module}
        shape="card"
        className="h-48"
        intensity="strong"
        delay={400}
      />

      {/* Secondary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CinematicSkeleton module={module} shape="card" className="h-40" delay={500} />
        <CinematicSkeleton module={module} shape="card" className="h-40" delay={600} />
      </div>
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
