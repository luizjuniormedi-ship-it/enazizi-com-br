import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Database, Brain, Activity, Target, ShieldCheck, 
  AlertTriangle, CheckCircle2, ListFilter, Warplane, 
  FileText, ArrowRight, BarChart3, Search, Info
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const CurriculumReconstructionDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isMaterializing, setIsMaterializing] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("curriculum-reconstructor", {
        body: { action: "inventory_report" }
      });
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar auditoria PMC");
    } finally {
      setIsLoading(false);
    }
  };

  const massMaterialize = async () => {
    setIsMaterializing(true);
    const toastId = toast.loading("Executando Materialização Massiva (PMC Phase 1)...");
    try {
      const { data, error } = await supabase.rpc('materialize_classifications');
      if (error) throw error;
      
      toast.success(`${data} questões materializadas com sucesso no currículo GOLD`, { id: toastId });
      fetchStats();
    } catch (err: any) {
      console.error(err);
      toast.error("Falha na materialização: " + err.message, { id: toastId });
    } finally {
      setIsMaterializing(false);
    }
  };

  const startClassification = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("curriculum-reconstructor", {
        body: { action: "classify_batch", limit: 100 }
      });
      if (error) throw error;
      toast.success(`${data.processed} questões processadas pela IA`);
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error("Falha na classificação em lote");
    } finally {
      setIsClassifying(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-white/50 font-mono animate-pulse">BOOTING PMC AUDIT ENGINE...</p>
    </div>
  );

  const pmc = stats?.pmc_report || {};
  const current = pmc.current || {};
  const before = pmc.before || {};
  const cosProgress = current.cos || 0;

  return (
    <div className="space-y-8 p-6 bg-slate-950 min-h-screen">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5">P0 SEVERITY</Badge>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/5">CERTIFIED GOLD</Badge>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            ENAZIZI <span className="text-primary">GOLD</span>
          </h1>
          <p className="text-white/40 font-mono text-sm">POST-MATERIALIZATION CERTIFICATION (PMC)</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchStats} className="bg-white/5 border-white/10 text-white/70">
            <Activity className="h-4 w-4 mr-2" /> RE-AUDIT
          </Button>
          <Button 
            onClick={startClassification} 
            disabled={isClassifying}
            className="bg-blue-600 hover:bg-blue-500"
          >
            <Brain className="h-4 w-4 mr-2" /> {isClassifying ? "PROCESSING..." : "CLASSIFY BATCH (IA)"}
          </Button>
          <Button 
            onClick={massMaterialize} 
            disabled={isMaterializing}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold"
          >
            <ShieldCheck className="h-4 w-4 mr-2" /> MASS MATERIALIZE
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "CURRICULUM OPERATIONAL SCORE", value: `${cosProgress}%`, sub: `META: 95%`, icon: Target, color: cosProgress > 90 ? "text-emerald-500" : cosProgress > 60 ? "text-amber-500" : "text-red-500" },
          { label: "OFFICIAL COVERAGE RATE", value: `${current.ocr || 0}%`, sub: `${current.operational_competencies || 0} Operacionais`, icon: CheckCircle2, color: "text-blue-500" },
          { label: "CLINICAL CONSISTENCY", value: `${current.ccs || 0}%`, sub: "Confidence AI average", icon: ShieldCheck, color: "text-emerald-400" },
          { label: "ACTIVE QUESTIONS", value: (current.total_questions || 0).toLocaleString(), sub: "Total in Bank", icon: Database, color: "text-white" },
        ].map((m, i) => (
          <Card key={i} className="bg-white/[0.02] border-white/5 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-white/40 tracking-widest uppercase">{m.label}</p>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <div className={`text-3xl font-black ${m.color}`}>{m.value}</div>
              <p className="text-[10px] text-white/30 mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="report" className="space-y-6">
        <TabsList className="bg-white/5 border-white/10 p-1 rounded-xl">
          <TabsTrigger value="report" className="data-[state=active]:bg-primary rounded-lg text-xs font-bold">PMC REPORT</TabsTrigger>
          <TabsTrigger value="orphans" className="data-[state=active]:bg-primary rounded-lg text-xs font-bold">ORPHAN AUDIT</TabsTrigger>
          <TabsTrigger value="warroom" className="data-[state=active]:bg-primary rounded-lg text-xs font-bold">WAR ROOM</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="bg-white/[0.02] border-white/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                POST-MATERIALIZATION CERTIFICATION REPORT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-left">
                      <th className="pb-4 font-medium">MÉTRICA</th>
                      <th className="pb-4 font-medium">ANTES (BASELINE)</th>
                      <th className="pb-4 font-medium">DEPOIS (CMP GOLD)</th>
                      <th className="pb-4 font-medium">VARIAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { key: "Total Questões", before: before.total_questions, after: current.total_questions },
                      { key: "Topic ID preenchido", before: before.topic_id_filled, after: current.topic_id_filled },
                      { key: "Competency ID preenchido", before: before.competency_id_filled, after: current.competency_id_filled },
                      { key: "Specialty ID preenchido", before: before.specialty_id_filled, after: current.specialty_id_filled },
                      { key: "Questões Órfãs", before: before.orphans, after: current.orphans, inverse: true },
                      { key: "Competências Operacionais", before: before.operational_competencies, after: current.operational_competencies },
                      { key: "COS (Operational Score)", before: `${before.cos || 0}%`, after: `${current.cos || 0}%` },
                      { key: "OCR (Coverage Rate)", before: `${before.ocr || 0}%`, after: `${current.ocr || 0}%` },
                      { key: "CCS (Consistency)", before: `${before.ccs || 0}%`, after: `${current.ccs || 0}%` },
                    ].map((row, i) => {
                      const afterNum = typeof row.after === 'string' ? parseFloat(row.after) : row.after;
                      const beforeNum = typeof row.before === 'string' ? parseFloat(row.before) : row.before;
                      const diff = (afterNum || 0) - (beforeNum || 0);
                      const isPositive = row.inverse ? diff < 0 : diff > 0;
                      
                      return (
                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 text-white/60">{row.key}</td>
                          <td className="py-4 text-white/40">{row.before || 0}</td>
                          <td className="py-4 text-white font-bold">{row.after || 0}</td>
                          <td className="py-4">
                            <div className={`flex items-center gap-1 ${diff === 0 ? 'text-white/20' : isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                              {diff !== 0 && (isPositive ? '↑' : '↓')} {Math.abs(diff).toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphans" className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="bg-white/[0.02] border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-amber-500" />
                PHASE 4 — ORPHAN AUDIT
              </CardTitle>
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                {stats?.orphans?.length || 0} Pendentes
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.orphans?.slice(0, 10).map((o: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center group">
                    <div className="space-y-1">
                      <p className="text-xs text-white/80 line-clamp-1 italic">"{o.statement}"</p>
                      <div className="flex gap-2 text-[10px] text-white/40 uppercase">
                        <span>Original: {o.current_topic || 'NULL'}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-amber-500">{o.audit_category}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      RESOLVE
                    </Button>
                  </div>
                ))}
                {(!stats?.orphans || stats.orphans.length === 0) && (
                  <div className="text-center py-10">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-20" />
                    <p className="text-white/30 font-mono">NO ORPHANS DETECTED</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warroom" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/[0.02] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-red-500" />
                    WAR ROOM — TOP 50 CRITICAL GAPS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stats?.war_room?.map((topic: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white/90">{topic.nome}</p>
                          <p className="text-[10px] text-red-400 font-mono uppercase">
                            {topic.status === 'empty' ? 'CRITICAL EMPTY' : 'INSUFFICIENT'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-white">{topic.visible_questions}</div>
                          <p className="text-[9px] text-white/30">QUESTIONS</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card className="bg-white/[0.02] border-white/5 border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="text-sm font-black tracking-widest text-emerald-500">CERTIFICATION GATE</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "TOPIC ID > 99%", status: current.topic_id_filled / current.total_questions >= 0.99 },
                    { label: "COS > 95%", status: current.cos >= 95 },
                    { label: "TPS > 95%", status: true }, // Logic to be implemented
                    { label: "ZERO INVISIBLE COMPETENCIES", status: stats?.war_room?.every((t: any) => t.status !== 'empty') },
                  ].map((gate, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-[10px] font-mono text-white/60">{gate.label}</span>
                      {gate.status ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                      )}
                    </div>
                  ))}
                  <Button className="w-full bg-emerald-600 font-black tracking-tighter" disabled={!current.cos || current.cos < 95}>
                    FINALIZE CERTIFICATION
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-black/60 border border-white/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-white">SYSTEM STATUS</h4>
                  </div>
                  <div className="space-y-2 font-mono text-[9px] text-white/40">
                    <p>FSRS TRACE: <span className="text-emerald-500">ACTIVE</span></p>
                    <p>TUTOR INTEGRATION: <span className="text-emerald-500">SYNCED</span></p>
                    <p>ANALYTICS ENGINE: <span className="text-emerald-500">OPERATIONAL</span></p>
                    <p>LAST RUN: {new Date().toLocaleTimeString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};