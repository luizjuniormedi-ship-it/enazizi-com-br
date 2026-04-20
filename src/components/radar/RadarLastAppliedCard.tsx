import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useRadarTelemetry } from "@/hooks/useRadarTelemetry";
import { useCompleteTrajectoryAction } from "@/hooks/useCompleteTrajectoryAction";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

export default function RadarLastAppliedCard() {
  const { data, isLoading } = useRadarTelemetry();
  const completeMut = useCompleteTrajectoryAction();
  const last = data?.lastAction;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Última ação aplicada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}

        {!isLoading && !last && (
          <p className="text-sm text-muted-foreground">
            Nenhuma recomendação aplicada ainda. Aplique uma sugestão para fechar o loop.
          </p>
        )}

        {!isLoading && last && (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {last.recommendation?.title ?? "Recomendação aplicada"}
                </div>
                {last.recommendation?.rationale && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {last.recommendation.rationale}
                  </p>
                )}
              </div>
              {last.status === "completed" ? (
                <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Concluída
                </Badge>
              ) : last.status === "applied" ? (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Em execução
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Pendente
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Aplicada {formatRelative(last.appliedAt)}</span>
              {last.completedAt && (
                <>
                  <span>•</span>
                  <span>Concluída {formatRelative(last.completedAt)}</span>
                </>
              )}
            </div>

            {last.status === "applied" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={completeMut.isPending}
                onClick={() => completeMut.mutate({ appliedActionId: last.id })}
              >
                {completeMut.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Marcando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Marcar como concluída
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
