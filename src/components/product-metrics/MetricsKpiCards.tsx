import { MetricCard } from "@/components/monitoring/MonitoringMetricCard";
import { LoopFunnelMetrics } from "@/hooks/useProductMetrics";
import { Target, XCircle, CheckCircle, Clock, Play, Zap } from "lucide-react";

interface Props {
  data: LoopFunnelMetrics;
}

export function MetricsKpiCards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard
        icon={Play}
        label="Loops iniciados"
        value={data.totalStarts}
        color="text-primary"
      />
      <MetricCard
        icon={CheckCircle}
        label="Loops concluídos"
        value={data.totalCompletes}
        color="text-emerald-500"
      />
      <MetricCard
        icon={Target}
        label="Completion Rate"
        value={`${data.completionRate}%`}
        color="text-emerald-500"
        trend={data.completionRate >= 60 ? "up" : data.completionRate >= 30 ? "neutral" : "down"}
      />
      <MetricCard
        icon={XCircle}
        label="Abandon Rate"
        value={`${data.abandonRate}%`}
        color="text-destructive"
        trend={data.abandonRate <= 30 ? "up" : data.abandonRate <= 50 ? "neutral" : "down"}
      />
      <MetricCard
        icon={Zap}
        label="Acurácia"
        value={`${data.accuracy}%`}
        color="text-amber-500"
      />
      <MetricCard
        icon={Clock}
        label="Tempo médio/dia"
        value={formatSeconds(data.avgStudySeconds)}
        subtitle="por dia ativo"
        color="text-primary"
      />
    </div>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`;
}
