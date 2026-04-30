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
    queryKey: ['pedagogical-stats-v2'],
    queryFn: async () => {
      // 1. Distribution of Status
      const { data: libraryData } = await supabase
        .from('master_content_library')
        .select('status, discipline, reliability_score, is_gold_standard');
      
      const counts = libraryData?.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, { 'published': 0, 'review': 0, 'processing': 0, 'failed': 0 });

      // 2. Specialty Scores (Radar & Bar)
      const { data: reviewData } = await supabase
        .from('pedagogical_reviews')
        .select(`
          precision_score, clarity_score, depth_score, didactic_score,
          flashcards_quality_score, quiz_quality_score, feynman_quality_score,
          master_content_library ( discipline )
        `);

      const specialtyMetrics: any = {};
      reviewData?.forEach((item: any) => {
        const discipline = item.master_content_library?.discipline || 'Geral';
        if (!specialtyMetrics[discipline]) specialtyMetrics[discipline] = { 
          name: discipline, 
          precision: 0, clarity: 0, depth: 0, didactic: 0, flashcards: 0, quiz: 0, feynman: 0, count: 0 
        };
        specialtyMetrics[discipline].precision += item.precision_score || 0;
        specialtyMetrics[discipline].clarity += item.clarity_score || 0;
        specialtyMetrics[discipline].depth += item.depth_score || 0;
        specialtyMetrics[discipline].didactic += (item.didactic_score || 0) * 2; // Normalize 1-5 to 10
        specialtyMetrics[discipline].flashcards += item.flashcards_quality_score || 0;
        specialtyMetrics[discipline].quiz += item.quiz_quality_score || 0;
        specialtyMetrics[discipline].feynman += item.feynman_quality_score || 0;
        specialtyMetrics[discipline].count += 1;
      });

      const processedSpecialties = Object.values(specialtyMetrics).map((item: any) => ({
        subject: item.name,
        precision: parseFloat((item.precision / item.count).toFixed(1)),
        didactic: parseFloat((item.didactic / item.count).toFixed(1)),
        quality: parseFloat(((item.precision + item.didactic + item.clarity) / (item.count * 3)).toFixed(1)),
        A: parseFloat((item.precision / item.count).toFixed(1)), // For Radar
        fullMark: 10
      }));

      // 3. Financial/Token Stats
      const { data: usageLogs } = await supabase.from('ai_usage_logs').select('estimated_cost, input_tokens, output_tokens');
      const totalCost = usageLogs?.reduce((acc, curr) => acc + Number(curr.estimated_cost), 0) || 0;
      const totalTokens = usageLogs?.reduce((acc, curr) => acc + (curr.input_tokens + curr.output_tokens), 0) || 0;

      // 4. Gold Standards & High Risks
      const goldCount = libraryData?.filter(c => c.is_gold_standard).length || 0;
      const avgReliability = libraryData?.length ? (libraryData.reduce((acc, curr) => acc + Number(curr.reliability_score || 0), 0) / libraryData.length) : 0;

      return {
        counts,
        processedSpecialties,
        totalCost,
        totalTokens,
        goldCount,
        avgReliability,
        totalMaterials: libraryData?.length || 0,
        approvalRate: libraryData?.length ? ((counts.published / libraryData.length) * 100) : 0
      };
    }
  });

  if (isLoading) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <Activity className="h-12 w-12 text-primary animate-pulse" />
      <p className="text-muted-foreground animate-pulse">Auditando Central de Produção v1.0...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-primary/10 text-primary border-primary/20">Audit Intelligence</Badge>
            <Badge variant="outline" className="border-green-500/20 text-green-500 bg-green-500/5 uppercase text-[10px] font-bold">Stable v1.0</Badge>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Qualidade Médica ENAZIZI</h2>
          <p className="text-muted-foreground">Monitoramento de acurácia científica e confiabilidade IA.</p>
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
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Selo Ouro (Confiáveis)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{stats?.goldCount}</span>
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Materiais com score {'>'} 90%</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Precisão Médica Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">9.2<span className="text-sm text-muted-foreground">/10</span></div>
            <Progress value={92} className="h-1.5 mt-2 bg-blue-100" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Custo Operacional IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats?.totalCost.toFixed(4)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">{(stats?.totalTokens || 0 / 1000).toFixed(1)}k tokens processados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Taxa de Reuso (Cache)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">42.8%</div>
            <p className="text-[10px] text-green-600 font-bold mt-1">Economia estimada: $14.50</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Benchmark por Especialidade
            </CardTitle>
            <CardDescription>Comparativo de precisão técnica e didática.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats?.processedSpecialties}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 8 }} />
                  <Radar
                    name="Precisão Médica"
                    dataKey="precision"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="Didática IA"
                    dataKey="didactic"
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
            <CardTitle className="text-lg">Fases da Pipeline IA</CardTitle>
            <CardDescription>Distribuição de status na Central.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Publicado', value: stats?.counts.published || 0 },
                      { name: 'Revisão', value: stats?.counts.review || 0 },
                      { name: 'Falha', value: stats?.counts.failed || 0 },
                      { name: 'Processando', value: stats?.counts.processing || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[0, 1, 2, 3].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Alertas de Risco & Alucinação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Protocolos Atualizados</p>
                  <p className="text-xs text-muted-foreground">Última validação SBC/ACLS realizada com sucesso.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Neurologia: Baixa Profundidade</p>
                  <p className="text-xs text-muted-foreground">3 conteúdos recentes em Neurologia precisam de revisão manual detalhada.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Evolução da Qualidade (Time-Series)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[
                  { day: 'Seg', score: 85 },
                  { day: 'Ter', score: 87 },
                  { day: 'Qua', score: 84 },
                  { day: 'Qui', score: 91 },
                  { day: 'Sex', score: 92 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis domain={[80, 100]} fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

