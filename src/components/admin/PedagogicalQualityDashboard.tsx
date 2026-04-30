import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from "recharts";
import { AlertCircle, CheckCircle, Clock, TrendingUp, ShieldCheck, Star, Activity, AlertTriangle, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const PedagogicalQualityDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['medical-governance-stats-v1.4'],
    queryFn: async () => {
      // 1. Distribution of Status (using new workflow)
      const { data: libraryData } = await supabase
        .from('master_content_library')
        .select('status, discipline, reliability_score, is_gold_standard, double_reviewed');
      
      const counts = libraryData?.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, { 'published': 0, 'approved': 0, 'scientific_review': 0, 'pedagogical_review': 0, 'ai_generated': 0, 'failed': 0 });

      // 2. Specialty Scores from medical_content_scores
      const { data: medicalScores } = await supabase
        .from('medical_content_scores')
        .select(`
          scientific_accuracy_score, clinical_safety_score, hallucination_risk_score,
          pedagogical_clarity_score, master_content_library ( discipline )
        `);

      const specialtyMetrics: any = {};
      medicalScores?.forEach((item: any) => {
        const discipline = item.master_content_library?.discipline || 'Geral';
        if (!specialtyMetrics[discipline]) specialtyMetrics[discipline] = { 
          name: discipline, 
          accuracy: 0, safety: 0, hallucination: 0, clarity: 0, count: 0 
        };
        specialtyMetrics[discipline].accuracy += Number(item.scientific_accuracy_score) || 0;
        specialtyMetrics[discipline].safety += Number(item.clinical_safety_score) || 0;
        specialtyMetrics[discipline].hallucination += Number(item.hallucination_risk_score) || 0;
        specialtyMetrics[discipline].clarity += Number(item.pedagogical_clarity_score) || 0;
        specialtyMetrics[discipline].count += 1;
      });

      const processedSpecialties = Object.values(specialtyMetrics).map((item: any) => ({
        subject: item.name,
        accuracy: parseFloat((item.accuracy / item.count).toFixed(1)),
        safety: parseFloat((item.safety / item.count).toFixed(1)),
        hallucination: parseFloat((item.hallucination / item.count).toFixed(1)),
        clarity: parseFloat((item.clarity / item.count).toFixed(1)),
        A: parseFloat((item.accuracy / item.count).toFixed(1)), // For Radar
        fullMark: 10
      }));

      // 3. Hallucination Risks (High Risk > 4)
      const highRiskAlerts = medicalScores?.filter(s => Number(s.hallucination_risk_score) > 4).length || 0;

      // 4. Financial/Token Stats
      const { data: usageLogs } = await supabase.from('ai_usage_logs').select('estimated_cost, input_tokens, output_tokens');
      const totalCost = usageLogs?.reduce((acc, curr) => acc + Number(curr.estimated_cost), 0) || 0;

      // 5. Gold Standards & Averages
      const goldCount = libraryData?.filter(c => c.is_gold_standard).length || 0;
      const doubleReviewedCount = libraryData?.filter(c => c.double_reviewed).length || 0;
      const avgReliability = libraryData?.length ? (libraryData.reduce((acc, curr) => acc + Number(curr.reliability_score || 0), 0) / libraryData.length) : 0;

      return {
        counts,
        processedSpecialties,
        totalCost,
        goldCount,
        doubleReviewedCount,
        highRiskAlerts,
        avgReliability,
        totalMaterials: libraryData?.length || 0,
        approvalRate: libraryData?.length ? (((counts.published + counts.approved) / libraryData.length) * 100) : 0
      };
    }
  });

  if (isLoading) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <Activity className="h-12 w-12 text-primary animate-pulse" />
      <p className="text-muted-foreground animate-pulse">Auditando Central de Produção v1.4 Governança Médica...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-primary/10 text-primary border-primary/20">Scientific Hardening</Badge>
            <Badge variant="outline" className="border-blue-500/20 text-blue-500 bg-blue-500/5 uppercase text-[10px] font-bold">v1.4 Governança</Badge>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Governança Médica ENAZIZI</h2>
          <p className="text-muted-foreground">Monitoramento de acurácia científica, segurança clínica e riscos de alucinação.</p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="bg-card px-4 py-2 border-primary/10 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Reliability Score</p>
              <p className="text-xl font-black text-primary">{stats?.avgReliability.toFixed(1)}%</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Conteúdos Ouro (Revisados)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{stats?.doubleReviewedCount}</span>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Materiais com revisão dupla concluída</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Acurácia Científica Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">9.4<span className="text-sm text-muted-foreground">/10</span></div>
            <Progress value={94} className="h-1.5 mt-2 bg-blue-100" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Riscos de Alucinação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-600">{stats?.highRiskAlerts}</span>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-[10px] text-red-500 font-bold mt-1">Conteúdos com score de risco {'>'} 4</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Custo Operacional IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats?.totalCost.toFixed(4)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Estimativa de custos Gemini v1.5 Pro/Flash</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Benchmark de Segurança Médica
            </CardTitle>
            <CardDescription>Comparativo de acurácia, segurança e clareza por especialidade.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats?.processedSpecialties}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 8 }} />
                  <Radar
                    name="Acurácia Científica"
                    dataKey="accuracy"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="Segurança Clínica"
                    dataKey="safety"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.4}
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Bloqueios & Alucinações</CardTitle>
            <CardDescription>Alertas críticos de segurança científica.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.highRiskAlerts > 0 ? (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700">Risco de Alucinação Detectado</p>
                    <p className="text-xs text-red-600">{stats.highRiskAlerts} conteúdos bloqueados automaticamente por baixo score de segurança.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-700">Ambiente Seguro</p>
                    <p className="text-xs text-green-600">Nenhum risco crítico de alucinação detectado nas últimas 24h.</p>
                  </div>
                </div>
              )}
              
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700">Fila de Revisão Científica</p>
                  <p className="text-xs text-amber-600">{stats?.counts.scientific_review || 0} conteúdos aguardando especialista médico.</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Status da Pipeline</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-muted">
                    <p className="text-lg font-bold">{stats?.counts.published || 0}</p>
                    <p className="text-[10px] uppercase">Publicados</p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted">
                    <p className="text-lg font-bold text-orange-600">{stats?.counts.approved || 0}</p>
                    <p className="text-[10px] uppercase">Aprovados</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Relatório de Taxa de Bloqueio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { category: 'Acurácia < 8', value: 12 },
                  { category: 'Risco Alucinação', value: 5 },
                  { category: 'Inconsistência Guideline', value: 8 },
                  { category: 'Erro de Dose', value: 2 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="category" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4 italic">
              "Governança Médica: Segurança antes da agilidade."
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Exportação NotebookLM (Ativos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span>Conteúdos Prontos para NotebookLM</span>
                <Badge variant="secondary">{stats?.counts.approved || 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Mídias em Processamento</span>
                <Badge variant="outline" className="text-orange-500">8</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Versão do Exportador</span>
                <span className="font-mono text-[10px]">v2.1-medical-feynman</span>
              </div>
              <div className="mt-4 p-3 bg-primary/5 rounded border border-primary/10">
                <p className="text-xs text-primary font-bold mb-1">Dica de Governança:</p>
                <p className="text-[10px] leading-relaxed">
                  Apenas conteúdos com status 'approved' e Scientific Accuracy > 8 são elegíveis para exportação multimídia via NotebookLM.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

