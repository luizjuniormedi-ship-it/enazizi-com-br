import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Brain, 
  Target, 
  Activity, 
  Award, 
  ShieldCheck, 
  Zap,
  Microscope,
  Stethoscope,
  GraduationCap,
  FlaskConical,
  Scale,
  AlertCircle,
  Clock,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

export const CurriculumEvidenceDashboard = () => {
  const [topics, setTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOutcomeData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('curriculum_topics')
        .select('*')
        .order('ecs_score', { ascending: false })
        .limit(30);

      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar métricas de evidência educacional");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutcomeData();
  }, []);

  if (isLoading) return <div className="p-8 animate-pulse text-white">Carregando Evidence Confidence Engine...</div>;
  
  const avgCoi = topics.reduce((acc, t) => acc + (Number(t.coi_score) || 0), 0) / (topics.length || 1);
  const avgIps = topics.reduce((acc, t) => acc + (Number(t.ips_score) || 0), 0) / (topics.length || 1);
  const avgEcs = topics.reduce((acc, t) => acc + (Number(t.ecs_score) || 0), 0) / (topics.length || 1);
  const goldVerifiedCount = topics.filter(t => 
    (Number(t.coi_score) >= 80 && 
     (Number(t.ips_score) || 0) >= 80 && 
     (Number(t.ecs_score) || 0) >= 80 && 
     (Number(t.sample_size) || 0) >= 500 &&
     t.drift_status !== 'DRIFT CRÍTICO')
  ).length;

  return (
    <div className="space-y-6 p-6 bg-black/40 rounded-3xl border border-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-pink-500" />
            Evidence Confidence Engine (ECE)
          </h2>
          <p className="text-white/50 text-sm">FCCP Phase 6.5 - Statistical Validation & Bias Detection</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOutcomeData} className="bg-white/5">
          <Activity className="h-4 w-4 mr-2" /> Recalcular Impacto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <FlaskConical className="h-3 w-3" /> ECS MÉDIO (CONFIDENCE)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-400">{avgEcs.toFixed(1)}</div>
            <p className="text-[10px] text-white/30">Média de Confiança Estatística</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> COI MÉDIO (OUTCOME)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-400">{avgCoi.toFixed(1)}</div>
            <p className="text-[10px] text-white/30">Média de Desfecho Educacional</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <Scale className="h-3 w-3" /> N TOTAL (SAMPLES)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {topics.reduce((acc, t) => acc + (t.sample_size || 0), 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-white/30">Amostragem Curricular Total</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-white/50 flex items-center gap-2">
              <Award className="h-3 w-3" /> GOLD CERTIFIED
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{goldVerifiedCount}</div>
            <p className="text-[10px] text-white/30">ECS, COI, IPS ≥ 80 & N ≥ 500</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white/80 flex items-center justify-between">
              <span>Robustez de Evidência por Competência (ECS)</span>
              <Badge variant="outline" className="text-[10px] text-pink-400 border-pink-500/30">N ≥ 500 para Certificação</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topics.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="nome" 
                  stroke="#ffffff40" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ color: '#fff', marginBottom: '4px' }}
                />
                <Bar dataKey="ecs_score" radius={[4, 4, 0, 0]}>
                  {topics.slice(0, 15).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Number(entry.ecs_score) >= 80 ? '#ec4899' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white/80">Evidence Audit Table</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="space-y-3">
              {topics.slice(0, 6).map((topic) => (
                <div key={topic.id} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 relative overflow-hidden group">
                  {topic.drift_status === 'DRIFT CRÍTICO' && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />
                  )}
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white/90 block truncate max-w-[140px]">{topic.nome}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-[9px] px-1 py-0 h-4 border-none ${
                          topic.evidence_maturity_level >= 4 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/50'
                        }`}>
                          Nível {topic.evidence_maturity_level}
                        </Badge>
                        <span className="text-[10px] text-white/30 italic">N={topic.sample_size}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-black text-pink-400">ECS {topic.ecs_score}</div>
                      <div className="text-[9px] text-white/40">CI: [{topic.ci_low}-{topic.ci_high}]</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Progress value={topic.ecs_score} className="h-1 flex-1 bg-white/5" />
                    {topic.drift_status !== 'SEM DRIFT' && (
                      <AlertCircle className={`h-3 w-3 ${topic.drift_status === 'DRIFT CRÍTICO' ? 'text-red-500' : 'text-amber-500'}`} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
          <div className="flex items-center gap-3 mb-3">
            <Microscope className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white/90">Learning Yield</h3>
          </div>
          <p className="text-xs text-white/60">Mede o ganho direto entre erro inicial, exposição ao conteúdo e acerto subsequente por competência.</p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-3">
            <Stethoscope className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white/90">Transfer Score</h3>
          </div>
          <p className="text-xs text-white/60">Avalia a transição do conhecimento teórico para o Hospital Virtual e OSCE (Desempenho Clínico).</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-3 mb-3">
            <GraduationCap className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white/90">Approval Impact</h3>
          </div>
          <p className="text-xs text-white/60">Correlação longitudinal entre o domínio da competência e a taxa de aprovação em provas reais (ENARE/ENAMED).</p>
        </div>
      </div>
    </div>
  );
};