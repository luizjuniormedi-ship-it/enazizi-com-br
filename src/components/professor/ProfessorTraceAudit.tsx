import { useState } from "react";
import { Search, Loader2, AlertTriangle, CheckCircle, Clock, Info, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface TraceLog {
  id: string;
  step_name: string;
  status: string;
  payload: any;
  error_message: string;
  execution_time_ms: number;
  created_at: string;
}

interface Props {
  callAPI: (body: any) => Promise<any>;
}

const ProfessorTraceAudit = ({ callAPI }: Props) => {
  const [traceId, setTraceId] = useState("");
  const [logs, setLogs] = useState<TraceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    const trimmedId = traceId.trim();
    if (!trimmedId) return;
    
    setLoading(true);
    setLogs([]);
    try {
      // Basic UUID validation or short TRACE- prefix check
      if (trimmedId.length < 10) {
        toast({ title: "ID muito curto", description: "Por favor, use o Trace ID completo exibido no erro.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const res = await callAPI({ action: "get_trace_audit", trace_id: trimmedId });
      setLogs(res.logs || []);
      if (res.logs?.length === 0) {
        toast({ title: "Nenhum log encontrado", description: "Verifique se o ID está correto ou se a operação ainda está em andamento." });
      }
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-white/5 bg-card/20 backdrop-blur-md overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
          <History className="w-32 h-32" />
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Auditoria de Operações
          </CardTitle>
          <CardDescription>
            Busque pelo ID de rastreio (Trace ID) para ver os detalhes da execução técnica e diagnosticar falhas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Input 
                placeholder="Cole o Trace ID aqui..." 
                value={traceId}
                onChange={(e) => setTraceId(e.target.value)}
                className="font-mono text-xs h-11 bg-white/5 border-white/10 rounded-xl pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={loading} 
              className="h-11 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-glow-sm gap-2 whitespace-nowrap"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              BUSCAR RASTREIO
            </Button>
          </div>

          {logs.length > 0 ? (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Linha do Tempo de Execução</h3>
                <span className="text-[10px] opacity-40 font-mono">TRACE: {traceId.slice(0, 8)}...</span>
              </div>
              
              <div className="relative border-l-2 border-white/5 ml-3 pl-6 space-y-6 py-2">
                {logs.map((log) => (
                  <div key={log.id} className="relative group">
                    <div className="absolute -left-[31px] top-0 bg-background p-1 rounded-full border border-white/10 shadow-sm transition-transform group-hover:scale-110">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className={`
                      rounded-2xl border transition-all p-5 space-y-3
                      ${log.status === 'error' ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : 
                        log.status === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' : 
                        'bg-white/5 border-white/10'}
                    `}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-black text-[11px] uppercase tracking-wider">{log.step_name}</span>
                        <span className="text-[10px] opacity-40 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      
                      {log.execution_time_ms && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary/70">
                          <Clock className="h-3 w-3" /> {log.execution_time_ms}ms de execução
                        </div>
                      )}

                      {log.error_message && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 font-mono leading-relaxed">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{log.error_message}</span>
                          </div>
                        </div>
                      )}

                      {log.payload && (
                        <details className="group/payload">
                          <summary className="text-[10px] font-bold uppercase tracking-widest cursor-pointer opacity-40 hover:opacity-100 transition-opacity list-none flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            <span>Ver Detalhes do Payload</span>
                          </summary>
                          <div className="mt-3 p-3 bg-black/40 rounded-xl overflow-x-auto border border-white/5">
                            <pre className="text-[10px] font-mono leading-tight text-white/70">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading && traceId && (
            <div className="py-12 text-center opacity-30">
              <Search className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhum resultado para exibir</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessorTraceAudit;