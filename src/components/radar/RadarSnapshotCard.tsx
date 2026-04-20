import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatScore, confidenceLabel } from "@/services/trajectory/trajectoryMappers";
import type { TrajectorySnapshot } from "@/types/trajectory";
import { Activity, BookOpen, Brain, AlertTriangle } from "lucide-react";

interface Props {
  snapshot: TrajectorySnapshot;
}

const COMPLETENESS_LABEL: Record<string, string> = {
  complete: "Dados completos",
  partial: "Dados parciais",
  insufficient: "Dados insuficientes",
};

export default function RadarSnapshotCard({ snapshot }: Props) {
  const conf = confidenceLabel(snapshot.confidenceScore);

  const items = [
    { label: "Consistência", value: snapshot.consistencyScore, icon: Activity },
    { label: "Retenção", value: snapshot.retentionScore, icon: Brain },
    { label: "Execução", value: snapshot.executionScore, icon: BookOpen },
    { label: "Backlog", value: snapshot.backlogScore, icon: AlertTriangle },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Visão atual</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {COMPLETENESS_LABEL[snapshot.dataCompleteness] ?? snapshot.dataCompleteness}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Confiança {conf}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Score geral
              </div>
              <div className="mt-1 text-3xl font-bold">
                {formatScore(snapshot.overallScore)}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{snapshot.questionsLast28d} questões / 28d</div>
              <div>{snapshot.activeDaysLast14d} dias ativos / 14d</div>
            </div>
          </div>
          <Progress value={snapshot.overallScore} className="mt-3 h-2" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.label} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {it.label}
                </div>
                <div className="mt-1 text-xl font-semibold">{formatScore(it.value)}</div>
                <Progress value={it.value} className="mt-2 h-1.5" />
              </div>
            );
          })}
        </div>

        {snapshot.dataCompleteness === "insufficient" && (
          <p className="text-xs text-muted-foreground">
            Ainda não temos dados suficientes para gerar uma projeção confiável. Continue
            estudando alguns dias e atualize a análise.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
