import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from "recharts";
import { 
  Activity, Zap, Database, AlertCircle, Clock, 
  CheckCircle2, ChevronRight, BarChart3, TrendingUp 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TutorStabilizationDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["tutor-runtime-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_runtime_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const stats = useMemo(() => {
    if (!metrics || metrics.length === 0) return null;
    
    const avgGen = metrics.reduce((acc, m) => acc + (m.tutor_generation_ms || 0), 0) / metrics.length;
    const avgLookup = metrics.reduce((acc, m) => acc + (m.memory_lookup_ms || 0), 0) / metrics.length;
    const memoryHitRate = (metrics.filter(m => m.memory_hit).length / metrics.length) * 100;
    
    // Type-safe error check for JSON metadata
    const errorCount = metrics.filter(m => {
      const meta = m.metadata as Record<string, any> | null;
      return meta?.error || (m.tutor_generation_ms && m.tutor_generation_ms > 15000);
    }).length;
    
    // Agrupar por hora para o gráfico
    const chartData = metrics.slice(0, 50).reverse().map(m => ({
      time: format(new Date(m.created_at), "HH:mm:ss"),
      generation: m.tutor_generation_ms,
      lookup: m.memory_lookup_ms,
      tokens: (m.prompt_tokens || 0) + (m.completion_tokens || 0)
    }));

    return { avgGen, avgLookup, memoryHitRate, errorCount, chartData };
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tutor V3 Stabilization Dashboard</h1>
          <p className="text-slate-500">Métricas em tempo real de latência, memória e resiliência enterprise.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 bg-green-50 text-green-700 border-green-200 gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live Telemetry
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Avg Generation" 
          value={`${(stats?.avgGen || 0).toFixed(0)}ms`} 
          subtitle="Latência do AI Model"
          icon={<Zap className="text-amber-500" size={20} />}
        />
        <MetricCard 
          title="Memory Hit Rate" 
          value={`${(stats?.memoryHitRate || 0).toFixed(1)}%`} 
          subtitle="Eficiência do Cache Longitudinal"
          icon={<Database className="text-blue-500" size={20} />}
        />
        <MetricCard 
          title="Avg Lookup" 
          value={`${(stats?.avgLookup || 0).toFixed(0)}ms`} 
          subtitle="Tempo de Hidratação"
          icon={<Clock className="text-indigo-500" size={20} />}
        />
        <MetricCard 
          title="Health Score" 
          value={stats?.errorCount === 0 ? "100%" : `${(100 - (stats!.errorCount / metrics!.length) * 100).toFixed(1)}%`} 
          subtitle="Resiliência de Erros"
          icon={<Activity className="text-green-500" size={20} />}
          trend={stats?.errorCount === 0 ? "stable" : "down"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp size={18} className="text-slate-500" />
              Latência (Generation vs Lookup)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.chartData}>
                <defs>
                  <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" fontSize={10} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="generation" stroke="#f59e0b" fillOpacity={1} fill="url(#colorGen)" strokeWidth={2} name="Generation (ms)" />
                <Area type="monotone" dataKey="lookup" stroke="#6366f1" fillOpacity={0} strokeWidth={2} name="Lookup (ms)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-slate-500" />
              Carga de Tokens (Escala)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" fontSize={10} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Tokens" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Event Log (Correlation Tracing)</CardTitle>
              <CardDescription>Rastreabilidade ponta a ponta por Correlation ID</CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs font-medium uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Correlation ID</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3 text-right">Gen Time</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics?.slice(0, 10).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {format(new Date(m.created_at), "dd/MM HH:mm:ss")}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400 group-hover:text-slate-600">
                    {m.correlation_id?.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{m.topic}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">
                    {m.tutor_generation_ms}ms
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.tutor_generation_ms < 10000 ? (
                      <CheckCircle2 className="mx-auto text-green-500" size={16} />
                    ) : (
                      <AlertCircle className="mx-auto text-amber-500" size={16} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, trend }: any) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
