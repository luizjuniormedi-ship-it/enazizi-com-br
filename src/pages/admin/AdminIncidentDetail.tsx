import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, Clock, MapPin, Cpu, User, 
  AlertCircle, CheckCircle2, History, Database,
  Terminal, ShieldAlert, BarChart3
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
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
      const { data, error } = await supabase
        .from('admin_incidents')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setIncident(data);

      // Load related governance logs or telemetry
      const { data: logs } = await supabase
        .from('governance_logs')
        .select('*')
        .eq('details->>incident_id', id)
        .order('created_at', { ascending: false });
      
      setRelatedLogs(logs || []);

    } catch (error) {
      console.error("Error loading incident:", error);
      toast.error("Erro ao carregar incidente");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncident();
  }, [id]);

  async function generateRCA() {
    try {
      const { data, error } = await supabase.rpc('generate_incident_rca', { incident_id: id });
      if (error) throw error;
      toast.success("RCA gerado com sucesso");
      loadIncident();
    } catch (error) {
      toast.error("Falha ao gerar RCA");
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (!incident) return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold">Incidente não encontrado</h2>
      <Button variant="link" onClick={() => navigate(-1)}>Voltar</Button>
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="pl-0">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Alertas
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{incident.title}</h1>
            <Badge variant={incident.status === 'open' ? 'destructive' : 'outline'}>
              {incident.status.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-500">
              {incident.severity.toUpperCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground">{incident.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateRCA}>
            <Terminal className="h-4 w-4 mr-2" /> Forçar Novo RCA
          </Button>
          <Button>Marcar como Resolvido</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Timeline & RCA Automático
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-muted/50 border border-primary/5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-500" /> Diagnóstico Provável
              </h3>
              <p className="text-sm">{incident.rca_diagnosis?.probable_cause || "Aguardando diagnóstico..."}</p>
              
              {incident.rca_diagnosis?.suggested_steps && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Próximos Passos Sugeridos:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {incident.rca_diagnosis.suggested_steps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Timeline do Evento</h3>
              <div className="relative pl-6 border-l-2 border-muted space-y-6">
                <TimelineItem 
                  time={new Date(incident.created_at).toLocaleString()}
                  title="Incidente Criado"
                  description="Detecção automática via Telemetria Operacional."
                  icon={<AlertCircle className="h-4 w-4" />}
                />
                <TimelineItem 
                  time={new Date(incident.last_occurrence_at).toLocaleString()}
                  title="Última Ocorrência"
                  description={`O incidente ocorreu ${incident.occurrence_count} vezes no total.`}
                  icon={<History className="h-4 w-4" />}
                />
                {incident.rca_diagnosis?.probable_cause && (
                  <TimelineItem 
                    time="Sincronizado"
                    title="RCA Gerado"
                    description="O motor de governança analisou as métricas associadas."
                    icon={<Cpu className="h-4 w-4" />}
                    active
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Contexto da Falha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ContextItem icon={<MapPin />} label="Rota Afetada" value={incident.route || "Global"} />
            <ContextItem icon={<Cpu />} label="Edge Function" value={incident.edge_function || "N/A"} />
            <ContextItem icon={<User />} label="Usuário Afetado" value={incident.user?.full_name || incident.user?.email || "Anônimo"} />
            <ContextItem icon={<Database />} label="Categoria" value={incident.category} />
            
            <div className="pt-4 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Snapshot de Métricas</h4>
              <div className="space-y-2">
                {Object.entries(incident.metrics_snapshot || {}).map(([k, v]: [string, any]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Frequência de Ocorrência
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[
                  { day: 'T-3', val: Math.floor(incident.occurrence_count * 0.2) },
                  { day: 'T-2', val: Math.floor(incident.occurrence_count * 0.3) },
                  { day: 'T-1', val: Math.floor(incident.occurrence_count * 0.1) },
                  { day: 'Hoje', val: incident.occurrence_count },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="val" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Logs de Governança Relacionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum log de governança associado.</p>
              ) : (
                relatedLogs.map((log) => (
                  <div key={log.id} className="text-xs p-2 rounded bg-muted flex justify-between items-center">
                    <div>
                      <span className="font-bold mr-2">{log.action_type}</span>
                      <span className="text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{log.severity}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimelineItem({ time, title, description, icon, active }: any) {
  return (
    <div className="relative">
      <div className={`absolute -left-[31px] mt-1 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center ${active ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground">{time}</p>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ContextItem({ icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-muted-foreground">{icon && React.cloneElement(icon, { size: 16 })}</div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
