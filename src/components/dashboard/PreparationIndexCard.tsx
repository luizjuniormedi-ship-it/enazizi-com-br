import { memo, useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePreparationIndex, type PreparationZone } from "@/hooks/usePreparationIndex";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ZONE_CONFIG: Record<PreparationZone, { label: string; emoji: string; color: string; progressClass: string }> = {
  base_fraca: {
    label: "Base fraca",
    emoji: "🔴",
    color: "text-red-500",
    progressClass: "[&>div]:bg-red-500",
  },
  em_construcao: {
    label: "Em construção",
    emoji: "🟡",
    color: "text-yellow-500",
    progressClass: "[&>div]:bg-yellow-500",
  },
  competitivo: {
    label: "Competitivo",
    emoji: "🟢",
    color: "text-green-500",
    progressClass: "[&>div]:bg-green-500",
  },
  forte: {
    label: "Forte para aprovação",
    emoji: "🏆",
    color: "text-primary",
    progressClass: "[&>div]:bg-primary",
  },
};

const BREAKDOWN_LABELS: Record<string, { label: string; weight: string }> = {
  cronograma: { label: "Cronograma", weight: "40%" },
  desempenho: { label: "Desempenho", weight: "35%" },
  revisoes: { label: "Revisões", weight: "15%" },
  pratica: { label: "Prática", weight: "10%" },
};

/** Animates a number from 0 to target */
function useAnimatedNumber(target: number, duration = 800) {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    const diff = target - start;
    if (diff === 0) { setCurrent(target); return; }

    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + diff * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}

const PreparationIndexCard = memo(() => {
  const { data, isLoading } = usePreparationIndex();
  const [expanded, setExpanded] = useState(false);

  const animatedScore = useAnimatedNumber(data?.score ?? 0);

  if (isLoading || !data) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </Card>
    );
  }

  const { score, zone, weeklyDelta, breakdown, message, nextGoal } = data;
  const config = ZONE_CONFIG[zone];

  const DeltaIcon = weeklyDelta > 0 ? TrendingUp : weeklyDelta < 0 ? TrendingDown : Minus;
  const deltaColor = weeklyDelta > 0 ? "text-green-500" : weeklyDelta < 0 ? "text-red-500" : "text-muted-foreground";
  const deltaText = weeklyDelta > 0 ? `+${weeklyDelta}` : weeklyDelta < 0 ? `${weeklyDelta}` : "0";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">Índice de Preparação</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-primary cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-bold text-xs mb-1">Learning Yield</p>
                  <p className="text-[10px] leading-relaxed">
                    Mede a eficácia real do seu estudo. 
                    Combina retenção, acurácia, volume e consistência para projetar seu sucesso.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={cn("flex items-center gap-1 text-xs font-medium", deltaColor)}>
            <DeltaIcon className="h-3.5 w-3.5" />
            <span>{deltaText} esta semana</span>
          </div>
        </div>

        {/* Score + zone */}
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold text-foreground tabular-nums leading-none">
            {animatedScore}
          </span>
          <span className="text-lg text-muted-foreground mb-0.5">/ 100</span>
          <div className={cn("ml-auto flex items-center gap-1.5 text-sm font-medium", config.color)}>
            <span>{config.emoji}</span>
            <span>{config.label}</span>
          </div>
        </div>

        {/* Progress bar */}
        <Progress
          value={animatedScore}
          className={cn("h-2.5 bg-muted transition-all duration-700", config.progressClass)}
        />

        {/* Message */}
        <p className="text-sm text-muted-foreground">{message}</p>

        {/* Next goal */}
        <p className="text-xs text-muted-foreground/80 italic">{nextGoal}</p>

        {/* Expand toggle */}
        <div className="flex justify-center pt-1">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Breakdown */}
        {expanded && (
          <div className="space-y-2.5 pt-2 border-t border-border animate-fade-in">
            {(Object.entries(breakdown) as [string, number][]).map(([key, value]) => {
              const info = BREAKDOWN_LABELS[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {info.label} <span className="text-muted-foreground/60">({info.weight})</span>
                    </span>
                    <span className="font-medium text-foreground">{value}%</span>
                  </div>
                  <Progress value={value} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

PreparationIndexCard.displayName = "PreparationIndexCard";

export default PreparationIndexCard;
