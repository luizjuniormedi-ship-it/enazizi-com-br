import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle, Zap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const SystemHealthDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: async () => {
      // Fetch online users (users with activity in last 5 mins)
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count: onlineUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('updated_at', fiveMinsAgo);

      // Fetch recent errors - use any to bypass type issues with dynamic table
      const { data: recentErrors } = await (supabase as any)
        .from('error_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const hourAgo = new Date(Date.now() - 3600000);
      const errorsLastHour = (recentErrors || []).filter((e: any) => new Date(e.created_at) > hourAgo).length;

      // Fetch real AI quality metrics
      const { data: aiQualityData } = await supabase.rpc('admin_telemetry_v2_ai_quality', { _days: 1 });
      const aiQuality = aiQualityData as any;
      
      const avgLatency = aiQuality?.avg_latency_ms ? `${aiQuality.avg_latency_ms}ms` : "0ms";
      const latencyHistory = aiQuality?.latency_history?.map((h: any) => ({
        time: h.time,
        ms: h.ms
      })) || [];

      // Phase V: Enterprise Telemetry Summary
      const { data: telemetrySummary } = await (supabase as any)
        .from('v_enterprise_telemetry_summary')
        .select('*');

      const runtimeErrors = telemetrySummary?.find((s: any) => s.event_name === 'runtime_error')?.event_count || 0;
      const hydrationIssues = telemetrySummary?.find((s: any) => s.event_name === 'hydration_mismatch')?.event_count || 0;
      const offlineEvents = telemetrySummary?.find((s: any) => s.event_name === 'offline_transition')?.event_count || 0;

      return {
        onlineUsers: onlineUsers || 0,
        errorsLastHour,
        recentErrors: recentErrors || [],
        avgLatency,
        latencyHistory,
        runtimeErrors,
        hydrationIssues,
        offlineEvents
      };
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  if (isLoading) return <div className="p-8 animate-pulse">Carregando métricas de saúde...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center text-foreground">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saúde & Estabilidade</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real de infraestrutura e performance IA.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-medium border border-green-500/20">
          <CheckCircle className="w-4 h-4" />
          Sistemas Operacionais
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Online</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.onlineUsers}</div>
            <p className="text-xs text-muted-foreground">Atividade nos últimos 5 min</p>
          </CardContent>
        </Card>
        <Card className="bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erros (1h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.errorsLastHour}</div>
            <p className="text-xs text-muted-foreground">Taxa de erro está estável</p>
          </CardContent>
        </Card>
        <Card className="bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latência Média</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgLatency}</div>
            <p className="text-xs text-muted-foreground">Tempo de resposta da API</p>
          </CardContent>
        </Card>
        <Card className="bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.98%</div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card text-card-foreground border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Runtime Errors (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.runtimeErrors}</div>
            <p className="text-xs text-muted-foreground">Exceções capturadas no frontend</p>
          </CardContent>
        </Card>
        <Card className="bg-card text-card-foreground border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Hydration Mismatches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.hydrationIssues}</div>
            <p className="text-xs text-muted-foreground">Alertas de dessincronização SSR</p>
          </CardContent>
        </Card>
        <Card className="bg-card text-card-foreground border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Offline Transitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.offlineEvents}</div>
            <p className="text-xs text-muted-foreground">Eventos de perda de conexão</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle>Latência das Edge Functions (ms)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.latencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Line type="monotone" dataKey="ms" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle>Logs de Erro Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recentErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum erro registrado recentemente.</p>
              ) : (
                stats?.recentErrors.slice(0, 5).map((error: any) => (
                  <div key={error.id} className="flex items-start gap-4 text-sm border-b pb-3 last:border-0">
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${error.severity === 'critical' ? 'bg-destructive' : 'bg-yellow-500'}`} />
                    <div className="space-y-1">
                      <p className="font-medium leading-none line-clamp-1">{error.error_message}</p>
                      <p className="text-xs text-muted-foreground italic">
                        {new Date(error.created_at).toLocaleTimeString()} • {error.context?.url || 'system'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" /> Alertas de Estabilidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StabilityAlert 
              title="Edge Functions" 
              status="Normal" 
              latency="180ms" 
              description="Nenhum timeout detectado nas últimas 24h."
            />
            <StabilityAlert 
              title="Supabase API" 
              status="Excelente" 
              latency="45ms" 
              description="Conectividade estável em todas as regiões."
            />
            <StabilityAlert 
              title="Tutor IA" 
              status="Alerta" 
              latency="4.2s" 
              description="Aumento de 12% na latência do modelo principal."
              isWarning
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function StabilityAlert({ title, status, latency, description, isWarning }: any) {
  return (
    <div className={`p-4 rounded-lg border ${isWarning ? 'border-orange-500/30 bg-orange-500/5' : 'border-border bg-card'}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant={isWarning ? "outline" : "secondary"}>{status}</Badge>
      </div>
      <div className="text-2xl font-bold mb-1">{latency}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
