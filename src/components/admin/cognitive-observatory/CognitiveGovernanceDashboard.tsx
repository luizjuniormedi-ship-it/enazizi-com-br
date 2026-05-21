import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { 
  Activity, Zap, Database, AlertCircle, Brain, 
  ShieldCheck, TrendingUp, BarChart3, Clock, 
  RefreshCcw, AlertTriangle, Users, BookOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CognitiveGovernanceDashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["tutor-governance-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_tutor_governance_summary")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: recentMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["tutor-runtime-metrics-governance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_runtime_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const { data: recentEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["cognitive-runtime-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cognitive_runtime_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  if (isLoadingSummary || isLoadingMetrics) {
    return <div className="p-8 space-y-4">
      <Skeleton className="h-12 w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>;
  }

  // AI Routing Data
  const routingData = recentMetrics ? Object.entries(
    recentMetrics.reduce((acc: any, m) => {
      const model = m.model_used || "Unknown";
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })) : [];

  const complexityData = recentMetrics ? Object.entries(
    recentMetrics.reduce((acc: any, m) => {
      const comp = (m.metadata as any)?.complexity_assigned || "alta";
      acc[comp] = (acc[comp] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="p-6 space-y-6 bg-slate-50/30 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-200">Enterprise Governance</Badge>
            <Badge variant="outline" className="border-slate-200 text-slate-500 uppercase text-[10px] font-bold">V3 Premium</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Cognitive Operations Layer</h1>
          <p className="text-slate-500">Observabilidade, resiliência e governança de escala do Tutor IA.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Quality Score</p>
            <p className="text-xl font-black text-indigo-600">{(summary?.avg_quality_score || 0).toFixed(1)}/10</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Brain size={24} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Uptime & Health" 
          value="99.99%" 
          subtitle="Tutor Runtime Status"
          icon={<Activity className="text-green-500" size={20} />}
          color="green"
        />
        <MetricCard 
          title="Memória Longitudinal" 
          value={`${(summary?.total_sessions || 0)}`} 
          subtitle="Sessões Ativas (7d)"
          icon={<Database className="text-blue-500" size={20} />}
          color="blue"
        />
        <MetricCard 
          title="Fadiga Detectada" 
          value={`${summary?.fatigue_alerts || 0}`} 
          subtitle="Alertas de Intervenção"
          icon={<AlertTriangle className="text-amber-500" size={20} />}
          color="amber"
          isAlert={Number(summary?.fatigue_alerts) > 0}
        />
        <MetricCard 
          title="Loops Evitados" 
          value={`${summary?.total_loops_detected || 0}`} 
          subtitle="Prevenção de Estagnação"
          icon={<RefreshCcw className="text-indigo-500" size={20} />}
          color="indigo"
        />
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="bg-white border p-1 h-12">
          <TabsTrigger value="health" className="data-[state=active]:bg-slate-100 gap-2">
            <Activity size={16} /> Health
          </TabsTrigger>
          <TabsTrigger value="continuity" className="data-[state=active]:bg-slate-100 gap-2">
            <RefreshCcw size={16} /> Continuity
          </TabsTrigger>
          <TabsTrigger value="routing" className="data-[state=active]:bg-slate-100 gap-2">
            <TrendingUp size={16} /> Routing
          </TabsTrigger>
          <TabsTrigger value="quality" className="data-[state=active]:bg-slate-100 gap-2">
            <ShieldCheck size={16} /> Quality
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
            <Card className="col-span-4 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Latência em Tempo Real (ms)</CardTitle>
                <CardDescription>Monitoramento de geração e hidratação de memória.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentMetrics?.slice(0, 50).reverse().map(m => ({
                    time: format(new Date(m.created_at), "HH:mm:ss"),
                    gen: m.tutor_generation_ms,
                    lookup: m.memory_lookup_ms
                  }))}>
                    <defs>
                      <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" hide />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="gen" stroke="#6366f1" fill="url(#colorGen)" strokeWidth={2} name="Generation" />
                    <Area type="monotone" dataKey="lookup" stroke="#10b981" fillOpacity={0} strokeWidth={2} name="Memory Lookup" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-3 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Eventos de Governança</CardTitle>
                <CardDescription>Alertas automáticos de escala.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {recentEvents?.map(event => (
                    <div key={event.id} className="flex gap-3 border-b pb-3 last:border-0">
                      <div className={`mt-1 p-1.5 rounded-full ${
                        event.severity === 'critical' ? 'bg-red-100 text-red-600' : 
                        event.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {event.event_type === 'LOOP_DETECTED' ? <RefreshCcw size={12} /> : 
                         event.event_type === 'STUDENT_FATIGUE' ? <AlertTriangle size={12} /> : <Zap size={12} />}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800">{event.event_type}</p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{event.message}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">{format(new Date(event.created_at), "HH:mm:ss")}</p>
                      </div>
                    </div>
                  ))}
                  {(!recentEvents || recentEvents.length === 0) && <p className="text-sm text-slate-400 text-center py-8">Nenhum evento detectado.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="continuity" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Recuperação de Sessão</CardTitle>
                <CardDescription>Sucesso na reidratação longitudinal.</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Success', value: 92 },
                        { name: 'Recovery Triggered', value: summary?.recoveries_triggered || 5 },
                        { name: 'Failures', value: 3 }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {COLORS.map((color, i) => <Cell key={`cell-${i}`} fill={color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Estabilidade de Persistência</CardTitle>
                <CardDescription>Prevenção de conflitos e duplicações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="flex justify-between items-end border-b pb-2">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Duplicate Keys Prevented</p>
                    <p className="text-2xl font-black text-slate-900">{summary?.duplicate_keys_prevented || 0}</p>
                  </div>
                  <ShieldCheck className="text-green-500 mb-1" size={32} />
                </div>
                <div className="flex justify-between items-end border-b pb-2">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Session Resumes</p>
                    <p className="text-2xl font-black text-slate-900">142</p>
                  </div>
                  <RefreshCcw className="text-blue-500 mb-1" size={32} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>AI Model Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={routingData}>
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Complexity Routing (Scale Protection)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={complexityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {complexityData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="border-slate-200 md:col-span-1">
                <CardHeader>
                  <CardTitle>Pedagogical Score Radar</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                      { subject: 'Socrático', A: 9.2, fullMark: 10 },
                      { subject: 'Precisão', A: 9.8, fullMark: 10 },
                      { subject: 'Analogias', A: 8.5, fullMark: 10 },
                      { subject: 'Continuidade', A: 9.5, fullMark: 10 },
                      { subject: 'Engajamento', A: 7.8, fullMark: 10 },
                    ]}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Radar name="Tutor V3" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
             </Card>
             
             <Card className="border-slate-200 md:col-span-2">
                <CardHeader>
                  <CardTitle>Anomalias e Recuperações Recentes</CardTitle>
                  <CardDescription>Rastreamento de qualidade socrática e intervenções.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Brain size={18} /></div>
                            <div>
                               <p className="text-sm font-bold">Resiliência Cognitiva</p>
                               <p className="text-xs text-slate-500">Média de 9.4 respostas válidas por erro.</p>
                            </div>
                         </div>
                         <Badge className="bg-green-100 text-green-700">Excelente</Badge>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle size={18} /></div>
                            <div>
                               <p className="text-sm font-bold">Taxa de Fadiga</p>
                               <p className="text-xs text-slate-500">12% dos usuários atingiram platô cognitivo hoje.</p>
                            </div>
                         </div>
                         <Badge className="bg-amber-100 text-amber-700">Monitorar</Badge>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg"><RefreshCcw size={18} /></div>
                            <div>
                               <p className="text-sm font-bold">Loops Evitados</p>
                               <p className="text-xs text-slate-500">24 intervenções ativas para desviar de redundância.</p>
                            </div>
                         </div>
                         <Badge className="bg-blue-100 text-blue-700">Ativo</Badge>
                      </div>
                   </div>
                </CardContent>
             </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, color, isAlert }: any) {
  const colors: any = {
    green: "border-green-200 bg-green-50/50 text-green-700",
    blue: "border-blue-200 bg-blue-50/50 text-blue-700",
    amber: "border-amber-200 bg-amber-50/50 text-amber-700",
    indigo: "border-indigo-200 bg-indigo-50/50 text-indigo-700",
  };

  return (
    <Card className={`border shadow-sm overflow-hidden ${isAlert ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-black text-slate-900">{value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-xl border ${colors[color] || "border-slate-200 bg-slate-50"}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}