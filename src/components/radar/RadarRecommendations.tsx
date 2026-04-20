import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EFFORT_LABEL } from "@/services/trajectory/trajectoryMappers";
import type { TrajectoryRecommendation, TrajectoryAppliedAction } from "@/types/trajectory";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";

interface Props {
  recommendations: TrajectoryRecommendation[];
  appliedActions: TrajectoryAppliedAction[];
  onApply: (rec: TrajectoryRecommendation) => void;
  applyingId: string | null;
}

export default function RadarRecommendations({
  recommendations,
  appliedActions,
  onApply,
  applyingId,
}: Props) {
  const appliedByRec = new Map<string, TrajectoryAppliedAction>();
  for (const a of appliedActions) {
    if (a.recommendationId && !appliedByRec.has(a.recommendationId)) {
      appliedByRec.set(a.recommendationId, a);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recomendações acionáveis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma recomendação ativa. Atualize a análise para gerar novas sugestões.
          </div>
        )}

        {recommendations.map((rec) => {
          const applied = appliedByRec.get(rec.id);
          const isLoading = applyingId === rec.id;
          const isApplied = applied?.status === "applied";
          const isPending = applied?.status === "pending_orchestrator";

          return (
            <div key={rec.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{rec.title}</span>
                    {rec.badges.map((b) => (
                      <Badge key={b} variant="outline" className="text-[10px]">
                        {b}
                      </Badge>
                    ))}
                  </div>
                  {rec.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{EFFORT_LABEL[rec.effortLevel]}</span>
                    <span>•</span>
                    <span>Impacto esperado: {Math.round(rec.expectedImpact)}</span>
                    <span>•</span>
                    <span>Prioridade {rec.priority}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {isApplied ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Aplicada
                    </Badge>
                  ) : isPending ? (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Aguardando Planner
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onApply(rec)}
                      disabled={isLoading}
                    >
                      {isLoading ? "Enviando…" : "Aplicar"}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
