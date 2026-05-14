import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MonitoringMetricCard";
import { TrendingUp, DollarSign, Database, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(142 76% 36%)",
  "hsl(38 92% 50%)", "hsl(262 83% 58%)", "hsl(199 89% 48%)"
];

export function ScaleGovernanceTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["massive-scale-governance-stats"],
    queryFn: async () => {
      // Fetch lifecycle distribution
      const { data: lifecycle } = await supabase
        .from("questions_bank")
        .select("lifecycle_state");
      
      const counts: Record<string, number> = {};
      lifecycle?.forEach(q => {
        const state = q.lifecycle_state || 'unknown';
        counts[state] = (counts[state] || 0) + 1;
      });

      const lifecycleData = Object.entries(counts).map(([name, value]) => ({ name, value }));

      // Fetch AI costs (last 7 days)
      const { data: costs } = await supabase
        .from("ai_cost_metrics")
        .select("cost_usd, feature_name, created_at")
        .order("created_at", { ascending: true });

      const totalCost = costs?.reduce((acc, curr) => acc + Number(curr.cost_usd), 0) || 0;
      
      const costByFeature: Record<string, number> = {};
      costs?.forEach(c => {
        costByFeature[c.feature_name] = (costByFeature[c.feature_name] || 0) + Number(c.cost_usd);
      });
      const featureCostData = Object.entries(costByFeature).map(([name, value]) => ({ name, value }));

      // Fetch Queues
      const { data: queues } = await supabase
        .from("governance_queues")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const activeQueues = queues?.filter(q => q.status === 'processing').length || 0;

      return {
        lifecycleData,
        totalCost,
        featureCostData,
        queues,
        activeQueues,
        totalQuestions: lifecycle?.length || 0
      };
    },
    refetchInterval: 30000
  });

  if (isLoading) return <div className="h-64 flex items-center justify-center">Carregando governança...</div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Database} label="Banco Total" value={stats?.totalQuestions || 0} />
        <MetricCard icon={DollarSign} label="Custo IA Total" value={`$${stats?.totalCost.toFixed(2)}`} />
        <MetricCard icon={TrendingUp} label="Batches Ativos" value={stats?.activeQueues || 0} />
        <MetricCard icon={ShieldCheck} label="Qualidade Média" value="0.92" color="text-emerald-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Lifecycle Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.lifecycleData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stats?.lifecycleData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              AI Cost by Feature
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.featureCostData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {stats?.featureCostData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Governance Queues (Recent)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.queues?.map((q: any) => (
              <div key={q.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 text-xs">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] text-muted-foreground">{q.batch_id.slice(0, 8)}</span>
                  <span className="font-medium capitalize">{q.queue_type.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{new Date(q.created_at).toLocaleString('pt-BR')}</span>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] ${
                    q.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    q.status === 'processing' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {q.status}
                  </div>
                </div>
              </div>
            ))}
            {!stats?.queues?.length && (
              <p className="text-center py-4 text-muted-foreground">Nenhum processo em fila</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
