import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, RefreshCw, ChevronDown, Clock, Zap, Shield, AlertTriangle } from "lucide-react";
import type { StudyNextRecommendation, AdaptiveState } from "@/hooks/useStudyNext";

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  review: { label: "Revisão", icon: "🔄", color: "bg-primary/20 text-primary" },
  error_review: { label: "Correção de Erro", icon: "🔴", color: "bg-destructive/20 text-destructive" },
  daily_task: { label: "Missão do Dia", icon: "📋", color: "bg-accent/20 text-accent-foreground" },
  free_study: { label: "Estudo Livre", icon: "📚", color: "bg-muted text-muted-foreground" },
};

interface Props {
  recommendation: StudyNextRecommendation;
  adaptiveState?: AdaptiveState;
  onStart: () => void;
  onRefresh: () => void;
  onShowAlternatives: () => void;
}

export default function MissionHeroCard({ recommendation, adaptiveState, onStart, onRefresh, onShowAlternatives }: Props) {
  const cfg = TYPE_CONFIG[recommendation.type] || TYPE_CONFIG.free_study;
  const score = Math.round(recommendation.priorityScore * 100) / 100;

  return (
    <Card className="relative overflow-hidden border-primary/30 shadow-[var(--shadow-glow)]">
      {/* Gradient top accent */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gradient-primary)" }} />

      <CardContent className="p-5 sm:p-7 space-y-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className={cfg.color + " text-xs font-medium"}>
                {cfg.icon} {cfg.label}
              </Badge>
              {adaptiveState?.recoveryActive && (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Recuperação
                </Badge>
              )}
              {adaptiveState?.contentLocked && (
                <Badge variant="outline" className="text-[10px] border-muted-foreground/30">
                  <Shield className="h-3 w-3 mr-1" /> Conteúdo Bloqueado
                </Badge>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight truncate">
              {recommendation.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {recommendation.description}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-3xl font-black text-primary tabular-nums">{score}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">prioridade</span>
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {recommendation.estimatedMinutes} min
          </span>
          {adaptiveState && (
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              Approval: {adaptiveState.approvalScore}%
            </span>
          )}
          {adaptiveState?.pendingReviews != null && adaptiveState.pendingReviews > 0 && (
            <span className="flex items-center gap-1">
              🔄 {adaptiveState.pendingReviews} revisões
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="flex-1 sm:flex-none sm:min-w-[200px] h-12 text-base font-semibold gap-2 shadow-lg"
            onClick={onStart}
          >
            <Rocket className="h-5 w-5" />
            Começar agora
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={onRefresh} title="Atualizar missão">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:flex gap-1 text-muted-foreground" onClick={onShowAlternatives}>
            Ver alternativas <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
