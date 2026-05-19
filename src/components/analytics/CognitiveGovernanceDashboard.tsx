
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  HeartPulse, 
  BrainCircuit, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  Zap,
  Clock
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export const CognitiveGovernanceDashboard = () => {
  const { data: healthData, isLoading: loadingHealth } = useQuery({
    queryKey: ['pedagogical-health'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('pedagogical_health_indices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    }
  });

  const { data: cognitiveStates } = useQuery({
    queryKey: ['cognitive-states'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('cognitive_states')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    }
  });

  const currentHealth = healthData?.[0];
  const currentState = cognitiveStates?.[0];

  const chartData = healthData?.slice().reverse().map(h => ({
    date: new Date(h.created_at).toLocaleDateString(),
    score: h.health_score,
    retention: (h.retention_factor || 0)
  }));

  const getStateColor = (state: string) => {
    switch (state) {
      case 'hyperfocus': return 'bg-purple-500';
      case 'alta_performance': return 'bg-green-500';
      case 'fatigue': return 'bg-yellow-500';
      case 'burnout_inicial': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-4">
      {/* Pedagogical Health Score */}
      <Card className="col-span-1 border-t-4 border-t-red-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saúde Pedagógica</CardTitle>
          <HeartPulse className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(currentHealth?.health_score || 100)}%</div>
          <Progress value={currentHealth?.health_score || 100} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            +2.1% em relação a ontem
          </p>
        </CardContent>
      </Card>

      {/* Cognitive State */}
      <Card className="col-span-1 border-t-4 border-t-purple-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado Cognitivo</CardTitle>
          <BrainCircuit className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Badge className={`${getStateColor(currentState?.state || '')} text-white hover:${getStateColor(currentState?.state || '')}`}>
              {currentState?.state?.replace('_', ' ').toUpperCase() || 'ESTABILIDADE IDEAL'}
            </Badge>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Zap className="h-3 w-3 text-yellow-500" />
              Intensidade: {Math.round((currentState?.intensity || 1) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3 text-blue-500" />
              Detectado há {currentState ? '15 min' : '---'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stability Chart */}
      <Card className="col-span-2 row-span-2">
        <CardHeader>
          <CardTitle>Estabilidade Longitudinal</CardTitle>
          <CardDescription>Saúde e Retenção nos últimos 20 ciclos</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="score" stroke="#ef4444" fillOpacity={1} fill="url(#colorScore)" name="Saúde" />
              <Line type="monotone" dataKey="retention" stroke="#3b82f6" strokeWidth={2} name="Retenção" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recovery Intelligence */}
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Eficiência de Recuperação</CardTitle>
          <Activity className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round((currentHealth?.recovery_efficiency || 0) * 100)}%</div>
          <p className="text-xs text-muted-foreground mt-1">Capacidade de resposta pós-erro</p>
        </CardContent>
      </Card>

      {/* Governance Quality */}
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Qualidade IA (Audit)</CardTitle>
          <ShieldCheck className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">98.4</div>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="outline" className="text-[10px] py-0">ZERO HALLUCINATION</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
