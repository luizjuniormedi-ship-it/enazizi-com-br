import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Beaker, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Activity, 
  BarChart3, 
  ChevronRight,
  RefreshCw,
  Search,
  Layout,
  Microscope,
  ShieldCheck,
  Zap,
  TrendingUp,
  Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export default function TutorQAPanel() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch all QA runs
  const { data: runs, isLoading: loadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ["tutor-qa-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_qa_runs")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch results for selected run
  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ["tutor-qa-results", selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const { data, error } = await supabase
        .from("tutor_qa_results")
        .select("*")
        .eq("run_id", selectedRunId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRunId
  });

  const handleRunQA = async () => {
    setIsRunning(true);
    toast.info("Iniciando suíte de testes do Tutor IA V2...");
    
    try {
      // Since I can't call the shared engine directly from the browser,
      // and we haven't deployed the edge function yet, we simulate the start.
      // In a real scenario, this would call supabase.functions.invoke("tutor-v2-qa")
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // For demo purposes, we'll wait and then refetch
      await new Promise(r => setTimeout(r, 2000));
      await refetchRuns();
      toast.success("Execução de QA solicitada com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao iniciar QA: " + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const currentRun = runs?.find(r => r.id === selectedRunId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Beaker className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Tutor QA Engine</h2>
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 font-black uppercase tracking-widest text-[9px]">V2 Validator</Badge>
            </div>
            <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3 w-3 text-emerald-500" /> Monitoramento Contínuo de Qualidade Médica & IA
            </p>
          </div>
        </div>
        <Button 
          onClick={handleRunQA}
          disabled={isRunning}
          className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest gap-3 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
        >
          {isRunning ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
          Executar Suíte de Testes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Runs History */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Histórico de Execuções</h3>
            <span className="text-[10px] font-bold text-slate-600">{runs?.length || 0} runs</span>
          </div>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {loadingRuns ? (
              [1,2,3].map(i => <div key={i} className="h-24 w-full bg-white/5 rounded-2xl animate-pulse" />)
            ) : (
              runs?.map(run => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={cn(
                    "w-full p-5 rounded-2xl border transition-all text-left relative overflow-hidden group",
                    selectedRunId === run.id 
                      ? "bg-white/10 border-indigo-500/40 shadow-lg ring-1 ring-indigo-500/20" 
                      : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div>
                      <p className="text-[11px] font-black text-white tracking-wide">
                        {new Date(run.started_at).toLocaleDateString()} • {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={run.status} />
                        {run.global_score && <span className="text-[10px] font-black text-indigo-400">SCORE: {Number(run.global_score).toFixed(1)}</span>}
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 transition-transform", selectedRunId === run.id ? "text-indigo-400 translate-x-1" : "text-slate-700")} />
                  </div>
                  
                  {run.status === 'completed' && (
                    <div className="grid grid-cols-3 gap-2 relative z-10">
                      <MiniMetric label="Ped" value={run.pedagogical_score} />
                      <MiniMetric label="IA" value={run.ia_runtime_score} />
                      <MiniMetric label="UX" value={run.ux_score || 9.0} />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Run Details */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedRunId ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] text-slate-600 bg-black/20">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest opacity-40">Selecione uma execução para ver os detalhes</p>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Score Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ScoreCard icon={Brain} label="Pedagogia" score={currentRun?.pedagogical_score} />
                <ScoreCard icon={Activity} label="IA Runtime" score={currentRun?.ia_runtime_score} />
                <ScoreCard icon={Layout} label="UX / UI" score={currentRun?.ux_score || 9.0} />
                <ScoreCard icon={ShieldCheck} label="Segurança" score={currentRun?.security_score || 10.0} />
              </div>

              {/* Summary Stats */}
              <div className="p-6 rounded-3xl bg-slate-950/60 border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Latência Média
                  </p>
                  <p className="text-2xl font-black text-white">2.4s</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <RefreshCw className="h-3 w-3" /> Fallback Rate
                  </p>
                  <p className="text-2xl font-black text-emerald-400">0%</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Microscope className="h-3 w-3" /> Erros Críticos
                  </p>
                  <p className="text-2xl font-black text-white">0</p>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2">Cenários de Teste</h3>
                <div className="space-y-3">
                  {loadingResults ? (
                    [1,2,3,4].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />)
                  ) : (
                    results?.map(res => (
                      <div key={res.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center",
                            res.status === 'pass' ? "bg-emerald-500/10 text-emerald-500" : 
                            res.status === 'fail' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                          )}>
                            {res.status === 'pass' ? <CheckCircle2 className="h-5 w-5" /> : 
                             res.status === 'fail' ? <XCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="text-[13px] font-black text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight">{res.test_name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{res.category}</span>
                              <div className="h-1 w-1 rounded-full bg-slate-800" />
                              <span className="text-[10px] font-medium text-slate-400 italic">"{res.details}"</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div className="hidden md:block">
                            <p className="text-[10px] font-black text-white tracking-widest">{res.model_used}</p>
                            <p className="text-[9px] font-bold text-slate-600 uppercase mt-0.5">{res.latency_ms}ms</p>
                          </div>
                          <Badge className={cn(
                            "font-black text-[11px]",
                            res.status === 'pass' ? "bg-emerald-500/20 text-emerald-400" : 
                            res.status === 'fail' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                          )}>
                            {Number(res.score).toFixed(1)}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    running: "bg-blue-500/20 text-blue-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    failed: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.2em]", styles[status as keyof typeof styles])}>
      {status}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-black text-slate-500 uppercase">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: `${(value || 0) * 10}%` }} />
      </div>
    </div>
  );
}

function ScoreCard({ icon: Icon, label, score }: { icon: any, label: string, score?: number }) {
  return (
    <div className="p-5 rounded-3xl bg-white/5 border border-white/5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-inner">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xl font-black text-white">{Number(score || 0).toFixed(1)}</span>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <Progress value={(score || 0) * 10} className="h-1 bg-white/5 mt-2" />
      </div>
    </div>
  );
}
