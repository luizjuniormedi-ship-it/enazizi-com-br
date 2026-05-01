import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCMEAnalytics } from "@/hooks/useCMEAnalytics";
import { BarChart, Activity, Shield, Zap, Brain, Heart, AlertCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function CMEExecutiveDashboard() {
  const { getExecutiveKPIs } = useCMEAnalytics();

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["cme-executive-kpis"],
    queryFn: getExecutiveKPIs,
    refetchInterval: 10000
  });

  if (isLoading) return <div className="p-8">Carregando métricas executivas enterprise...</div>;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">CME Executive Dashboard</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium">Enterprise+ Adaptive Intelligence</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-tighter">Realtime Adaptive Engine Active</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-tight">Throughput Total</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{kpis?.throughput || 0}</div>
            <p className="text-[10px] uppercase text-muted-foreground font-bold mt-1">Jobs finalizados com sucesso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-tight">Fallback Rate</CardTitle>
            <Shield className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-yellow-600">{kpis?.fallbackRate}%</div>
            <p className="text-[10px] uppercase text-muted-foreground font-bold mt-1">Resiliência pedagógica ativa</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-tight">Engagement Avg</CardTitle>
            <Heart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-purple-600">{kpis?.avgEngagement || 0}%</div>
            <Progress value={kpis?.avgEngagement || 0} className="h-1 mt-2 bg-purple-100" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-tight">GPU Fleet Status</CardTitle>
            <BarChart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{kpis?.activeWorkers} <span className="text-xs font-medium text-muted-foreground">NODES</span></div>
            <p className="text-[10px] uppercase text-muted-foreground font-bold mt-1">{kpis?.efficiency}% eficiência operacional</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 overflow-hidden border-zinc-800">
          <CardHeader className="bg-zinc-950/50 border-b border-zinc-800/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Adaptive Cognitive Mesh
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                    <span>Retenção Média (FSRS)</span>
                    <span className="text-primary">{kpis?.cognitiveScore}%</span>
                  </div>
                  <Progress value={kpis?.cognitiveScore || 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                    <span>Fadiga Cognitiva</span>
                    <span className="text-amber-500">{kpis?.avgFatigue || 0}%</span>
                  </div>
                  <Progress value={kpis?.avgFatigue || 0} className="h-2" />
                </div>
              </div>
              
              <div className="h-[200px] w-full bg-zinc-950 rounded-2xl border border-zinc-900 p-4 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
                <div className="text-center space-y-2 relative z-10">
                  <Brain className="h-12 w-12 text-primary/40 mx-auto animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Cognitive Load Distribution Map</p>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end gap-1 h-24">
                   {[40, 60, 45, 90, 65, 80, 50, 70, 85, 40, 55, 75, 60, 40, 90, 30].map((h, i) => (
                     <div key={i} className="bg-primary/20 w-full rounded-t hover:bg-primary transition-colors cursor-pointer" style={{ height: `${h}%` }} />
                   ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Enterprise Ecosystem Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className={cn("w-2 h-2 rounded-full", kpis?.throughput > 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-yellow-500")} />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-tight">Adaptive Rendering Service</p>
                    <p className="text-[10px] text-muted-foreground">Pacing engine active and scaled</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-5">STABLE</Badge>
                </div>
                
                <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className={cn("w-2 h-2 rounded-full", kpis?.activeWorkers > 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-tight">GPU Cluster Fleet</p>
                    <p className="text-[10px] text-muted-foreground">{kpis?.activeWorkers} Dedicated Nodes Online</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-5">AUTO-SCALED</Badge>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-tight">Knowledge Mesh Engine</p>
                    <p className="text-[10px] text-muted-foreground">Cross-módulo lineage active</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-5">SYNCED</Badge>
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">System Insights</span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  O motor cognitivo detectou um aumento de 14% na retenção de temas críticos após o ajuste dinâmico do pacing narrativo na última hora.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
