import { useState, useEffect } from "react";
import { 
  Search, Download, FileText, Database, AlertCircle, 
  CheckCircle2, Clock, Play, RefreshCw, BarChart3, 
  Settings, Layers, ExternalLink, Filter, ChevronRight,
  ShieldCheck, Info, Bug, History, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";

export const ExamHarvesterPanel = () => {
  const { toast } = useToast();
  const [sources, setSources] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [sourcesRes, filesRes, logsRes, telemetryRes] = await Promise.all([
        supabase.from('official_exam_sources').select('*').order('name'),
        supabase.from('official_exam_files').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('official_exam_ingestion_logs').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('official_exam_telemetry').select('*').order('created_at', { ascending: false }).limit(10)
      ]);

      if (sourcesRes.data) setSources(sourcesRes.data);
      if (filesRes.data) setFiles(filesRes.data);
      if (logsRes.data) setLogs(logsRes.data);
      if (telemetryRes.data) setTelemetry(telemetryRes.data);
    } catch (error) {
      console.error("Error loading harvester data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setProcessingId('scanning');
    try {
      const { data, error } = await supabase.functions.invoke('scan-official-exams');
      if (error) throw error;
      toast({
        title: "Scan Iniciado",
        description: `Encontradas ${data.results?.length || 0} novas referências.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro no Scan",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownload = async (fileId: string) => {
    setProcessingId(fileId);
    try {
      const { data, error } = await supabase.functions.invoke('download-official-pdf', {
        body: { fileId }
      });
      if (error) throw error;
      toast({
        title: "Download Concluído",
        description: `Arquivo salvo em: ${data.storagePath}`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro no Download",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleExtract = async (fileId: string) => {
    setProcessingId(fileId);
    try {
      const { data, error } = await supabase.functions.invoke('extract-official-questions', {
        body: { fileId }
      });
      if (error) throw error;
      toast({
        title: "Extração Concluída",
        description: `Extraídas ${data.questions_extracted} questões premium.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro na Extração",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <Search className="w-8 h-8 text-blue-500" />
            Official Exam Harvester
          </h2>
          <p className="text-muted-foreground mt-1">
            Monitoramento em tempo real do pipeline de ingestão de provas oficiais 2026.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={loadData}
            disabled={loading}
            className="border-blue-500/30 hover:bg-blue-500/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleScan}
            disabled={processingId === 'scanning'}
            className="bg-blue-600 hover:bg-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
          >
            {processingId === 'scanning' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Executar Scan Diário
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-blue-500/20 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Fontes Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-100">{sources.length}</div>
            <p className="text-xs text-muted-foreground">+2 adicionadas hoje</p>
          </CardContent>
        </Card>
        
        <Card className="bg-black/40 border-indigo-500/20 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Arquivos Processados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-100">{files.filter(f => f.status === 'processed').length}</div>
            <p className="text-xs text-muted-foreground">Última extração há 1h</p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-emerald-500/20 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Taxa de Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-100">98.5%</div>
            <Progress value={98.5} className="h-1 mt-2 bg-emerald-950" />
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-amber-500/20 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              Uptime Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-100">24/7</div>
            <p className="text-xs text-muted-foreground text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Monitoramento Ativo
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="files" className="w-full">
        <TabsList className="bg-black/60 border border-white/10 p-1">
          <TabsTrigger value="files" className="data-[state=active]:bg-blue-600">Arquivos & Downloads</TabsTrigger>
          <TabsTrigger value="sources" className="data-[state=active]:bg-blue-600">Fontes Oficiais</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600">Logs de Ingestão</TabsTrigger>
          <TabsTrigger value="telemetry" className="data-[state=active]:bg-blue-600">Telemetria & IA</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="files" className="mt-4">
            <Card className="bg-black/60 border-white/5 backdrop-blur-md">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/10">
                    <TableHead className="text-blue-400">Instituição</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium text-white">{file.institution}</TableCell>
                      <TableCell>{file.year}</TableCell>
                      <TableCell className="text-muted-foreground text-xs truncate max-w-[200px]">
                        {file.file_name}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            file.status === 'processed' ? 'default' : 
                            file.status === 'downloaded' ? 'secondary' : 'outline'
                          }
                          className={cn(
                            file.status === 'processed' && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
                            file.status === 'discovered' && "border-blue-500/50 text-blue-400"
                          )}
                        >
                          {file.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {file.status === 'discovered' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleDownload(file.id)}
                              disabled={!!processingId}
                              className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          {(file.status === 'downloaded' || file.status === 'processed') && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleExtract(file.id)}
                              disabled={!!processingId}
                              className="h-8 px-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10"
                            >
                              <Layers className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="sources" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map((source) => (
                <Card key={source.id} className="bg-black/60 border-white/5 hover:border-blue-500/30 transition-all group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-bold group-hover:text-blue-400 transition-colors">
                        {source.name}
                      </CardTitle>
                      <Badge variant={source.is_active ? "default" : "outline"} className={source.is_active ? "bg-blue-600" : ""}>
                        {source.is_active ? "ATIVO" : "INATIVO"}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-1 truncate">
                      <ExternalLink className="w-3 h-3" />
                      {source.url}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2 mt-4">
                      <Button variant="secondary" size="sm" className="w-full text-xs">Editar Fonte</Button>
                      <Button variant="outline" size="sm" className="w-full text-xs">Forçar Scan</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card className="bg-black/60 border-white/5 backdrop-blur-md overflow-hidden">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 border-l-2 border-white/10 pl-4 py-1 hover:border-blue-500/50 transition-colors">
                      <div className="mt-1">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <p className="text-sm font-semibold text-white uppercase tracking-wider">{log.action}</p>
                          <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(log.details)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg 
    className={cn("animate-spin", className)} 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
