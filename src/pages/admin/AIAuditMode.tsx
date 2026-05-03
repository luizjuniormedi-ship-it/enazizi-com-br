import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Search, 
  Clock, 
  AlertCircle, 
  FileJson, 
  Database, 
  ChevronRight, 
  Eye, 
  History,
  FileText,
  DollarSign,
  Zap
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AIAuditMode() {
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_prompt_execution_logs")
        .select(`
          *,
          master_content_library (
            title,
            discipline,
            topic,
            revision_history
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-500/10 text-green-500">Sucesso</Badge>;
      case "failed": return <Badge variant="destructive">Falha</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getValidationBadge = (status: string) => {
    switch (status) {
      case "valid": return <Badge variant="outline" className="text-blue-500">Válido</Badge>;
      case "repaired": return <Badge variant="outline" className="text-amber-500">Reparado</Badge>;
      default: return <Badge variant="outline" className="text-red-500">Inválido</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modo Auditoria IA</h1>
          <p className="text-muted-foreground">Rastreabilidade completa, custos e latência de geração.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latência Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs?.length ? (logs.reduce((acc, log) => acc + (log.latency_ms || 0), 0) / logs.length / 1000).toFixed(2) : 0}s
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo Total (Auditado)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${logs?.reduce((acc, log) => acc + (Number(log.estimated_cost) || 0), 0).toFixed(4)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs?.length ? ((logs.filter(l => l.cache_status !== 'cache_miss').length / logs.length) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Falhas Críticas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {logs?.filter(l => l.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Modelo / Prompt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>JSON</TableHead>
                <TableHead>Cache</TableHead>
                <TableHead>Latência</TableHead>
                <TableHead className="text-right">Audit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{log.master_content_library?.title}</div>
                    <div className="text-[10px] text-muted-foreground">{log.master_content_library?.discipline}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{log.model}</div>
                    <div className="text-[10px] text-muted-foreground">v{log.prompt_version || '1.0'}</div>
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell>{getValidationBadge(log.json_validation_status)}</TableCell>
                  <TableCell>
                    <Badge variant={log.cache_status === 'cache_miss' ? "outline" : "secondary"} className="text-[10px]">
                      {log.cache_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {(log.latency_ms / 1000).toFixed(1)}s
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle>Auditoria Técnica: {log.master_content_library?.title}</DialogTitle>
                          <DialogDescription>
                            Detalhes de execução v{log.prompt_version} do motor OpenAI.
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="mt-4 h-[600px] p-4 bg-muted/50 rounded-lg">
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <h4 className="font-bold mb-2">Metadata de Geração</h4>
                                <ul className="space-y-1 opacity-80">
                                  <li>ID Log: {log.id}</li>
                                  <li>Tokens Entrada: {log.input_tokens}</li>
                                  <li>Tokens Saída: {log.output_tokens}</li>
                                  <li>Custo Estimado: ${log.estimated_cost}</li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-bold mb-2">Contexto Pedagógico</h4>
                                <ul className="space-y-1 opacity-80">
                                  <li>Disciplina: {log.master_content_library?.discipline}</li>
                                  <li>Tópico: {log.master_content_library?.topic}</li>
                                  <li>ID Conteúdo: {log.content_id}</li>
                                </ul>
                              </div>
                            </div>
                            
                            {log.error_message && (
                              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <h4 className="font-bold text-destructive text-sm flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" /> Erro Registrado
                                </h4>
                                <p className="text-xs mt-1 text-destructive/80 font-mono">{log.error_message}</p>
                              </div>
                            )}

                            <div>
                              <h4 className="font-bold mb-2 text-sm">Histórico de Revisão Médico-Pedagógica</h4>
                              <div className="space-y-2">
                                {Array.isArray(log.master_content_library?.revision_history) && 
                                 log.master_content_library.revision_history.map((rev: any, i: number) => (
                                  <div key={i} className="p-2 border rounded-md bg-background text-xs">
                                    <div className="flex justify-between font-medium">
                                      <span>{rev.reviewer || 'IA System'}</span>
                                      <span>{rev.date}</span>
                                    </div>
                                    <p className="mt-1 opacity-70">{rev.comment}</p>
                                  </div>
                                ))}
                                {(!Array.isArray(log.master_content_library?.revision_history) || 
                                  log.master_content_library.revision_history.length === 0) && (
                                  <p className="text-xs text-muted-foreground italic">Nenhuma revisão manual registrada ainda.</p>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-bold mb-2 text-sm">Estrutura JSON Validada</h4>
                              <pre className="text-[10px] p-3 bg-black/90 text-green-400 rounded-md overflow-x-auto">
                                {JSON.stringify({
                                  validation: log.json_validation_status,
                                  model: log.model,
                                  version: log.prompt_version
                                }, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
