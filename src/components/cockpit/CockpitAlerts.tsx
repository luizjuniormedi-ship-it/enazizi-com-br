import { Card } from "@/components/ui/card";
import { Bell, AlertTriangle, Info } from "lucide-react";
import type { CockpitAlert } from "@/hooks/useCockpitData";

interface Props {
  alerts: CockpitAlert[];
}

export default function CockpitAlerts({ alerts }: Props) {
  if (!alerts?.length) return null;
  const top = alerts.slice(0, 3);
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-5 w-5 text-warning" />
        <h2 className="text-lg font-semibold">⚠️ Alertas cognitivos</h2>
      </div>
      <div className="space-y-2">
        {top.map((a, i) => {
          const cls =
            a.severity === "high"
              ? "border-destructive/30 bg-destructive/5"
              : a.severity === "medium"
                ? "border-warning/30 bg-warning/5"
                : "border-primary/30 bg-primary/5";
          const Icon = a.severity === "high" ? AlertTriangle : Info;
          const iconCls =
            a.severity === "high" ? "text-destructive" : a.severity === "medium" ? "text-warning" : "text-primary";
          return (
            <div key={i} className={`flex items-start gap-2 rounded-md border p-3 ${cls}`}>
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconCls}`} />
              <p className="text-sm">{a.message}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
