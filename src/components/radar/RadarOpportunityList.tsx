import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp } from "lucide-react";
import type { TrajectoryOpportunity, EffortLevel } from "@/types/trajectory";

interface RadarOpportunityListProps {
  opportunities: TrajectoryOpportunity[];
}

const effortMeta: Record<EffortLevel, { label: string; variant: "default" | "secondary" | "outline" }> = {
  low: { label: "Baixo esforço", variant: "default" },
  medium: { label: "Médio esforço", variant: "secondary" },
  high: { label: "Alto esforço", variant: "outline" },
};

export default function RadarOpportunityList({ opportunities }: RadarOpportunityListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" />
          Oportunidades
          <Badge variant="outline" className="ml-auto text-xs">
            {opportunities.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sem oportunidades destacadas no momento. Volte após a próxima análise.
          </p>
        )}

        {opportunities.map((op) => {
          const meta = effortMeta[op.effortLevel] ?? effortMeta.medium;
          return (
            <div
              key={op.id}
              className="flex items-start gap-3 rounded-md border bg-card/50 p-3"
            >
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{op.title}</span>
                  <Badge variant={meta.variant} className="text-xs">
                    {meta.label}
                  </Badge>
                  {typeof op.potentialGain === "number" && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      ganho ~{Math.round(op.potentialGain)}
                    </span>
                  )}
                </div>
                {op.description && (
                  <p className="text-xs text-muted-foreground">{op.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
