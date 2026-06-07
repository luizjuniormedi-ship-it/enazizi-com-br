import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Brain, 
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  Microscope,
  Stethoscope,
  HeartPulse,
  Syringe
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const radarData = [
  { subject: 'Precisão Diagnóstica', A: 85, fullMark: 100 },
  { subject: 'Escolha Terapêutica', A: 78, fullMark: 100 },
  { subject: 'Eficiência de Tempo', A: 92, fullMark: 100 },
  { subject: 'Segurança do Paciente', A: 88, fullMark: 100 },
  { subject: 'Ganho Clínico', A: 65, fullMark: 100 },
];

const gainData = [
  { name: 'Week 1', gain: 12 },
  { name: 'Week 2', gain: 18 },
  { name: 'Week 3', gain: 15 },
  { name: 'Week 4', gain: 28 },
  { name: 'Week 5', gain: 32 },
];

export default function ClinicalEvidenceCenter() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    dqi: 88,
    readiness: 76,
    gain: +24,
    transfer: 82,
    errors: 1.4,
    outcomes: {
      recovery: 85,
      icu: 10,
      death: 5
    },
    evidenceQuality: 92,
    inflationRate: 4.2,
    attributionConfidence: 0.85,
    caseDifficultyAvg: 1.2
  });

  useEffect(() => {
    // Logic to fetch real data from the new CSVP tables will go here
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [user]);

  const getDqiColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 80) return "text-blue-400";
    if (score >= 70) return "text-amber-400";
    return "text-rose-400";
  };

  const getDqiLabel = (score: number) => {
    if (score >= 90) return "Elite";
    if (score >= 80) return "Forte";
    if (score >= 70) return "Adequado";
    if (score >= 60) return "Atenção";
    return "Crítico";
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5 text-[10px] uppercase tracking-widest font-bold">
              CSVP Phase 1.0
            </Badge>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">Evidência em Tempo Real</span>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">
            Centro de <span className="text-primary">Evidências</span> Clínicas
          </h1>
          <p className="text-white/40 text-xs font-medium max-w-2xl uppercase tracking-wider">
            Validação científica de raciocínio clínico e impacto educacional longitudinal.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="border-white/5 bg-white/5 text-[10px] font-bold uppercase tracking-widest h-9">
            Exportar Protocolo
          </Button>
          <Button className="bg-primary hover:bg-primary/80 text-[10px] font-bold uppercase tracking-widest h-9">
            Nova Simulação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Índice de Qualidade de Decisão (DQI)</p>
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-3xl font-black italic tracking-tighter ${getDqiColor(stats.dqi)}`}>{stats.dqi}</h3>
                  <Badge className="bg-white/10 text-white/60 text-[8px] uppercase">{getDqiLabel(stats.dqi)}</Badge>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-white/20 tracking-tighter">
                <span>Precisão Clínica</span>
                <span>88%</span>
              </div>
              <Progress value={88} className="h-1 bg-white/5" indicatorClassName="bg-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ganho de Aprendizado Clínico</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black italic tracking-tighter text-emerald-400">{stats.gain}%</h3>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Brain className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-white/20 tracking-tighter">
                <span>Baseline: 52%</span>
                <span>Atual: 76%</span>
              </div>
              <Progress value={76} className="h-1 bg-white/5" indicatorClassName="bg-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Score de Transferência</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black italic tracking-tighter text-blue-400">{stats.transfer}%</h3>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="mt-4 text-[9px] font-bold text-white/30 uppercase leading-relaxed tracking-tighter">
              Conexão entre teoria estudada e aplicação prática validada.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Densidade de Erros</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black italic tracking-tighter text-rose-400">{stats.errors}</h3>
                  <span className="text-[10px] font-bold text-white/20 uppercase">por caso</span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <ShieldAlert className="h-5 w-5 text-rose-500" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[8px] uppercase">Diagnóstico</Badge>
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[8px] uppercase">Terapêutico</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Velocidade de Ganho Clínico
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-white/30">
              Evolução do raciocínio clínico por unidade de simulação.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gainData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontWeight: 'bold' }}
                />
                <YAxis 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontWeight: 'bold' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a10', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="gain" 
                  stroke="#8B5CF6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <Microscope className="h-5 w-5 text-primary" />
              Radar de Competências
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-white/30">
              Proficiência clínica por domínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#ffffff05" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#ffffff40', fontSize: 8, fontWeight: 'bold' }} 
                />
                <Radar
                  name="Proficiência"
                  dataKey="A"
                  stroke="#8B5CF6"
                  fill="#8B5CF6"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black uppercase tracking-tighter">Rastreamento de Ações Clínicas</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-white/30">
                Log em tempo real de decisões médicas.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 text-[8px] font-black uppercase text-white/20">
              <Clock className="h-3 w-3" />
              Ultimas 24h
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { type: 'Medication', domain: 'Sepse', time: '14:22', icon: Syringe, color: 'text-emerald-400', status: 'Correto' },
                { type: 'Exam', domain: 'IAM', time: '14:15', icon: HeartPulse, color: 'text-blue-400', status: 'Correto' },
                { type: 'Diagnosis', domain: 'AVC', time: '13:58', icon: Brain, color: 'text-amber-400', status: 'Atrasado' },
                { type: 'Procedure', domain: 'Trauma', time: '13:45', icon: Stethoscope, color: 'text-emerald-400', status: 'Correto' },
              ].map((action, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl bg-white/5 ${action.color}`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-tight">{action.type}: {action.domain}</h4>
                      <p className="text-[9px] font-bold text-white/30 uppercase">{action.time} • Impact Score: +12.4</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[8px] uppercase font-bold ${action.status === 'Correto' ? 'border-emerald-500/20 text-emerald-400' : 'border-amber-500/20 text-amber-400'}`}>
                    {action.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-primary">
              Ver Log Completo <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tighter">Ciência de Desfecho do Paciente</CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-white/30">
              Correlação entre decisões e desfechos reais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-[8px] font-black uppercase text-emerald-500/60 mb-1">Recuperação</p>
                <h4 className="text-2xl font-black italic text-emerald-400">85%</h4>
              </div>
              <div className="text-center p-4 rounded-3xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-[8px] font-black uppercase text-amber-500/60 mb-1">UTI/Complicação</p>
                <h4 className="text-2xl font-black italic text-amber-400">10%</h4>
              </div>
              <div className="text-center p-4 rounded-3xl bg-rose-500/5 border border-rose-500/10">
                <p className="text-[8px] font-black uppercase text-rose-500/60 mb-1">Óbito</p>
                <h4 className="text-2xl font-black italic text-rose-400">5%</h4>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
                <div className="relative z-10 flex justify-between items-center">
                  <div className="space-y-1">
                    <Badge className="bg-primary/20 text-primary border-none text-[8px] uppercase">Insight Científico</Badge>
                    <h4 className="text-xs font-black uppercase tracking-tight text-white/80">Otimização de Janela no AVC</h4>
                    <p className="text-[9px] font-medium text-white/40 max-w-[200px]">Alunos que estudaram "Janela Terapêutica" em Flashcards tiveram DQI 22% maior em simulações.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-primary uppercase">+22%</p>
                    <p className="text-[8px] font-bold text-white/20 uppercase">Correlation</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 mt-6">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Auditoria de Evidência Clínica
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold text-white/30">
            Monitoramento de robustez e blindagem das evidências clínicas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">DQI Inflation Rate</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-rose-400">{stats.inflationRate}%</span>
                  <Badge className="bg-rose-500/10 text-rose-500 text-[8px] uppercase">Monitorado</Badge>
                </div>
                <p className="text-[8px] text-white/20 mt-2 uppercase font-bold italic">[DQI_INFLATION_DETECTED]</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Evidence Quality Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400">{stats.evidenceQuality}</span>
                  <Badge className="bg-emerald-500/10 text-emerald-400 text-[8px] uppercase">Elite</Badge>
                </div>
                <p className="text-[8px] text-white/20 mt-2 uppercase font-bold italic">[CLINICAL_EVIDENCE_QUALITY_HIGH]</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Transfer Confidence</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-blue-400">0.82</span>
                  <Badge className="bg-blue-500/10 text-blue-400 text-[8px] uppercase">High</Badge>
                </div>
                <p className="text-[8px] text-white/20 mt-2 uppercase font-bold italic">[FAR_TRANSFER_CONFIDENCE_HIGH]</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Attribution Confidence</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-purple-400">{stats.attributionConfidence}</span>
                  <Badge className="bg-purple-500/10 text-purple-400 text-[8px] uppercase">Stable</Badge>
                </div>
                <p className="text-[8px] text-white/20 mt-2 uppercase font-bold italic">[ATTRIBUTION_STABILITY_UPDATED]</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 border-dashed">
                <p className="text-[10px] font-black text-white/40 uppercase mb-4">Governance Alerts</p>
                <div className="space-y-2">
                  {[
                    '[CLINICAL_METRIC_INFLATION]',
                    '[FAR_TRANSFER_UNSTABLE]',
                    '[EVIDENCE_QUALITY_DEGRADED]'
                  ].map((alert, i) => (
                    <div key={i} className="flex items-center gap-2 text-[8px] font-black text-rose-500/60 bg-rose-500/5 p-2 rounded border border-rose-500/10">
                      <AlertCircle className="h-3 w-3" />
                      {alert}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
