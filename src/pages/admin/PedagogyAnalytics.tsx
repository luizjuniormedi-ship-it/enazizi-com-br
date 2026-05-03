import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { 
  Loader2, Brain, Timer, UserMinus, BookOpen, 
  Repeat, ShieldCheck, RefreshCw, Download 
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { AdminAlertCenter } from "@/components/admin/AdminAlertCenter";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function PedagogyAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(7);

  async function loadData() {
    setLoading(true);
    try {
      const { data: res, error } = await supabase
        .rpc('admin_telemetry_v2_pedagogy', { _days: days });

      if (error) throw error;
      
      setData(res || {
        avg_session_time: 0,
        abandonment_rate: 0,
        blocks: [],
        moduleStats: []
      });
    } catch (error) {
      console.error("Error loading pedagogy data:", error);
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
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Telemetria Pedagógica
          </h1>
          <p className="text-muted-foreground mt-2">Observabilidade profunda do fluxo cognitivo e retenção real.</p>
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
              { metric: "Tempo Médio", value: data.avg_session_time },
              { metric: "Taxa de Abandono", value: data.abandonment_rate },
              ...(data.moduleStats || []).map((m: any) => ({ metric: `Módulo: ${m.name}`, started: m.started, abandoned: m.abandoned }))
            ];
            const headers = Object.keys(csvData[0]);
            const lines = [headers.join(",")].concat(
              csvData.map(r => headers.map(h => String((r as any)[h])).join(","))
            );
            const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `pedagogy_analytics_${stamp}.csv`; a.click();
          }}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </header>

      <AdminAlertCenter />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Tempo Médio" 
          value={`${data.avg_session_time} min`} 
          description="Duração média da sessão real"
          icon={<Timer className="h-5 w-5 text-blue-500" />}
        />
        <StatCard 
          title="Taxa de Abandono" 
          value={`${data.abandonment_rate}%`} 
          description="Usuários que saem prematuramente"
          icon={<UserMinus className="h-5 w-5 text-red-500" />}
          trend={data.abandonment_rate > 25 ? "Crítico" : "Saudável"}
        />
        <StatCard 
          title="Interações IA" 
          value={data.blocks?.find((b: any) => b.name === 'Interação IA')?.value || 0} 
          description="Total de mensagens enviadas"
          icon={<Brain className="h-5 w-5 text-purple-500" />}
        />
        <StatCard 
          title="Active Recall" 
          value={data.blocks?.find((b: any) => b.name === 'Active Recall')?.value || 0} 
          description="Quizzes e desafios respondidos"
          icon={<Repeat className="h-5 w-5 text-green-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Engajamento por Módulo
            </CardTitle>
            <CardDescription>Fluxo vs Abandono Real por Rota</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.moduleStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                />
                <Bar dataKey="started" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Iniciados" />
                <Bar dataKey="abandoned" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Abandonados" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Distribuição de Eventos
            </CardTitle>
            <CardDescription>Composição das interações pedagógicas</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="250px">
              <PieChart>
                <Pie
                  data={data.blocks}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.blocks?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 mt-4 w-full px-4">
              {data.blocks?.map((b: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium truncate">{b.name}: {b.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${trend === 'Saudável' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}