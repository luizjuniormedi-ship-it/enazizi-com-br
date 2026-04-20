import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle2, XCircle, Send } from "lucide-react";
import { useRadarTelemetry } from "@/hooks/useRadarTelemetry";

const REJECT_REASON_LABEL: Record<string, string> = {
  duplicate_task_today: "Tarefa duplicada hoje",
  cooldown_active: "Cooldown ativo",
  daily_load_exceeded: "Carga diária no limite",
  content_lock_active: "Plano travado",
  plan_create_failed: "Falha ao criar plano",
  task_insert_failed: "Falha ao inserir tarefa",
};

export default function RadarTelemetryCard() {
  const { data, isLoading } = useRadarTelemetry();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Telemetria do Radar
          <Badge variant="outline" className="ml-auto text-[10px]">
            últimos {data?.windowDays ?? 30}d
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}

        {!isLoading && data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric
                icon={<Send className="h-3.5 w-3.5" />}
                label="Propostas"
                value={data.counts.trajectory_apply}
              />
              <Metric
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                label="Aceitas"
                value={data.counts.planner_apply}
              />
              <Metric
                icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
                label="Rejeitadas"
                value={data.counts.planner_reject}
              />
              <Metric
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                label="Concluídas"
                value={data.counts.trajectory_complete}
              />
            </div>

            <div className="rounded-md border bg-card/50 p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Taxa de aceitação geral</span>
                <span className="font-medium">{data.overallAcceptance}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${data.overallAcceptance}%` }}
                />
              </div>
            </div>

            {Object.keys(data.acceptanceByType).length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Por tipo de ação</div>
                {Object.entries(data.acceptanceByType).map(([type, v]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{type}</span>
                    <span className="text-muted-foreground">
                      {v.apply}/{v.total} • {v.rate}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(data.rejectReasons).length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Motivos de rejeição
                </div>
                {Object.entries(data.rejectReasons).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between text-xs">
                    <span>{REJECT_REASON_LABEL[reason] ?? reason}</span>
                    <Badge variant="outline" className="text-[10px]">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card/50 px-2 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
