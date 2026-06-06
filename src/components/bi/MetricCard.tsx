import { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * MetricCard — componente padrão de KPI do BI (aluno + professor).
 *
 * Cada cartão responde a 3 perguntas:
 *  • O que é?         -> `label` em pt-BR
 *  • Como é calculado? -> `tooltip` (mostrado ao passar o mouse no ícone ⓘ)
 *  • O que eu faço?    -> `cta` opcional (botão de ação)
 *
 * Sempre que possível exibe:
 *  • tendência (↑ ↓ →) via `delta`
 *  • comparativo textual via `compare` (ex.: "vs 7 dias")
 *  • estado vazio honesto via `emptyState` quando `value` é nulo/0 sem dado real
 */
export interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  delta?: number | null;
  compare?: string;
  tooltip: string;
  cta?: { label: string; onClick: () => void };
  emptyState?: string;
  icon?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}

function DeltaBadge({ delta }: { delta: number }) {
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const Icon = isFlat ? ArrowRight : isUp ? ArrowUp : ArrowDown;
  const color = isFlat
    ? "text-muted-foreground"
    : isUp
      ? "text-emerald-500"
      : "text-rose-500";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", color)}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}%
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  compare,
  tooltip,
  cta,
  emptyState,
  icon,
  tone = "neutral",
  className,
}: MetricCardProps) {
  const hasValue = value !== null && value !== undefined && value !== "" && value !== "—";

  const toneRing = {
    neutral: "",
    good: "ring-1 ring-emerald-500/20",
    warn: "ring-1 ring-amber-500/20",
    bad: "ring-1 ring-rose-500/20",
  }[tone];

  return (
    <Card className={cn("p-4 flex flex-col gap-2 h-full", toneRing, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon ? <span className="text-muted-foreground shrink-0">{icon}</span> : null}
          <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Como é calculado: ${label}`}
                className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-baseline gap-1.5">
        {hasValue ? (
          <>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
            {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            {emptyState ?? "Sem dados ainda"}
          </span>
        )}
      </div>

      {(typeof delta === "number" || compare) && hasValue ? (
        <div className="flex items-center gap-2">
          {typeof delta === "number" ? <DeltaBadge delta={delta} /> : null}
          {compare ? <span className="text-[11px] text-muted-foreground">{compare}</span> : null}
        </div>
      ) : null}

      {cta ? (
        <div className="mt-auto pt-2">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cta.onClick}>
            {cta.label}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
