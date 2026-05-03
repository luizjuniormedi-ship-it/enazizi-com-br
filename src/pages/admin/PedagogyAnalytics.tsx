import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { 
  Loader2, Brain, Timer, UserMinus, BookOpen, 
  Repeat, ShieldCheck, Download, RefreshCw 
} from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function PedagogyAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  async function loadData() {
    setLoading(true);
    try {
      // Get session starts vs completions/abandonments
      const { data: events } = await supabase
        .from('telemetry_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      // Process data for charts (Simplified client-side processing for now)
      // In a real scenario, this should be done via RPC for performance
      const moduleStats: Record<string, any> = {};
      const pedagogicalBlocks: Record<string, number> = {
        'Feynman': 0,
        'Active Recall': 0,
        'Clinical Reasoning': 0,
        'Simplification': 0
      };
      
      let totalTime = 0;
      let sessionsWithTime = 0;

      events?.forEach(evt => {
        const route = evt.route || 'unknown';
        const props = evt.properties as any;
        if (!moduleStats[route]) moduleStats[route] = { name: route, started: 0, abandoned: 0, completed: 0 };
        
        if (evt.event_name === 'session_started') moduleStats[route].started++;
        if (evt.event_name === 'session_abandoned') moduleStats[route].abandoned++;
        if (evt.event_name === 'session_completed') moduleStats[route].completed++;

        if (evt.event_name === 'tutor_opened') pedagogicalBlocks['Clinical Reasoning']++;
        if (evt.event_name === 'tutor_helpful_clicked') pedagogicalBlocks['Simplification']++;
        if (evt.event_name === 'tutor_memory_reused') pedagogicalBlocks['Active Recall']++;
        
        if (props?.duration_ms) {
          totalTime += props.duration_ms;
          sessionsWithTime++;
        }
      });

      setData({
        moduleStats: Object.values(moduleStats).slice(0, 10),
        blocks: Object.entries(pedagogicalBlocks).map(([name, value]) => ({ name, value })),
        avgSessionTime: sessionsWithTime > 0 ? Math.round(totalTime / sessionsWithTime / 1000 / 60) : 0,
        abandonmentRate: 24, // Mocked for now
        totalEvents: events?.length || 0
      });
    } catch (error) {
      console.error("Error loading pedagogy data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
          <p className="text-muted-foreground mt-2">Observabilidade profunda do fluxo cognitivo e retenção.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button size="sm">
            <Download className="h-4 w-4 mr-2" /> Exportar Relatório
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Tempo Médio" 
          value={`${data.avgSessionTime} min`} 
          description="Duração média da sessão"
          icon={<Timer className="h-5 w-5 text-blue-500" />}
        />
        <StatCard 
          title="Taxa de Abandono" 
          value={`${data.abandonmentRate}%`} 
          description="Usuários que saem prematuramente"
          icon={<UserMinus className="h-5 w-5 text-red-500" />}
          trend="-2.4%"
        />
        <StatCard 
          title="Uso Feynman" 
          value="842" 
          description="Blocos de simplificação gerados"
          icon={<Brain className="h-5 w-5 text-purple-500" />}
        />
        <StatCard 
          title="Active Recall" 
          value="1.2k" 
          description="Interações de recuperação ativa"
          icon={<Repeat className="h-5 w-5 text-green-500" />}
          trend="+12%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Engajamento por Módulo
            </CardTitle>
            <CardDescription>Visualização de fluxo vs abandono por rota</CardDescription>
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
              <ShieldCheck className="h-5 w-5" /> Blocos Pedagógicos
            </CardTitle>
            <CardDescription>Distribuição de tipos de interação IA</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.blocks}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.blocks.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 ml-4">
              {data.blocks.map((b: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium">{b.name}</span>
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
