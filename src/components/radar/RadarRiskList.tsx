import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { TrajectoryRisk, Severity } from "@/types/trajectory";

interface RadarRiskListProps {
  risks: TrajectoryRisk[];
}

const severityMeta: Record<
  Severity,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof ShieldAlert }
> = {
  critical: { label: "Crítico", variant: "destructive", icon: ShieldAlert },
  high: { label: "Alto", variant: "destructive", icon: AlertTriangle },
  medium: { label: "Médio", variant: "secondary", icon: AlertTriangle },
  low: { label: "Baixo", variant: "outline", icon: ShieldCheck },
};

export default function RadarRiskList({ risks }: RadarRiskListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Riscos identificados
          <Badge variant="outline" className="ml-auto text-xs">
            {risks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum risco relevante detectado na última análise. Continue mantendo a consistência.
          </p>
        )}

        {risks.map((risk) => {
          const meta = severityMeta[risk.severity] ?? severityMeta.medium;
          const Icon = meta.icon;
          return (
            <div
              key={risk.id}
              className="flex items-start gap-3 rounded-md border bg-card/50 p-3"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{risk.title}</span>
                  <Badge variant={meta.variant} className="text-xs">
                    {meta.label}
                  </Badge>
                  {typeof risk.impactScore === "number" && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      impacto {Math.round(risk.impactScore)}
                    </span>
                  )}
                </div>
                {risk.description && (
                  <p className="text-xs text-muted-foreground">{risk.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
