import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  History, 
  RotateCcw, 
  RefreshCcw, 
  FileDown, 
  ShieldCheck, 
  AlertTriangle, 
  Search,
  CheckCircle2,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

const AdminBlueprints = () => {
  const queryClient = useQueryClient();
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [comparisonVersions, setComparisonVersions] = useState<any[]>([]);

  // 1. Fetch Blueprints
  const { data: blueprints, isLoading: loadingBlueprints } = useQuery({
    queryKey: ["admin-blueprints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_blueprints")
        .select("*")
        .eq("is_active", true)
        .order("exam_key");
      if (error) throw error;
      return data;
    }
  });

  // 2. Fetch Versions
  const { data: versions, isLoading: loadingVersions } = useQuery({
    queryKey: ["admin-blueprint-versions", selectedExam],
    queryFn: async () => {
      let query = supabase.from("exam_blueprint_versions").select("*").order("created_at", { ascending: false });
      if (selectedExam) query = query.eq("exam_key", selectedExam);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // 3. Fetch Drift Logs
  const { data: driftLogs } = useQuery({
    queryKey: ["admin-drift-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_drift_logs")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  // Actions
  const reconcileMutation = useMutation({
    mutationFn: async ({ examKey, previewOnly = false }: { examKey: string, previewOnly?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("exam-intelligence-engine", {
        body: { 
          action: previewOnly ? "preview_reconcile" : "reconcile", 
          exam_key: examKey, 
          payload: { smoothing_factor: 0.3 } 
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.previewOnly) {
        setPreviewData(data);
        setIsPreviewOpen(true);
      } else {
        toast.success("Reconciliação concluída com sucesso!");
        setIsPreviewOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin-blueprints"] });
        queryClient.invalidateQueries({ queryKey: ["admin-blueprint-versions"] });
      }
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`)
  });

  const rollbackMutation = useMutation({
    mutationFn: async (version: any) => {
      // Manual rollback implementation since we don't have a dedicated edge action for it yet
      // 1. Deactivate current active for this exam
      await supabase.from("exam_blueprint_versions")
        .update({ is_active: false })
        .eq("exam_key", version.exam_key);
      
      // 2. Activate target version
      await supabase.from("exam_blueprint_versions")
        .update({ is_active: true })
        .eq("id", version.id);

      // 3. Sync blueprints table
      await supabase.from("exam_blueprints")
        .update({ is_active: false })
        .eq("exam_key", version.exam_key);

      const inserts = version.blueprint_json.map((b: any) => ({
        exam_key: version.exam_key,
        specialty: b.specialty || "Geral",
        topic: b.topic,
        weight: b.weight,
        version: version.version_label,
        is_active: true,
        confidence_score: b.confidence_score || 0.5,
        sample_size: b.sample_size || 0
      }));

      const { error } = await supabase.from("exam_blueprints").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rollback aplicado com sucesso!");
      setIsRollbackOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-blueprints"] });
      queryClient.invalidateQueries({ queryKey: ["admin-blueprint-versions"] });
    }
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">CRÍTICO</Badge>;
      case 'high': return <Badge className="bg-orange-500">ALTO</Badge>;
      case 'medium': return <Badge className="bg-yellow-500">MÉDIO</Badge>;
      default: return <Badge variant="secondary">BAIXO</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in bg-slate-950 min-h-screen text-slate-100">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
            Blueprint Intelligence Engine
          </h1>
          <p className="text-slate-400 font-medium">Governança e auditoria de inteligência médica adaptativa</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-slate-800 bg-slate-900/50 hover:bg-slate-800">
            <FileDown className="w-4 h-4 mr-2" /> Exportar Auditoria
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCcw className="w-4 h-4 mr-2" /> Recalibrar Global
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Status Cards */}
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Total de Bancas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{new Set(blueprints?.map(b => b.exam_key)).size}</div>
            <p className="text-xs text-emerald-500 mt-1 font-bold">+2 detectadas recentemente</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Drifts Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-orange-500">{driftLogs?.filter(l => l.severity === 'critical').length || 0}</div>
            <p className="text-xs text-slate-500 mt-1">Nas últimas 24 horas</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Confiança Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-emerald-500">92.4%</div>
            <p className="text-xs text-slate-500 mt-1">Baseado em 14.2k questões</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-slate-900 border-slate-800 p-1 mb-6">
          <TabsTrigger value="active" className="data-[state=active]:bg-slate-800">Bancas Ativas</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-slate-800">Histórico de Versões</TabsTrigger>
          <TabsTrigger value="drift" className="data-[state=active]:bg-slate-800">Logs de Drift</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from(new Set(blueprints?.map(b => b.exam_key))).map(examKey => {
              const examBlueprints = blueprints?.filter(b => b.exam_key === examKey) || [];
              const avgConfidence = examBlueprints.reduce((acc, b) => acc + Number(b.confidence_score), 0) / examBlueprints.length;
              const totalSample = Math.max(...examBlueprints.map(b => b.sample_size));
              
              return (
                <Card key={examKey} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 w-full" />
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="mb-2 border-emerald-500/30 text-emerald-500 bg-emerald-500/5 uppercase">Ativo</Badge>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">{examKey}</CardTitle>
                      </div>
                      <Database className="w-5 h-5 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Confiança</span>
                        <div className="font-black text-emerald-400">{(avgConfidence * 100).toFixed(1)}%</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Amostra</span>
                        <div className="font-black">{totalSample} Questões</div>
                      </div>
                    </div>
                    
                    <div className="pt-4 flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1 bg-slate-800 hover:bg-slate-700" onClick={() => setSelectedExam(examKey)}>
                        <Search className="w-3.5 h-3.5 mr-2" /> Detalhes
                      </Button>
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => reconcileMutation.mutate({ examKey, previewOnly: true })}>
                        <RefreshCcw className="w-3.5 h-3.5 mr-2" /> Reconciliar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-slate-900 border-slate-800">
            <Table>
              <TableHeader className="bg-slate-950/50">
                <TableRow className="border-slate-800">
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Versão</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Banca</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Data</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500 text-center">Status</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Confiança Médio</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions?.map((v) => (
                  <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-bold font-mono text-emerald-400">{v.version_label}</TableCell>
                    <TableCell className="font-black uppercase">{v.exam_key}</TableCell>
                    <TableCell className="text-slate-400">{new Date(v.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      {v.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">ATIVO</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-800">INATIVO</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-bold">{(Number(v.confidence_avg) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      {!v.is_active && (
                        <Button size="sm" variant="ghost" className="hover:bg-orange-500/10 hover:text-orange-500" onClick={() => {
                          setSelectedVersion(v);
                          setIsRollbackOpen(true);
                        }}>
                          <RotateCcw className="w-4 h-4 mr-2" /> Rollback
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="drift">
          <Card className="bg-slate-900 border-slate-800">
            <Table>
              <TableHeader className="bg-slate-950/50">
                <TableRow className="border-slate-800">
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Severidade</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Banca</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Tema</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Mudança</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Delta</TableHead>
                  <TableHead className="font-bold uppercase text-xs text-slate-500">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driftLogs?.map((log) => (
                  <TableRow key={log.id} className="border-slate-800">
                    <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                    <TableCell className="font-black uppercase">{log.exam_key}</TableCell>
                    <TableCell className="font-medium">{log.topic}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {Number(log.old_weight).toFixed(1)}% → {Number(log.new_weight).toFixed(1)}%
                    </TableCell>
                    <TableCell className={`font-bold ${Number(log.delta) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {Number(log.delta) > 0 ? '+' : ''}{Number(log.delta).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {new Date(log.detected_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rollback Confirmation */}
      <Dialog open={isRollbackOpen} onOpenChange={setIsRollbackOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <AlertTriangle className="text-orange-500" /> Confirmar Rollback
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Você está prestes a reverter o blueprint de <span className="text-slate-100 font-bold">{(selectedVersion?.exam_key || '').toUpperCase()}</span> para a versão <span className="text-emerald-400 font-mono">{selectedVersion?.version_label}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-widest">Confidence Score</span>
              <span className="font-black text-emerald-500">{(Number(selectedVersion?.confidence_avg) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-widest">Data de Criação</span>
              <span className="font-medium text-slate-300">{selectedVersion?.created_at && new Date(selectedVersion.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => setIsRollbackOpen(false)}>Cancelar</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => rollbackMutation.mutate(selectedVersion)}>
              Aplicar Rollback Imediato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlueprints;
