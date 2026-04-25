import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, FunnelChart, Funnel, LabelList, Cell } from "recharts";
import { Loader2, TrendingUp, Users, Clock, AlertCircle } from "lucide-react";

const TelemetryAdmin = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTelemetry = async () => {
      // Basic count of events
      const { data: events } = await supabase
        .from('telemetry_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (!events) return;

      const eventNames = events.map(e => e.event_name);
      const counts = eventNames.reduce((acc: any, name: string) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      // Funnel Calculation: Hoje -> Estudar -> Questão
      // Simplification for the POC dashboard
      const funnelData = [
        { value: counts['dashboard_opened'] || 0, name: 'Hoje', fill: '#8884d8' },
        { value: counts['study_session_started'] || 0, name: 'Estudar', fill: '#83a6ed' },
        { value: counts['first_answer_submitted'] || 0, name: 'Questão', fill: '#8dd1e1' },
      ];

      // Retention (dummy logic for POC as real retention requires complex group by)
      const retentionData = [
        { name: 'D0', value: 100 },
        { name: 'D1', value: 65 },
        { name: 'D7', value: 30 },
      ];

      setStats({
        counts,
        funnelData,
        retentionData,
        recentEvents: events.slice(0, 10)
      });
      setLoading(false);
    };

    fetchTelemetry();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telemetria Pedagógica</h1>
          <p className="text-muted-foreground text-lg">Decisões baseadas em comportamento real do aluno.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sessões Totais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts['dashboard_opened'] || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estudos Iniciados</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts['study_session_started'] || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Abandono</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.counts['study_session_started'] ? 
                Math.round(((stats.counts['study_session_abandoned'] || 0) / stats.counts['study_session_started']) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fricção (Rage Clicks)</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts['rage_click_detected'] || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão Pedagógica</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={stats.funnelData} isAnimationActive>
                  <LabelList position="right" fill="#888" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Retenção Projetada (D1/D7)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.retentionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentEvents.map((e: any) => (
              <div key={e.id} className="flex justify-between items-center border-b pb-2 text-sm">
                <span className="font-mono bg-muted px-2 py-1 rounded">{e.event_name}</span>
                <span className="text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="text-xs text-muted-foreground italic">{e.route}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelemetryAdmin;
