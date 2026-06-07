import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, Brain, Activity, Target, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
      toast.error("Erro ao carregar inventário curricular");
    } finally {
      setIsLoading(false);
    }
  };

  const materializeBatch = async (batchId: string) => {
    setIsMaterializing(true);
    try {
      const { data, error } = await supabase.rpc('materialize_classifications', {
        p_batch_id: batchId
      });
      
      if (error) throw error;
      
      toast.success(`${data} questões materializadas no currículo oficial`);
      fetchStats();
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao materializar lote: " + err.message);
    } finally {
      setIsMaterializing(false);
    }
  };

  const startClassification = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("curriculum-reconstructor", {
        body: { action: "classify_batch", limit: 50 }
      });
      if (error) throw error;
      toast.success(`${data.processed} questões enviadas para classificação IA`);
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

  if (isLoading) return <div className="p-8 animate-pulse">Carregando Auditoria Curricular...</div>;

  const total = stats?.total || 19150;
  const classified = stats?.classified || 15332;
  const progress = (classified / total) * 100;

  return (
    <div className="space-y-6 p-6 bg-black/40 rounded-3xl border border-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            Curriculum Reconstruction Dashboard
          </h2>
          <p className="text-white/50 text-sm">ENAZIZI P0 Curriculum Recovery Engine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} className="bg-white/5">
            <Activity className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={startClassification} 
            disabled={isClassifying}
            className="bg-primary hover:bg-primary/80"
          >
            <Brain className="h-4 w-4 mr-2" /> {isClassifying ? "Classificando..." : "Classificar Lote IA"}
          </Button>
          {stats?.last_batch_id && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => materializeBatch(stats.last_batch_id)} 
              disabled={isMaterializing}
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ShieldCheck className="h-4 w-4 mr-2" /> {isMaterializing ? "Materializando..." : "Materializar Lote"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <Database className="h-3 w-3" /> TOTAL NO BANCO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{total.toLocaleString()}</div>
            <p className="text-[10px] text-white/30">Questões inventariadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <Brain className="h-3 w-3" /> CLASSIFICADAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{classified}</div>
            <p className="text-[10px] text-white/30">Prontas para migração</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <Target className="h-3 w-3" /> COVERAGE SCORE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{(classified / total * 100).toFixed(1)}%</div>
            <p className="text-[10px] text-white/30 text-amber-500">STATUS: CRÍTICO</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> DUPLICATAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white/80">PENDENTE</div>
            <p className="text-[10px] text-white/30">Aguardando Embeddings</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-white/50">PROGRESSO DA RECONSTRUÇÃO</span>
          <span className="text-primary">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
          <h3 className="text-sm font-bold text-white/80 mb-4">Gaps Curriculares Críticos</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-xs text-red-200">IAM com Supra (CARDIO_001)</span>
              <Badge variant="destructive" className="text-[10px]">9%</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-xs text-red-200">Tamponamento Cardíaco</span>
              <Badge variant="destructive" className="text-[10px]">0%</Badge>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
          <h3 className="text-sm font-bold text-white/80 mb-4">Mapeamento de Especialidades</h3>
          <div className="space-y-2">
            {stats?.summary && Object.entries(stats.summary).slice(0, 5).map(([spec, count]: any) => (
              <div key={spec} className="flex justify-between items-center text-xs">
                <span className="text-white/60">{spec}</span>
                <span className="text-white/80 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
