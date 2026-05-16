import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, XCircle, Clock, Zap, Activity, Eye, EyeOff, Play, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import AlertActions from "./pipeline/AlertActions";
import { Search } from "lucide-react";

interface PipelineRun {
  id: string;
  run_type: string;
  status: string;
  target_assets: number;
  processed_assets: number;
  generated_questions: number;
  failed_assets: number;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
}

interface PipelineAlert {
  id: string;
  run_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  details: any;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", label: "Concluído" },
  partial: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "bg-amber-500/15 text-amber-700 border-amber-500/30", label: "Parcial" },
  failed: { icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-red-500/15 text-red-700 border-red-500/30", label: "Falhou" },
  running: { icon: <Activity className="h-3.5 w-3.5 animate-pulse" />, color: "bg-blue-500/15 text-blue-700 border-blue-500/30", label: "Executando" },
};

const severityConfig: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

const alertTypeLabels: Record<string, string> = {
  run_failed: "Run Falhou",
  run_sterile: "Run Estéril",
  partial_failure: "Falha Parcial",
};

export default function AdminPipelineMonitor() {
  const queryClient = useQueryClient();
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedType, setSelectedType] = useState("ecg");
  const [selectedCurationType, setSelectedCurationType] = useState("ecg");

  const runPipelineMutation = useMutation({
    mutationFn: async (datasetType: string) => {
      const { data, error } = await supabase.functions.invoke("run-pipeline", {
        body: { dataset_type: datasetType, mode: "questions_only", batch_size: 10 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-runs"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-alerts"] });
      toast.success(`Pipeline concluído: ${data?.questions_generated || 0} questões geradas, ${data?.items_processed || 0} assets processados`);
    },
    onError: (err: any) => {
      toast.error(`Erro no pipeline: ${err.message || "Erro desconhecido"}`);
    },
  });

  const curateMutation = useMutation({
    mutationFn: async (imageType: string) => {
      const { data, error } = await supabase.functions.invoke("auto-curate-assets", {
        body: { image_type: imageType, max_per_query: 5 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Curadoria concluída: ${data?.total_registered || 0} novos assets registrados para ${data?.image_type}`);
    },
    onError: (err: any) => {
      toast.error(`Erro na curadoria: ${err.message || "Erro desconhecido"}`);
    },
  });

  const { data: runs } = useQuery<PipelineRun[]>({
    queryKey: ["pipeline-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("question_generation_runs" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(15);
      return (data as any) || [];
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const { data: alerts } = useQuery<PipelineAlert[]>({
    queryKey: ["pipeline-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_alerts" as any)
        .select("*")
        .or(`acknowledged.eq.false,created_at.gt.${new Date(Date.now() - 7 * 86400000).toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data as any) || [];
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const ackMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || "admin";
      const { error } = await supabase
        .from("pipeline_alerts" as any)
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: email,
        } as any)
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-alerts"] });
      toast.success("Alerta reconhecido");
    },
  });

  const newAlerts = alerts?.filter(a => !a.acknowledged) || [];
  const ackedAlerts = alerts?.filter(a => a.acknowledged) || [];

  return (
    <div className="space-y-4">
      {/* New Alerts */}
      {newAlerts.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas Novos
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{newAlerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newAlerts.map(alert => (
              <div key={alert.id} className="p-2 rounded-lg bg-destructive/5 text-xs">
                <div className="flex items-start gap-2">
                  <Badge className={`${severityConfig[alert.severity] || severityConfig.info} text-[10px] shrink-0`}>
                    {alertTypeLabels[alert.alert_type] || alert.alert_type}
                  </Badge>
                  <span className="text-muted-foreground flex-1">{alert.message}</span>
                  <span className="text-muted-foreground/60 shrink-0 text-[10px]">
                    {formatDistanceToNow(new Date(alert.created_at!), { addSuffix: true, locale: ptBR })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 shrink-0"
                    onClick={() => ackMutation.mutate(alert.id)}
                    disabled={ackMutation.isPending}
                    title="Reconhecer"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
                <AlertActions alertType={alert.alert_type} runId={alert.run_id} details={alert.details} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Acknowledged Alerts */}
      {ackedAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Alertas Reconhecidos
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{ackedAlerts.length}</Badge>
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowAcknowledged(!showAcknowledged)}>
                {showAcknowledged ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showAcknowledged ? "Ocultar" : "Mostrar"}
              </Button>
            </CardTitle>
          </CardHeader>
          {showAcknowledged && (
            <CardContent className="space-y-1.5">
              {ackedAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs opacity-70">
                  <Badge className={`${severityConfig[alert.severity] || severityConfig.info} text-[10px] shrink-0`}>
                    {alertTypeLabels[alert.alert_type] || alert.alert_type}
                  </Badge>
                  <span className="text-muted-foreground flex-1">{alert.message}</span>
                  <span className="text-muted-foreground/60 shrink-0 text-[10px]">
                    {alert.acknowledged_by && `${alert.acknowledged_by.split("@")[0]} · `}
                    {alert.acknowledged_at && formatDistanceToNow(new Date(alert.acknowledged_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Pipeline Trigger */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-600" />
            Disparar Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ecg">❤️ ECG</SelectItem>
                <SelectItem value="xray">🫁 Raio-X</SelectItem>
                <SelectItem value="dermatology">🩹 Dermato</SelectItem>
                <SelectItem value="ct">🧠 TC</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => runPipelineMutation.mutate(selectedType)}
              disabled={runPipelineMutation.isPending}
            >
              {runPipelineMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {runPipelineMutation.isPending ? "Executando..." : "Executar Pipeline"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Gera questões para assets pendentes (batch de 10). Modo: questions_only.
          </p>
        </CardContent>
      </Card>

      {/* Auto-Curation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Curadoria Automática (Open-i / NIH)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={selectedCurationType} onValueChange={setSelectedCurationType}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ecg">❤️ ECG</SelectItem>
                <SelectItem value="xray">🫁 Raio-X</SelectItem>
                <SelectItem value="dermatology">🩹 Dermato</SelectItem>
                <SelectItem value="ct">🧠 TC</SelectItem>
                <SelectItem value="ophthalmology">👁️ Oftalmo</SelectItem>
                <SelectItem value="us">📡 US</SelectItem>
                <SelectItem value="pathology">🔬 Patologia</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              variant="outline"
              onClick={() => curateMutation.mutate(selectedCurationType)}
              disabled={curateMutation.isPending}
            >
              {curateMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              {curateMutation.isPending ? "Buscando..." : "Buscar Imagens"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Busca imagens open-access no Open-i (NIH) e registra como assets pendentes. Após registrar, execute o Pipeline para gerar questões.
          </p>
        </CardContent>
      </Card>

      {/* Runs History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Últimas Execuções do Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!runs || runs.length === 0) ? (
            <p className="text-xs text-muted-foreground">Nenhuma execução registrada.</p>
          ) : (
            <div className="space-y-1.5">
              {runs.map(run => {
                const cfg = statusConfig[run.status] || statusConfig.failed;
                const duration = run.finished_at && run.started_at
                  ? Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                  : null;

                return (
                  <div key={run.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                    <Badge className={`${cfg.color} text-[10px] gap-1 shrink-0`}>
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(run.started_at), "dd/MM HH:mm")}
                    </span>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-medium text-foreground">{run.generated_questions}q</span>
                      {run.failed_assets > 0 && (
                        <span className="text-destructive">{run.failed_assets} falha(s)</span>
                      )}
                      <span className="text-muted-foreground/60">{run.processed_assets}/{run.target_assets} assets</span>
                    </div>
                    {duration !== null && (
                      <span className="text-muted-foreground/60 shrink-0 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {duration}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
