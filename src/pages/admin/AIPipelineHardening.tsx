import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AI_MODELS } from "@/config/ai-models";

interface PipelineAlert {
  id: string;
  source: string;
  message: string;
  severity: string;
  model_used: string;
  http_status: number;
  created_at: string;
  acknowledged: boolean;
  error_stack?: string;
  payload?: any;
}

interface ProviderHealth {
  provider: string;
  model: string;
  status: string;
  latency_ms: number;
  checked_at: string;
  success_count: number;
  error_count: number;
}

export default function AIPipelineHardening() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<PipelineAlert[]>([]);
  const [health, setHealth] = useState<ProviderHealth[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: alertsData, error: alertsErr } = await supabase
        .from("pipeline_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: healthData, error: healthErr } = await supabase
        .from("ai_provider_health")
        .select("*")
        .order("latency_ms", { ascending: true });

      if (alertsErr) throw alertsErr;
      if (healthErr) throw healthErr;

      setAlerts((alertsData as any) || []);
      setHealth((healthData as any) || []);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar dados",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (id: string) => {
    const { error } = await supabase
      .from("pipeline_alerts")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao resolver", description: error.message, variant: "destructive" });
    } else {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
      toast({ title: "Alerta resolvido" });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive">CRÍTICO</Badge>;
      case "error": return <Badge className="bg-orange-500">ERRO</Badge>;
      case "warning": return <Badge variant="outline" className="text-orange-500 border-orange-500">AVISO</Badge>;
      default: return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  return (
    <div className="container py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            Hardening do Pipeline IA
          </h1>
          <p className="text-muted-foreground">Monitoramento de falhas silenciosas e saúde dos provedores.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alertas Não Resolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {alerts.filter(a => !a.acknowledged).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Modelo Padrão (Geração)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono truncate">{AI_MODELS.generation}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status do Gateway</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-bold text-green-600">ONLINE</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Erros nas Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => new Date(a.created_at).getTime() > Date.now() - 86400000).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alertas Recentes do Pipeline</CardTitle>
              <CardDescription>Rastreamento de erros 400, timeouts e problemas de modelo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum alerta registrado.</TableCell>
                    </TableRow>
                  ) : (
                    alerts.map((alert) => (
                      <TableRow key={alert.id} className={alert.acknowledged ? "opacity-50" : ""}>
                        <TableCell className="font-mono text-xs">{alert.source || "unknown"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-sm">{alert.message}</span>
                            <div className="flex gap-2 items-center">
                              {getSeverityBadge(alert.severity)}
                              {alert.http_status && (
                                <Badge variant="outline" className="w-fit">HTTP {alert.http_status}</Badge>
                              )}
                              {alert.model_used && (
                                <span className="text-[10px] text-muted-foreground font-mono">{alert.model_used}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           {alert.acknowledged ? <Badge variant="secondary">Resolvido</Badge> : <Badge variant="default">Pendente</Badge>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(alert.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {!alert.acknowledged && (
                            <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>Resolver</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                Saúde dos Provedores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {health.map((h, i) => (
                <div key={i} className="flex flex-col p-3 border rounded-lg gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm uppercase">{h.provider}</span>
                    <Badge variant={h.status === "healthy" ? "default" : "destructive"}>
                      {h.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{h.model}</div>
                  <div className="flex justify-between text-xs">
                    <span>Latência: {h.latency_ms}ms</span>
                    <span>Sucesso: {((h.success_count / (Math.max(1, h.success_count + h.error_count))) * 100 || 0).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
