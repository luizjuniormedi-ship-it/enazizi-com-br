import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, AlertCircle } from "lucide-react";
import type { CockpitData } from "@/hooks/useCockpitData";

interface Props {
  data: CockpitData;
}

export default function CockpitMemory({ data }: Props) {
  const navigate = useNavigate();
  const overdue = data.fsrsDueCount;
  const stability = data.avgStability;
  const lapses = data.totalLapses;
  const total = data.fsrsTotalCards;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">📅 Revisão e retenção</h2>
        </div>
        {overdue > 0 && (
          <Button size="sm" onClick={() => navigate("/dashboard/revisoes")} className="gap-1">
            Revisar agora
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Vencidas"
          value={overdue}
          tone={overdue > 5 ? "destructive" : overdue > 0 ? "warning" : "muted"}
          icon={overdue > 0 ? <AlertCircle className="h-4 w-4" /> : null}
        />
        <Stat label="Total cards" value={total} tone="muted" />
        <Stat label="Estabilidade média" value={`${stability}d`} tone="primary" />
        <Stat label="Lapses" value={lapses} tone={lapses > 10 ? "warning" : "muted"} />
      </div>

      {overdue === 0 && total > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Sua memória está em dia ✨ Continue revisando para fortalecer a retenção.
        </p>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone: "destructive" | "warning" | "primary" | "muted";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5 text-warning"
        : tone === "primary"
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border bg-secondary/30 text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
