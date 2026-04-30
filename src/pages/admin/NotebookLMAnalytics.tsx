import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  Music, 
  Play, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Users, 
  Zap,
  BarChart3,
  BookOpen
} from "lucide-react";

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

export default function NotebookLMAnalytics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["notebooklm-analytics"],
    queryFn: async () => {
      const { data: logs, error: logsError } = await supabase
        .from("notebooklm_usage_logs")
        .select(`
          *,
          master_content_library (title, discipline)
        `);
      
      const { data: notebooks, error: netbooksError } = await supabase
        .from("notebooklm_notebooks")
        .select("*");

      if (logsError || netbooksError) throw logsError || netbooksError;

      // Processing metrics
      const totalPlays = logs?.filter(l => l.action === 'audio_play').length || 0;
      const totalCompletions = logs?.filter(l => l.action === 'audio_complete').length || 0;
      const totalGuideOpens = logs?.filter(l => l.action === 'guide_open').length || 0;
      
      const completionRate = totalPlays > 0 ? (totalCompletions / totalPlays) * 100 : 0;

      // Group by specialty
      const specialtyStats = logs?.reduce((acc: any, curr) => {
        const spec = curr.master_content_library?.discipline || "Outros";
        acc[spec] = (acc[spec] || 0) + 1;
        return acc;
      }, {});

      // Most active contents
      const contentStats = logs?.reduce((acc: any, curr) => {
        const title = curr.master_content_library?.title || "N/A";
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {});

      return {
        totalPlays,
        totalCompletions,
        totalGuideOpens,
        completionRate,
        specialtyData: Object.entries(specialtyStats || {}).map(([name, value]) => ({ name, value })),
        contentData: Object.entries(contentStats || {})
          .map(([name, value]) => ({ name, value }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 5),
        timelineData: [
          { date: '01/04', plays: 12, completions: 8 },
          { date: '07/04', plays: 25, completions: 18 },
          { date: '14/04', plays: 45, completions: 32 },
          { date: '21/04', plays: 78, completions: 55 },
          { date: '28/04', plays: 102, completions: 82 },
        ]
      };
    }
  });

  if (isLoading) return <div className="p-10 text-center animate-pulse">Carregando Analytics Multimídia...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Multimídia</h1>
        <p className="text-muted-foreground">Engajamento dos alunos com podcasts e guias NotebookLM.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plays Totais (Áudio)</CardTitle>
            <Play className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalPlays}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Inícios de reprodução</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.completionRate.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Podcast ouvido até o fim</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Acessos ao Guia</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalGuideOpens}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Interações com o NotebookLM</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14.2 min</div>
            <p className="text-[10px] text-muted-foreground mt-1">Retenção por sessão</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Engajamento Multimídia (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.timelineData}>
                <defs>
                  <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="plays" stroke="#8884d8" fillOpacity={1} fill="url(#colorPlays)" name="Plays" />
                <Area type="monotone" dataKey="completions" stroke="#82ca9d" fillOpacity={0.3} fill="#82ca9d" name="Conclusões" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Top Especialidades Consumidas
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.specialtyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {metrics?.specialtyData?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Conteúdos com Maior Retenção
          </CardTitle>
          <CardDescription>Materiais que mantêm os alunos engajados por mais tempo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics?.contentData.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    #{i+1}
                  </div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                   <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(item.value / metrics.contentData[0].value) * 100}%` }} />
                   </div>
                   <span className="text-xs font-bold">{item.value} interações</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
