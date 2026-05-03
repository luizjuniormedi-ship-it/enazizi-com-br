import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, Sparkles, RefreshCw, AlertTriangle, Clock, 
  Database, Zap, BrainCircuit, CheckCircle2, XCircle,
  BarChart3, History, ShieldCheck, Microscope
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const TutorLessonStructureDashboard = () => {
  const queryClient = useQueryClient();
  const [isHealthchecking, setIsHealthchecking] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ["admin-tutor-lessons-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .order("last_structuring_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["admin-tutor-lesson-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_lesson_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    if (!lessons) return null;
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const structured = lessons.filter(l => l.status !== "pending" && l.status !== "structuring" && l.status !== "needs_adjustment");
    const structuring = lessons.filter(l => l.status === "structuring");
    const stuck = lessons.filter(l => l.status === "structuring" && l.last_structuring_at && l.last_structuring_at < fifteenMinsAgo);
    const withErrors = lessons.filter(l => !!l.last_structuring_error || l.status === "needs_adjustment");
    
    // Calculate avg duration from metadata
    let totalMs = 0;
    let countWithDuration = 0;
    let lastModel = "N/A";
    let fallbackCount = 0;

    lessons.forEach(l => {
      const meta = (l.metadata as any) || {};
      if (meta.duration_ms) {
        totalMs += meta.duration_ms;
        countWithDuration++;
      }
      if (meta.model_used) lastModel = meta.model_used;
      if (meta.fallback_used) fallbackCount++;
    });

    return {
      total: lessons.length,
      structuredCount: structured.length,
      structuringCount: structuring.length,
      stuckCount: stuck.length,
      errorCount: withErrors.length,
      avgDurationMs: countWithDuration > 0 ? totalMs / countWithDuration : 0,
      lastModel,
      fallbackRate: lessons.length > 0 ? (fallbackCount / lessons.length) * 100 : 0,
      avgAttempts: lessons.length > 0 ? lessons.reduce((acc, l) => acc + (l.structuring_attempts || 0), 0) / lessons.length : 0
    };
  }, [lessons]);

  const handleHealthcheck = async () => {
    setIsHealthchecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("tutor-lesson-structure", {
        body: { action: "healthcheck" },
      });
      if (error) throw error;
      if (data.ok) {
        toast.success("Healthcheck IA: OK", {
          description: "Sistemas operacionais e latência normal.",
        });
      } else {
        toast.error("Healthcheck IA: Alerta", {
          description: data.checks?.map((c: any) => `${c.name}: ${c.ok ? "OK" : "Erro"}`).join(", "),
        });
      }
    } catch (e: any) {
      toast.error(`Falha crítica no Healthcheck: ${e.message}`);
    } finally {
      setIsHealthchecking(false);
    }
  };

  const handleReprocessFailures = async () => {
    if (!lessons) return;
    setReprocessing(true);
    const failures = lessons.filter(l => {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      return (l.status === "structuring" && l.last_structuring_at && l.last_structuring_at < fifteenMinsAgo) ||
             !!l.last_structuring_error ||
             l.status === "needs_adjustment";
    });

    if (failures.length === 0) {
      toast.info("Nenhuma falha para reprocessar.");
      setReprocessing(false);
      return;
    }

    toast.info(`Iniciando recuperação de ${failures.length} aulas...`);
    
    for (const f of failures) {
      try {
        const eventType = f.status === "structuring" ? "lesson_structuring_recovered" : "lesson_structuring_retry";
        
        await supabase.from("tutor_lesson_events").insert({
          lesson_id: f.id,
          event_type: eventType,
          metadata: { reason: "manual_reprocess", prev_status: f.status }
        });

        await supabase.functions.invoke("tutor-lesson-structure", { body: { lesson_id: f.id } });
      } catch (e) {
        console.error("Erro reprocessando:", f.id, e);
      }
    }
    
    toast.success("Ciclo de recuperação finalizado.");
    queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons-stats"] });
    setReprocessing(false);
  };

  const handleResetStuck = async () => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("tutor_lesson_memory")
      .update({ status: "needs_adjustment", last_structuring_error: "Timeout reset manual" })
      .eq("status", "structuring")
      .lt("last_structuring_at", fifteenMinsAgo);
    
    if (error) toast.error(error.message);
    else {
      toast.success("Aulas travadas resetadas.");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons-stats"] });
    }
  };

  if (lessonsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Activity className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-violet-400" />
            Testes de Estruturação IA
          </h2>
          <p className="text-white/50 text-xs">Monitoramento de resiliência e auditoria de modelos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleHealthcheck} disabled={isHealthchecking} className="bg-white/5 border-white/10 text-xs gap-2">
            {isHealthchecking ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3 text-emerald-400" />}
            Healthcheck IA
          </Button>
          <Button variant="outline" size="sm" onClick={handleReprocessFailures} disabled={reprocessing} className="bg-rose-500/10 border-rose-500/20 text-rose-300 text-xs gap-2">
            <RefreshCw className={`h-3 w-3 ${reprocessing ? 'animate-spin' : ''}`} />
            Reprocessar Falhas
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetStuck} className="bg-amber-500/10 border-amber-500/20 text-amber-300 text-xs gap-2">
            <XCircle className="h-3 w-3" />
            Resetar Travadas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Status de Memória</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-white">{stats?.structuredCount}</span>
              <span className="text-[10px] text-emerald-400 font-bold">ESTRUTURADAS</span>
            </div>
            <Progress value={((stats?.structuredCount || 0) / (stats?.total || 1)) * 100} className="h-1 bg-white/5" />
            <p className="text-[10px] text-white/30">Total de {stats?.total} aulas cadastradas.</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Saúde do Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-amber-400">{stats?.structuringCount}</span>
              <span className="text-[10px] text-amber-400 font-bold">EM CURSO</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <AlertTriangle className="h-3 w-3 text-rose-500" />
              <span className="text-rose-400 font-bold">{stats?.stuckCount} travadas</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">{stats?.errorCount} com erro</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Performance IA</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-violet-400">{(stats?.avgDurationMs || 0 / 1000).toFixed(1)}s</span>
              <span className="text-[10px] text-violet-400 font-bold">TEMPO MÉDIO</span>
            </div>
            <p className="text-[10px] text-white/40 flex items-center gap-1">
              <Database className="h-3 w-3" /> Modelo: {stats?.lastModel}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Resiliência (Fallback)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-blue-400">{stats?.fallbackRate.toFixed(1)}%</span>
              <span className="text-[10px] text-blue-400 font-bold">TAXA FALLBACK</span>
            </div>
            <p className="text-[10px] text-white/40">Média de {stats?.avgAttempts.toFixed(1)} tentativas p/ aula.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Microscope className="h-4 w-4 text-violet-400" />
                Aulas Críticas (Atenção Necessária)
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-white/40 uppercase text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Tema / Aula</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Tentativas</th>
                    <th className="px-4 py-3 text-left">Erro</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lessons?.filter(l => l.status === "structuring" || l.status === "needs_adjustment").slice(0, 10).map(l => (
                    <tr key={l.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{l.topic}</div>
                        <div className="text-[10px] text-white/30 truncate max-w-[200px]">{l.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[9px] ${l.status === 'structuring' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {l.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-white/60">{l.structuring_attempts || 0}</td>
                      <td className="px-4 py-3 text-rose-400/80 max-w-[150px] truncate">{l.last_structuring_error || "---"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white" onClick={() => {
                           toast.info("Reprocessando aula...");
                           supabase.functions.invoke("tutor-lesson-structure", { body: { lesson_id: l.id } })
                            .then(() => { toast.success("Processado"); queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons-stats"] }); })
                            .catch(e => toast.error(e.message));
                        }}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!lessons || lessons.filter(l => l.status === "structuring" || l.status === "needs_adjustment").length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-white/20 italic">
                        Nenhuma aula com problema crítico detectada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-blue-400" />
                Live Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {events?.map(ev => (
                  <div key={ev.id} className="p-3 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-blue-300">{ev.event_type.replace(/_/g, ' ')}</span>
                      <span className="text-[9px] text-white/20">{formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      Lesson: {ev.lesson_id.slice(0, 8)}...
                    </div>
                    {ev.metadata && (
                      <div className="bg-black/20 rounded p-1.5 text-[9px] text-white/40 font-mono overflow-hidden">
                        {JSON.stringify(ev.metadata).slice(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
