import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCMEAnalytics } from "@/hooks/useCMEAnalytics";
import { BarChart, Activity, Shield, Zap } from "lucide-react";

export default function CMEExecutiveDashboard() {
  const { getExecutiveKPIs } = useCMEAnalytics();

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["cme-executive-kpis"],
    queryFn: getExecutiveKPIs,
    refetchInterval: 10000
  });

  if (isLoading) return <div className="p-8">Carregando métricas executivas...</div>;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">CME Executive Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput Total</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.throughput || 0}</div>
            <p className="text-xs text-muted-foreground">Jobs finalizados com sucesso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fallback Rate</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{kpis?.fallbackRate}%</div>
            <p className="text-xs text-muted-foreground">Recuperação pedagógica ativa</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cognitive Score</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.cognitiveScore}/100</div>
            <p className="text-xs text-muted-foreground">Índice de retenção previsto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPU Efficiency</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.efficiency}%</div>
            <p className="text-xs text-muted-foreground">{kpis?.activeWorkers} workers ativos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Throughput Realtime</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] flex items-end gap-2 px-4">
               {[40, 60, 45, 90, 65, 80, 50, 70, 85, 40, 55, 75].map((h, i) => (
                 <div key={i} className="bg-primary/20 w-full rounded-t" style={{ height: `${h}%` }} />
               ))}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Saúde do Ecossistema CME</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={cn("w-2 h-2 rounded-full", kpis?.throughput > 0 ? "bg-green-500" : "bg-yellow-500")} />
                <div className="flex-1 text-sm">Aggregator Service</div>
                <div className="text-xs text-muted-foreground">Ativo</div>
              </div>
              <div className="flex items-center gap-4">
                <div className={cn("w-2 h-2 rounded-full", kpis?.activeWorkers > 0 ? "bg-green-500" : "bg-red-500")} />
                <div className="flex-1 text-sm">GPU Render Cluster</div>
                <div className="text-xs text-muted-foreground">{kpis?.activeWorkers} Nodes Online</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="flex-1 text-sm">Lineage Tracking</div>
                <div className="text-xs text-muted-foreground">Auditoria Síncrona</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
