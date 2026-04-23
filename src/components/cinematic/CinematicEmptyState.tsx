import * as React from "react";
import { cn } from "@/lib/utils";
import { EnaziziSymbol } from "./EnaziziSymbol";
import type { CinematicModule } from "./CinematicCard";

interface Props {
  module?: CinematicModule;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  symbolVariant?: "neural" | "crystal" | "orbit";
  className?: string;
}

/**
 * CinematicEmptyState — empty state cinematográfico universal.
 * Substitui ícones genéricos por o símbolo ENAZIZI tonalizado pelo módulo,
 * com glow ambiente e atmosfera contínua.
 */
export const CinematicEmptyState: React.FC<Props> = ({
  module = "dashboard",
  title,
  description,
  action,
  symbolVariant = "neural",
  className,
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl glass-premium",
        "flex flex-col items-center justify-center text-center px-6 py-12 sm:py-16",
        "animate-fade-in",
        className,
      )}
      style={{ ["--module-hue" as never]: `var(--hue-${module})` } as React.CSSProperties}
    >
      {/* Halo ambiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--module-hue) / 0.18), transparent 65%)",
        }}
      />
      <EnaziziSymbol module={module} size={120} variant={symbolVariant} glow="md" className="mb-6 relative" />
      <h3 className="relative text-xl sm:text-2xl font-bold text-foreground tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="relative mt-2 max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
};

CinematicEmptyState.displayName = "CinematicEmptyState";
