import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, 
  Search, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ExternalLink,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const OfficialExamIngestion = () => {
  const qc = useQueryClient();
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["official-exam-sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("official_exam_sources").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ["ingestion-pipeline-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingestion_pipeline_runs")
        .select(`
          *,
          source:source_id (name)
        `)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  });

  const runMutation = useMutation({
    mutationFn: async ({ action, sourceId }: { action: string, sourceId: string }) => {
      setRunningAction(`${action}-${sourceId}`);
      const { data, error } = await supabase.functions.invoke('official-exam-ingestion', {
        body: { action, source_id: sourceId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Pipeline iniciado com sucesso!");
      qc.invalidateQueries({ queryKey: ["ingestion-pipeline-runs"] });
      setRunningAction(null);
    },
    onError: (error: any) => {
      toast.error("Falha ao iniciar pipeline: " + error.message);
      setRunningAction(null);
    }
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Ingestão de Provas</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Database className="h-4 w-4" /> Governança e Ingestão Automática de Provas Oficiais
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
          <RefreshCw className={cn("h-4 w-4 mr-2", runningAction && "animate-spin")} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Fontes de Provas Ativas
            </CardTitle>
            <CardDescription>
              Monitoramento de portais oficiais para descoberta de novos editais e provas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSources ? (
                  <TableRow><TableCell colSpan={3} className="text-center">Carregando fontes...</TableCell></TableRow>
                ) : (
                  sources?.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        <div className="font-medium">{source.name}</div>
                        <a href={source.url} target="_blank" className="text-[10px] text-muted-foreground flex items-center gap-1 hover:underline">
                          {source.url} <ExternalLink className="h-2 w-2" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.is_active ? "default" : "secondary"}>
                          {source.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-[10px]"
                          disabled={!!runningAction}
                          onClick={() => runMutation.mutate({ action: 'discover', sourceId: source.id })}
                        >
                          Discover
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 text-[10px]"
                          disabled={!!runningAction}
                          onClick={() => runMutation.mutate({ action: 'historical_harvest', sourceId: source.id })}
                        >
                          <Clock className="h-3 w-3 mr-1" /> Last 5 Years
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 text-[10px] bg-primary"
                          disabled={!!runningAction}
                          onClick={() => runMutation.mutate({ action: 'full_pipeline', sourceId: source.id })}
                        >
                          <Play className="h-3 w-3 mr-1" /> Full Ingest
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" /> Últimas Execuções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingRuns ? (
              <p className="text-center text-sm py-8">Carregando logs...</p>
            ) : (
              runs?.map((run) => (
                <div key={run.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase">{run.run_type}</span>
                    {run.status === 'success' ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
                      </Badge>
                    ) : run.status === 'running' ? (
                      <Badge className="bg-blue-500/10 text-blue-600 animate-pulse">Processando</Badge>
                    ) : (
                      <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fonte: {run.source?.name || 'Geral'}
                  </div>
                  <div className="text-[10px] text-muted-foreground italic">
                    {new Date(run.started_at).toLocaleString()}
                  </div>
                  {run.stats && Object.keys(run.stats).length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-[10px] font-mono whitespace-pre-wrap truncate">
                        {JSON.stringify(run.stats, null, 2)}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OfficialExamIngestion;
