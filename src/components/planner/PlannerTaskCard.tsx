import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, BookOpen, Brain, Target, AlertTriangle,
  Play, CheckCircle2, Clock, Flame, Zap, Radar
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type TaskCategory = "critical_review" | "near_review" | "light_review" | "error_active" | "new_content" | "practice" | "simulado";

/**
 * Hint leve do Radar de Trajetória que pode "decorar" uma task do Planner.
 * Apenas visual — não altera persistência. Carrega rastreabilidade
 * (recommendationId) para auditoria.
 */
export interface RadarTaskHint {
  label: string;
  rationale: string;
  priorityDelta: -1 | 0 | 1;
  recommendationId: string;
  recommendationKey: string;
}

interface Props {
  title: string;
  specialty: string;
  subtopic?: string | null;
  category: TaskCategory;
  reason: string;
  impact: string;
  estimatedMinutes: number;
  priority: number;
  overdue?: boolean;
  fsrsState?: "critical" | "near" | "light";
  errorCount?: number;
  done?: boolean;
  /** Overlay opcional vindo de useRadarPlannerOverlay. */
  radarHint?: RadarTaskHint | null;
  onAction: () => void;
  onDone?: () => void;
}

const CATEGORY_CONFIG: Record<TaskCategory, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical_review: {
    label: "Revisão Crítica",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
  near_review: {
    label: "Revisão Próxima",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  light_review: {
    label: "Revisão Leve",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  error_active: {
    label: "Erro Ativo",
    icon: <Flame className="h-3.5 w-3.5" />,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
  new_content: {
    label: "Conteúdo Novo",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  practice: {
    label: "Prática",
    icon: <Target className="h-3.5 w-3.5" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  simulado: {
    label: "Simulado",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/20",
  },
};

export default function PlannerTaskCard({
  title, specialty, subtopic, category, reason, impact,
  estimatedMinutes, priority, overdue, fsrsState, errorCount,
  done, onAction, onDone,
}: Props) {
  const config = CATEGORY_CONFIG[category];

  return (
    <div className={`rounded-xl border ${done ? "opacity-50 border-border/40" : config.borderColor} ${done ? "" : config.bgColor} p-3 transition-all`}>
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className={`p-1.5 rounded-lg shrink-0 ${config.bgColor} ${config.color}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h3 className={`text-sm font-semibold ${done ? "line-through text-muted-foreground" : ""}`}>
              {title}
            </h3>
            {overdue && !done && (
              <Badge variant="destructive" className="text-[8px] px-1 py-0">Atrasada</Badge>
            )}
            {errorCount && errorCount >= 3 && !done && (
              <Badge variant="destructive" className="text-[8px] px-1 py-0">{errorCount}x erros</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{specialty}</span>
            {subtopic && <><span>·</span><span>{subtopic}</span></>}
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />{estimatedMinutes}min
            </span>
          </div>
        </div>
        <Badge variant="outline" className={`text-[8px] shrink-0 ${config.color}`}>
          {config.label}
        </Badge>
      </div>

      {/* Reason + Impact */}
      {!done && (
        <div className="mt-2 ml-9 space-y-1">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Por quê:</span> {reason}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Impacto:</span> {impact}
          </p>
        </div>
      )}

      {/* Actions */}
      {!done && (
        <div className="mt-2.5 ml-9 flex items-center gap-2">
          <Button size="sm" variant="default" className="h-8 text-xs" onClick={onAction}>
            <Play className="h-3 w-3 mr-1" />
            Começar
          </Button>
          {onDone && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onDone}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Marcar feita
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
