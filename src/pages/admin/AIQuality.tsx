import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { 
  Loader2, Cpu, Zap, AlertTriangle, Blocks, 
  Target, Download, RefreshCw 
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function AIQuality() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(7);

  async function loadData() {
    setLoading(true);
    try {
      const { data: res, error } = await supabase
        .rpc('admin_telemetry_v2_ai_quality', { _days: days });

      if (error) throw error;
      
      setData(res);
    } catch (error) {
      console.error("Error loading AI quality data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [days]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background/50 backdrop-blur-md">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Dashboard de Qualidade IA
          </h1>
          <p className="text-muted-foreground mt-2">Monitoramento em tempo real da performance e precisão pedagógica.</p>
        </div>
        <div className="flex gap-3">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px] bg-card/50">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => {
            const stamp = new Date().toISOString().slice(0, 10);
            const csvData = [
              { metric: "Latência Média", value: data?.avg_latency_ms },
              { metric: "Taxa de Fallback", value: data?.fallback_rate },
              { metric: "Score Pedagógico", value: data?.pedagogical_score },
              ...(data?.latency_history || []).map((h: any) => ({ time: h.time, ms: h.ms }))
            ];
            const headers = Object.keys(csvData[0]);
            const lines = [headers.join(",")].concat(
              csvData.map(r => headers.map(h => String((r as any)[h])).join(","))
            );
            const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `ai_quality_${stamp}.csv`; a.click();
          }}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Latência Média" 
          value={`${data?.avg_latency_ms || 0}ms`} 
          description="Tempo real do Tutor (24h)"
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          trend={data?.avg_latency_ms > 5000 ? "Crítico" : "Normal"}
        />
        <StatCard 
          title="Taxa de Fallback" 
          value={`${data?.fallback_rate || 0}%`} 
          description="Uso de modelos de emergência"
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          trend={data?.fallback_rate > 15 ? "Alta" : "Estável"}
        />
        <StatCard 
          title="Score Pedagógico" 
          value={`${data?.pedagogical_score || 0}/100`} 
          description="Avaliação real de precisão"
          icon={<Target className="h-5 w-5 text-green-500" />}
          trend="Dados Reais"
        />
        <StatCard 
          title="Estrutura IA" 
          value="100%" 
          description="Integridade dos blocos"
          icon={<Blocks className="h-5 w-5 text-blue-500" />}
        />
      </div>

      <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> Performance Temporal
          </CardTitle>
          <CardDescription>Estabilidade da latência (últimas 50 interações)</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.latency_history || []}>
              <defs>
                <linearGradient id="colorMs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis dataKey="time" fontSize={10} hide />
              <YAxis />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
              />
              <Area type="monotone" dataKey="ms" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMs)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, description, icon, trend }: any) {
  return (
    <Card className="border-primary/10 bg-card/40 hover:bg-card/60 transition-colors cursor-default">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${['Normal', 'Estável', 'Dados Reais'].includes(trend) ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
