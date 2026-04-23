import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CinematicCard, type CinematicModule } from "./CinematicCard";

interface CinematicMetricProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  module?: CinematicModule;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  className?: string;
  onClick?: () => void;
}

/**
 * CinematicMetric — KPI card premium com identidade de módulo.
 * Substitui MetricCard genéricos.
 */
export const CinematicMetric: React.FC<CinematicMetricProps> = ({
  icon: Icon,
  label,
  value,
  subtitle,
  module = "dashboard",
  trend,
  className,
  onClick,
}) => {
  return (
    <CinematicCard
      variant="glass"
      module={module}
      interactive={!!onClick}
      onClick={onClick}
      className={cn("p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {label}
          </p>
          <p className="text-3xl font-black tabular-nums text-foreground leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1.5 truncate">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="bg-module-tint rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-module" />
          </div>
        )}
      </div>
      {trend && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-medium",
            trend.direction === "up" && "text-success",
            trend.direction === "down" && "text-destructive",
            trend.direction === "neutral" && "text-muted-foreground",
          )}
        >
          <span>
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
          </span>
          {trend.value}
        </div>
      )}
    </CinematicCard>
  );
};
