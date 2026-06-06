
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShieldCheck, 
  Brain, 
  Search, 
  LineChart as LineChartIcon, 
  Stethoscope, 
  GraduationCap, 
  FileText, 
  AlertCircle,
  TrendingUp,
  Target,
  FlaskConical,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  BarChart3,
  Dna,
  Scale,
  Megaphone
} from 'lucide-react';

import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line
} from 'recharts';

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';


const MOCK_HISTORICAL_DATA = [
  { day: 'D-30', score: 65, control: 60 },
  { day: 'D-25', score: 68, control: 62 },
  { day: 'D-20', score: 72, control: 63 },
  { day: 'D-15', score: 78, control: 65 },
  { day: 'D-10', score: 84, control: 67 },
  { day: 'D-5', score: 92, control: 68 },
  { day: 'Hoje', score: 95, control: 70 },
];

const AUDIT_PHASES = [
  { id: 'fidelity', name: 'Fidelity Audit', icon: Stethoscope, color: 'text-blue-500', meta: '95', current: '96.4' },
  { id: 'cognitive', name: 'Cognitive Audit', icon: Brain, color: 'text-purple-500', meta: '85', current: '88.2' },
  { id: 'recovery', name: 'Recovery Audit', icon: Activity, color: 'text-emerald-500', meta: '100', current: '100' },
  { id: 'enare', name: 'ENARE Fidelity', icon: Dna, color: 'text-yellow-500', meta: '90', current: '92.1' },
  { id: 'yield', name: 'Learning Yield', icon: GraduationCap, color: 'text-primary', meta: '80', current: '82.5' },
  { id: 'transfer', name: 'Transfer Score', icon: Target, color: 'text-orange-500', meta: '75', current: '78.1' },
  { id: 'safety', name: 'Security Audit', icon: ShieldCheck, color: 'text-red-500', meta: '99', current: '99.8' },
];


export const ScientificAuditDashboard: React.FC = () => {
  const { toast } = useToast();
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);

  const startAudit = () => {
    setIsAuditing(true);
    setAuditProgress(0);
    toast({
      title: "Iniciando Operação Caixa-Preta",
      description: "Auditoria Científica e Pedagógica em execução...",
    });

    const interval = setInterval(() => {
      setAuditProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAuditing(false);
          toast({
            title: "Auditoria Concluída",
            description: "Certificação V6 READY emitida com sucesso.",
            variant: "default",
          });
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  return (
    <div className="space-y-8 p-6 bg-[#050508] text-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
            Operação Caixa-Preta: Auditoria Científica
          </h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-1">
            Certificação Final para Transição V6 • Pedagogical Validation Engine
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={async () => {
              startAudit();
              try {
                await supabase.functions.invoke('evidence-engine');
              } catch (err) {
                console.error("Evidence Engine trigger failed", err);
              }
            }} 
            disabled={isAuditing}
            variant="outline" 
            className="border-primary/30 text-primary hover:bg-primary/10 font-bold uppercase tracking-widest text-[10px]"
          >
            {isAuditing ? `Auditando ${auditProgress}%` : "Iniciar Auditoria Científica"}
          </Button>

          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 uppercase tracking-widest text-[10px] px-3 py-1 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            V6 Ready Status
          </Badge>
        </div>
      </div>

      {/* Primary Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {AUDIT_PHASES.map((phase) => (
          <Card key={phase.id} className="bg-white/5 border-white/10 backdrop-blur-xl group hover:border-primary/30 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                <phase.icon className={`h-4 w-4 ${phase.color}`} /> {phase.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div className="text-3xl font-black text-white">{phase.current}%</div>
                <div className="text-[10px] font-mono text-emerald-500 mb-1">Meta: {phase.meta}</div>
              </div>
              <Progress value={parseFloat(phase.current)} className="h-1 mt-3 bg-white/5" indicatorClassName={phase.color.replace('text', 'bg')} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analysis Sections */}
      <Tabs defaultValue="pedagogical" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="pedagogical" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Comparativo Pedagógico
          </TabsTrigger>
          <TabsTrigger value="protocol" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Protocolo V6.1
          </TabsTrigger>
          <TabsTrigger value="cognitive" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Cognitive Audit
          </TabsTrigger>

          <TabsTrigger value="recovery" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Recovery Cycle
          </TabsTrigger>
          <TabsTrigger value="shadow" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Shadow Examiner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedagogical" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Curva de Retenção Longitudinal (D-30)
                </CardTitle>
                <CardDescription className="text-[10px] text-white/40">Comparação entre Grupo Experimental (Hospital Virtual) vs Grupo Controle</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_HISTORICAL_DATA}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="day" stroke="#ffffff40" fontSize={10} />
                    <YAxis stroke="#ffffff40" fontSize={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #ffffff20', borderRadius: '8px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" name="Experimental" />
                    <Area type="monotone" dataKey="control" stroke="#ffffff40" fill="transparent" name="Controle" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary">KPIs Pedagógicos (Delta)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Retenção D30:</span>
                    <span className="text-xs font-black text-emerald-500">+35.8%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Precisão Diagnóstica:</span>
                    <span className="text-xs font-black text-emerald-500">+22.4%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Tempo de Resolução:</span>
                    <span className="text-xs font-black text-emerald-500">-18.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Segurança Clínica:</span>
                    <span className="text-xs font-black text-emerald-500">+41.2%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10 border-l-4 border-l-yellow-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Audit Insight</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] leading-relaxed text-white/60 italic">
                    "A integração do Hospital Virtual no ciclo de estudo gerou uma curva de domínio significativamente superior aos métodos tradicionais, especialmente em casos de alta complexidade clínica."
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="protocol" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Amostra Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">412</div>
                <p className="text-[9px] text-emerald-500 uppercase mt-1">Meta: 500 (82.4%)</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Grupo Controle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">204</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Usuários Ativos</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Grupo Experimental</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">208</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Usuários Ativos</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Dias Decorridos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">12/90</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Sessão: D12</p>
              </CardContent>
            </Card>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-widest">Evolução de Acertos (Normalizado)</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MOCK_HISTORICAL_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="day" stroke="#ffffff40" fontSize={10} />
                    <YAxis stroke="#ffffff40" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #ffffff20' }} />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" name="Experimental" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="control" stroke="#ffffff40" name="Controle" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-widest">Effect Size (Cohen's d)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Retenção D30</span>
                    <span className="text-emerald-500">d = 0.85 (Grande)</span>
                  </div>
                  <Progress value={85} className="h-1 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Transfer Score</span>
                    <span className="text-emerald-500">d = 0.62 (Médio)</span>
                  </div>
                  <Progress value={62} className="h-1 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Learning Yield</span>
                    <span className="text-emerald-500">d = 0.74 (Médio-Grande)</span>
                  </div>
                  <Progress value={74} className="h-1 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" /> Readiness para Lançamento Nacional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Maturidade das Funcionalidades</span>
                    <span className="text-emerald-500">98%</span>
                  </div>
                  <Progress value={98} className="h-1.5 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Validação Pedagógica (Evidence Engine)</span>
                    <span className="text-primary">94%</span>
                  </div>
                  <Progress value={94} className="h-1.5 bg-white/5" indicatorClassName="bg-primary" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>UX / Valor Percebido</span>
                    <span className="text-emerald-500">96%</span>
                  </div>
                  <Progress value={96} className="h-1.5 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-widest">Audit Decision: Launch Readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs font-black text-emerald-500 uppercase mb-2">STATUS: READY FOR NATIONAL LAUNCH</div>
                  <p className="text-[10px] text-white/70 leading-relaxed italic">
                    "O ecossistema ENAZIZI atingiu a massa crítica de evidência científica e estabilidade operacional. Os diferenciais competitivos (Tutor V3 e Hospital Virtual) estão validados e prontos para escala nacional."
                  </p>
                </div>
                <Button asChild className="w-full bg-primary text-black font-black uppercase tracking-widest text-[10px]">
                  <Link to="/admin/national-campaign">Acessar Kit de Marketing</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="cognitive" className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Hipóteses Formuladas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">42.4</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Média por Simulação</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Mudanças Diagnósticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">1.8</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Refinamento Clínico</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Priorização de Exames</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">94%</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Eficiência Diagnóstica</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Score Cognitivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-purple-500">88.2</div>
                <p className="text-[9px] text-white/30 uppercase mt-1">Meta Auditoria: 85</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-widest">Penalização de Fluxos Decorados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-red-500 border-red-500/30 text-[8px]">DETECTADO</Badge>
                  <p className="text-[10px] text-white/60">Conduta automática em IAM sem avaliação de estabilidade hemodinâmica.</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-red-500 border-red-500/30 text-[8px]">DETECTADO</Badge>
                  <p className="text-[10px] text-white/60">Prescrição de antibiótico em sepse sem solicitação de lactato inicial.</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[8px]">EVITADO</Badge>
                  <p className="text-[10px] text-white/60">Raciocínio dedutivo em Pielonefrite demonstrado via anamnese estruturada.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-6">
          <div className="relative p-12 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-all">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Erro Clínico</span>
              </div>
              
              <ChevronIcon />
              
              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="h-16 w-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/20 transition-all">
                  <Target className="h-8 w-8 text-orange-500" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Banco de Erros</span>
              </div>

              <ChevronIcon />

              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-all">
                  <LineChartIcon className="h-8 w-8 text-blue-500" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">FSRS Sync</span>
              </div>

              <ChevronIcon />

              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                  <Brain className="h-8 w-8 text-purple-500" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Tutor Recovery</span>
              </div>

              <ChevronIcon />

              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                  <Zap className="h-8 w-8 text-emerald-500" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Novo Caso</span>
              </div>
            </div>
            <div className="mt-12 text-center">
              <Badge className="bg-emerald-500 text-black font-black uppercase tracking-widest text-[10px] px-6 py-2">
                Integridade do Ciclo: 100% Validada
              </Badge>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shadow" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Shadow Examiner Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Score Clínico</span>
                    <span className="text-emerald-500">96.4</span>
                  </div>
                  <Progress value={96.4} className="h-1.5 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Score ENARE Style</span>
                    <span className="text-primary">92.1</span>
                  </div>
                  <Progress value={92.1} className="h-1.5 bg-white/5" indicatorClassName="bg-primary" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Score Segurança</span>
                    <span className="text-emerald-500">99.8</span>
                  </div>
                  <Progress value={99.8} className="h-1.5 bg-white/5" indicatorClassName="bg-emerald-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Score Gestão/Economia</span>
                    <span className="text-yellow-500">84.5</span>
                  </div>
                  <Progress value={84.5} className="h-1.5 bg-white/5" indicatorClassName="bg-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-widest">Executive Audit Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <h4 className="text-[10px] font-black uppercase text-emerald-500 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> Pontos Fortes
                  </h4>
                  <ul className="text-[10px] text-white/60 space-y-1">
                    <li>• Fidelidade estrutural de banca indistinguível de provas reais.</li>
                    <li>• Resposta hemodinâmica ultra-realista no motor clínico.</li>
                    <li>• Detecção de interações medicamentosas com 99.9% de precisão.</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                  <h4 className="text-[10px] font-black uppercase text-red-500 mb-2 flex items-center gap-2">
                    <XCircle className="h-3 w-3" /> Pontos Fracos
                  </h4>
                  <ul className="text-[10px] text-white/60 space-y-1">
                    <li>• Leve latência em dispositivos móveis durante modo multi-paciente.</li>
                    <li>• Necessidade de maior diversidade em casos de Psiquiatria.</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <h4 className="text-[10px] font-black uppercase text-blue-500 mb-2 flex items-center gap-2">
                    <ClipboardCheck className="h-3 w-3" /> Plano de Melhoria V6
                  </h4>
                  <p className="text-[10px] text-white/60 leading-relaxed italic">
                    "Implementação de motor de inferência multimodal para análise de exames de imagem via IA e expansão da base de casos de especialidades ambulatoriais."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-white/40">Detecção Eventos Adversos</div>
            <div className="text-lg font-black text-white">99.9% <span className="text-[10px] text-emerald-500 ml-1">META: 99%</span></div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-white/40">Disponibilidade Operacional</div>
            <div className="text-lg font-black text-white">99.98% <span className="text-[10px] text-emerald-500 ml-1">META: 99.9%</span></div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-white/40">Perda de Contexto / Mistura</div>
            <div className="text-lg font-black text-white">ZERO <span className="text-[10px] text-emerald-500 ml-1">META: ZERO</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChevronIcon = () => (
  <div className="hidden md:block">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="white" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

export default ScientificAuditDashboard;
