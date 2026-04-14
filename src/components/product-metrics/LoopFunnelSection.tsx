import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoopFunnelMetrics } from "@/hooks/useProductMetrics";

interface Props {
  data: LoopFunnelMetrics;
}

export function LoopFunnelSection({ data }: Props) {
  const steps = [
    { label: "Iniciados", value: data.totalStarts, color: "bg-primary" },
    { label: "Respondidos", value: data.totalAnswers, color: "bg-amber-500" },
    { label: "Concluídos", value: data.totalCompletes, color: "bg-emerald-500" },
    { label: "Abandonados", value: data.totalAbandons, color: "bg-destructive" },
  ];

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Funil do Loop</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => {
          const pct = Math.round((step.value / max) * 100);
          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{step.label}</span>
                <span className="font-semibold tabular-nums">{step.value.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${step.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <MiniStat label="Quick Actions" value={data.quickActionsUsed} />
          <MiniStat label="Reforços" value={data.reinforcements} />
          <MiniStat label="Saídas elegantes" value={data.elegantExits} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
