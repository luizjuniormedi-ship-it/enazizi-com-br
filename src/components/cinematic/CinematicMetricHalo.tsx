import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CinematicCard, type CinematicModule } from "./CinematicCard";

interface CinematicMetricHaloProps {
  icon?: LucideIcon;
  label: string;
  /** Numeric value 0-100 (or 0-max if max provided) */
  value: number;
  /** Optional max value (default 100) */
  max?: number;
  /** Custom display string for the value (overrides %) */
  displayValue?: string;
  /** Suffix shown after value (e.g. "%", "/100") */
  suffix?: string;
  subtitle?: string;
  module?: CinematicModule;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  className?: string;
  onClick?: () => void;
  /** Size of the radial ring */
  size?: "sm" | "md" | "lg";
}

/**
 * CinematicMetricHalo — KPI premium com halo radial + ring de progressão.
 *
 * Diferente do CinematicMetric base (KPI simples), este transforma o número
 * em uma métrica emocional:
 *  - Ring SVG animado (1.4s easeOutExpo) com glow contextual
 *  - Halo respirando atrás do número
 *  - Tom dinâmico (success/warning/destructive) por valor
 *  - Leitura premium (não admin)
 */
export const CinematicMetricHalo: React.FC<CinematicMetricHaloProps> = ({
  icon: Icon,
  label,
  value,
  max = 100,
  displayValue,
  suffix,
  subtitle,
  module = "dashboard",
  trend,
  className,
  onClick,
  size = "md",
}) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  const dims =
    size === "sm"
      ? { box: 88, stroke: 6, font: "text-xl" }
      : size === "lg"
      ? { box: 168, stroke: 10, font: "text-4xl" }
      : { box: 120, stroke: 8, font: "text-2xl" };

  const radius = (dims.box - dims.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (pct / 100) * circumference;

  // Tom emocional baseado no valor
  const tone =
    pct >= 75
      ? "success"
      : pct >= 50
      ? "warning"
      : pct >= 25
      ? "module"
      : "destructive";

  const toneColor =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "warning"
      ? "hsl(var(--warning))"
      : tone === "destructive"
      ? "hsl(var(--destructive))"
      : "hsl(var(--module-hue, var(--primary)))";

  return (
    <CinematicCard
      variant="glass"
      module={module}
      interactive={!!onClick}
      onClick={onClick}
      className={cn("p-5", className)}
    >
      <div className="flex items-center gap-5">
        {/* Halo + Ring SVG */}
        <div
          className="relative flex-shrink-0"
          style={{ width: dims.box, height: dims.box }}
        >
          {/* Halo respirando */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-2xl opacity-50"
            style={{
              background: `radial-gradient(circle, ${toneColor} 0%, transparent 70%)`,
              animation: "pulse 3s ease-in-out infinite",
            }}
          />

          <svg
            width={dims.box}
            height={dims.box}
            viewBox={`0 0 ${dims.box} ${dims.box}`}
            className="relative -rotate-90"
          >
            {/* Track */}
            <circle
              cx={dims.box / 2}
              cy={dims.box / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--border) / 0.4)"
              strokeWidth={dims.stroke}
            />
            {/* Progress */}
            <circle
              cx={dims.box / 2}
              cy={dims.box / 2}
              r={radius}
              fill="none"
              stroke={toneColor}
              strokeWidth={dims.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              style={{
                transition:
                  "stroke-dashoffset 1400ms cubic-bezier(0.16, 1, 0.3, 1)",
                filter: `drop-shadow(0 0 8px ${toneColor})`,
              }}
            />
          </svg>

          {/* Valor central */}
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span
              className={cn(
                "font-black tabular-nums tracking-tight leading-none",
                dims.font,
              )}
              style={{ color: toneColor }}
            >
              {displayValue ?? Math.round(value)}
              {suffix && (
                <span className="text-base font-bold opacity-70 ml-0.5">
                  {suffix}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {Icon && (
              <div className="bg-module-tint rounded-lg h-7 w-7 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-module" />
              </div>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {label}
            </p>
          </div>

          {subtitle && (
            <p className="text-sm text-foreground/80 leading-snug line-clamp-2">
              {subtitle}
            </p>
          )}

          {trend && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                trend.direction === "up" && "text-success",
                trend.direction === "down" && "text-destructive",
                trend.direction === "neutral" && "text-muted-foreground",
              )}
            >
              <span aria-hidden>
                {trend.direction === "up"
                  ? "↑"
                  : trend.direction === "down"
                  ? "↓"
                  : "→"}
              </span>
              {trend.value}
            </div>
          )}
        </div>
      </div>
    </CinematicCard>
  );
};
