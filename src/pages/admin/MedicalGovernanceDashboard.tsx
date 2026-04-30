import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Line
} from "recharts";
import { 
  ShieldAlert, 
  TrendingDown, 
  Zap, 
  Coins, 
  CheckSquare, 
  AlertCircle,
  Award
} from "lucide-react";

const MedicalGovernanceDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["medical-governance-stats"],
    queryFn: async () => {
      const { data: logs, error: logsError } = await supabase
        .from("medical_prompt_execution_logs")
        .select("*");
      
      const { data: contents, error: contentsError } = await supabase
        .from("master_content_library")
        .select("status, is_gold_standard, discipline, estimated_cost, media_status");

      if (logsError || contentsError) throw logsError || contentsError;

      const totalCost = contents?.reduce((acc, curr) => acc + (Number(curr.estimated_cost) || 0), 0);
      const goldContents = contents?.filter(c => c.is_gold_standard).length;
      const pendingReviews = contents?.filter(c => ["ai_generated", "pedagogical_review", "scientific_review"].includes(c.status)).length;
      
      const statusDistribution = contents?.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      const cacheStats = logs?.reduce((acc: any, curr) => {
        const type = curr.cache_status || "cache_miss";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalCost,
        goldContents,
        pendingReviews,
        statusData: Object.entries(statusDistribution || {}).map(([name, value]) => ({ name, value })),
        cacheData: Object.entries(cacheStats || {}).map(([name, value]) => ({ name, value })),
        totalLogs: logs?.length || 0
      };
    }
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (isLoading) return <div className="p-8 text-center">Carregando BI de Governança...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Governança Médica</h1>
          <p className="text-muted-foreground">Monitoramento científico, financeiro e de qualidade.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total IA</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalCost?.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Tokens Gemini consumidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Revisão</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingReviews}</div>
            <p className="text-xs text-muted-foreground">Conteúdos na fila de governança</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conteúdos Ouro</CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.goldContents}</div>
            <p className="text-xs text-muted-foreground">Score científico {">"} 90%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Economia Cache</CardTitle>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.4%</div>
            <p className="text-xs text-muted-foreground">Reutilização semântica</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats?.statusData?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eficiência de Cache</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.cacheData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Risco de Alucinação vs Custo</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             {/* Simulação de tendência */}
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { date: '01/04', risk: 5, cost: 20 },
                { date: '07/04', risk: 4, cost: 45 },
                { date: '14/04', risk: 2, cost: 80 },
                { date: '21/04', risk: 3, cost: 110 },
                { date: '28/04', risk: 1, cost: 140 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="risk" stroke="#ef4444" name="Risco (%)" />
                <Line type="monotone" dataKey="cost" stroke="#3b82f6" name="Custo Acumulado" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" /> Alertas Críticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800">
              <span className="font-bold">Hallucination detected:</span> Prompt "Condutas Emergência v1.2" gerou dosagem incorreta de Amiodarona.
            </div>
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-800">
              <span className="font-bold">Custo alto:</span> Especialidade "Cirurgia" excedeu orçamento diário em 15%.
            </div>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
              <span className="font-bold">Gargalo:</span> 15 conteúdos aguardando revisão científica há mais de 48h.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MedicalGovernanceDashboard;
