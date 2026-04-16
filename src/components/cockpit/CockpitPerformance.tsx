import { Card } from "@/components/ui/card";
import { TrendingUp, Flame } from "lucide-react";
import type { CockpitData } from "@/hooks/useCockpitData";

interface Props {
  data: CockpitData;
  streak: number;
}

export default function CockpitPerformance({ data, streak }: Props) {
  const accuracy = data.accuracy7d;
  const tone = accuracy >= 75 ? "success" : accuracy >= 60 ? "warning" : "destructive";
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-success" />
        <h2 className="text-lg font-semibold">📈 Sua evolução recente (7 dias)</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Acurácia" value={`${accuracy}%`} tone={tone} />
        <Metric label="Questões" value={data.questions7d} tone="primary" />
        <Metric label="Acertos" value={data.correct7d} tone="success" />
        <Metric label="Streak" value={`${streak}d`} tone="warning" icon={<Flame className="h-4 w-4" />} />
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {data.questions7d === 0
          ? "Sem atividade nos últimos 7 dias. Comece pelo botão acima."
          : `Você respondeu ${data.questions7d} questão${data.questions7d > 1 ? "s" : ""} esta semana.`}
      </p>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone: "success" | "warning" | "destructive" | "primary";
  icon?: React.ReactNode;
}) {
  const cls = {
    success: "text-success border-success/30 bg-success/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    destructive: "text-destructive border-destructive/30 bg-destructive/5",
    primary: "text-primary border-primary/30 bg-primary/5",
  }[tone];
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
