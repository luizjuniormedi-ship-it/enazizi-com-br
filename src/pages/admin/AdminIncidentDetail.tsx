import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, Clock, MapPin, Cpu, User, 
  AlertCircle, CheckCircle2, History, Database,
  Terminal, ShieldAlert, BarChart3, Activity,
  Zap, AlertTriangle
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { toast } from "sonner";

export default function AdminIncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState<any>(null);
  const [relatedLogs, setRelatedLogs] = useState<any[]>([]);

  async function loadIncident() {
    setLoading(true);
    try {
      // Trying the new table first, fallback to the old one if needed
      const { data, error } = await supabase
        .from('incident_events')
        .select(`*`)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        // Fallback for UI compatibility
        const { data: oldData } = await supabase.from('admin_incidents').select('*').eq('id', id).maybeSingle();
        if (oldData) setIncident(oldData);
      } else {
        setIncident(data);
      }

      const { data: logs } = await supabase
        .from('governance_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRelatedLogs(logs || []);
    } catch (error) {
      console.error("Error loading incident:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncident();
  }, [id]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (!incident) return (
    <div className="p-8 text-center bg-background min-h-screen">
      <h2 className="text-2xl font-bold">Incidente não encontrado</h2>
      <Button variant="link" onClick={() => navigate(-1)}>Voltar</Button>
    </div>
  );

  const severityColor = {
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    info: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  }[incident.severity as string] || "bg-muted text-muted-foreground";

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto bg-background min-h-screen animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="pl-0 text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Centro de Comando
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {incident.event_type || incident.title || "Evento de Sistema"}
            </h1>
            <Badge variant="outline" className={`capitalize ${severityColor}`}>
              {incident.severity}
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              {incident.status || "OPEN"}
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            {incident.description || "Detecção automática de anomalia no barramento de eventos."}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none">
            <ShieldAlert className="h-4 w-4 mr-2" /> Silenciar
          </Button>
          <Button className="flex-1 md:flex-none">Investigar RCA</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Análise de Impacto
              </CardTitle>
              <CardDescription>Métricas correlacionadas no momento do incidente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { time: '10:00', errors: 2, latency: 450 },
                    { time: '10:05', errors: 5, latency: 800 },
                    { time: '10:10', errors: 45, latency: 5600 },
                    { time: '10:15', errors: 12, latency: 1200 },
                    { time: '10:20', errors: 3, latency: 500 },
                  ]}>
                    <defs>
                      <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="#888888" fontSize={12} />
                    <YAxis stroke="#888888" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="errors" stroke="#ef4444" fillOpacity={1} fill="url(#colorErrors)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" /> Trace de Erro / Payload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-black/40 text-xs font-mono overflow-auto max-h-[300px] border border-white/5 text-green-400">
                {JSON.stringify(incident.metadata || incident.payload || { info: "Sem payload disponível" }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/10 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Propriedades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PropertyRow icon={<Clock />} label="Detectado em" value={new Date(incident.created_at).toLocaleString()} />
              <PropertyRow icon={<MapPin />} label="Origem" value={incident.source || "System Agent"} />
              <PropertyRow icon={<Cpu />} label="Infraestrutura" value="Lovable Cloud / Supabase" />
              <PropertyRow icon={<Activity />} label="Ocorrências" value={incident.occurrence_count || 1} />
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-500">
                <Zap className="h-4 w-4" /> Plano de Recuperação
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-200">
                <strong>Ação imediata:</strong> Verificar logs de implantação da Edge Function "{incident.source}"
              </div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Reiniciar pooling de conexões</li>
                <li>Validar segredos de API</li>
                <li>Escalar réplicas de leitura se necessário</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PropertyRow({ icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-primary">{icon && React.cloneElement(icon, { size: 16 })}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
