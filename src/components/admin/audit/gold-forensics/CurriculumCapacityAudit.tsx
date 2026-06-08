import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Zap,
  Target,
  LayoutGrid,
  Filter,
  FileText,
  ShieldAlert,
  Search,
  Activity,
  Award,
  ChevronRight,
  ShieldCheck,
  Skull,
  ZapOff,
  Crosshair,
  BarChart,
  ListFilter
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditPhase {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

interface CompetencyAudit {
  competence: string;
  specialty: string;
  total: number;
  eligible: number;
  gold: number;
  q10: boolean;
  q20: boolean;
  q50: boolean;
  q100: boolean;
  status: 'GOLD' | 'ROBUSTO' | 'OPERACIONAL' | 'PARCIAL' | 'CRÍTICO';
  recovery: number;
  overlap: number;
}

const PHASES_CONFIG: AuditPhase[] = [
  { id: 1, name: 'FULL COMPETENCY INVENTORY', status: 'pending' },
  { id: 2, name: 'REAL CAPACITY AUDIT', status: 'pending' },
  { id: 3, name: 'SIMULADO STRESS TEST (10-100Q)', status: 'pending' },
  { id: 4, name: 'RECOVERY MODE AUDIT', status: 'pending' },
  { id: 5, name: 'REPETITION ANALYSIS (OVERLAP)', status: 'pending' },
  { id: 6, name: 'OPERATIONAL CLASSIFICATION', status: 'pending' },
  { id: 7, name: 'OCC (CAPACITY COVERAGE)', status: 'pending' },
  { id: 8, name: 'SPECIALTY CERTIFICATION', status: 'pending' },
  { id: 9, name: 'GAP REPORT (RECOVER/GEN)', status: 'pending' },
  { id: 10, name: 'WAR ROOM (TOP 50 RISK)', status: 'pending' },
  { id: 11, name: 'CURRICULUM SURVIVABILITY', status: 'pending' },
  { id: 12, name: 'EXECUTIVE REPORT', status: 'pending' },
];

const MOCK_DATA: CompetencyAudit[] = [
  { competence: 'IAM com Supra', specialty: 'Cardiologia', total: 180, eligible: 165, gold: 120, q10: true, q20: true, q50: true, q100: true, status: 'ROBUSTO', recovery: 85, overlap: 8 },
  { competence: 'TEP', specialty: 'Pneumologia', total: 42, eligible: 38, gold: 20, q10: true, q20: true, q50: false, q100: false, status: 'PARCIAL', recovery: 22, overlap: 18 },
  { competence: 'Sepse', specialty: 'Infectologia', total: 121, eligible: 110, gold: 45, q10: true, q20: true, q50: true, q100: true, status: 'OPERACIONAL', recovery: 55, overlap: 12 },
  { competence: 'Miastenia Gravis', specialty: 'Neurologia', total: 12, eligible: 12, gold: 2, q10: true, q20: false, q50: false, q100: false, status: 'CRÍTICO', recovery: 8, overlap: 35 },
  { competence: 'Pneumonia Comunitária', specialty: 'Pneumologia', total: 110, eligible: 95, gold: 30, q10: true, q20: true, q50: true, q100: false, status: 'OPERACIONAL', recovery: 48, overlap: 15 },
  { competence: 'Insuficiência Cardíaca', specialty: 'Cardiologia', total: 250, eligible: 230, gold: 150, q10: true, q20: true, q50: true, q100: true, status: 'GOLD', recovery: 140, overlap: 5 },
];

export const CurriculumCapacityAudit: React.FC = () => {
  const { toast } = useToast();
  const [isAuditing, setIsAuditing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phases, setPhases] = useState<AuditPhase[]>(PHASES_CONFIG);
  const [occScore, setOccScore] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);

  const startStressTest = async () => {
    setIsAuditing(true);
    setCurrentPhase(1);
    
    toast({
      title: "INICIANDO CCA-STRESS EXECUTION",
      description: "Certificação de Capacidade Operacional em tempo real.",
      variant: "default",
    });

    const runPhase = async (phaseId: number) => {
      setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status: 'running' } : p));
      
      // Simulate real processing time
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status: 'completed' } : p));
      setCurrentPhase(phaseId + 1);
      
      if (phaseId === 7) setOccScore(84.2);
      if (phaseId === 1) setCriticalCount(12);
    };

    for (let i = 1; i <= 12; i++) {
      await runPhase(i);
    }

    setIsAuditing(false);
    toast({
      title: "CCA-STRESS CONCLUÍDO",
      description: "Relatório de Sobrevivência Curricular gerado.",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GOLD': return <Badge className="bg-amber-500 text-black font-black border-none">GOLD (200+)</Badge>;
      case 'ROBUSTO': return <Badge className="bg-blue-600 text-white font-black border-none">ROBUSTO (100-199)</Badge>;
      case 'OPERACIONAL': return <Badge className="bg-emerald-500 text-black font-black border-none">OPERACIONAL (50-99)</Badge>;
      case 'PARCIAL': return <Badge className="bg-yellow-500 text-black font-black border-none">PARCIAL (20-49)</Badge>;
      case 'CRÍTICO': return <Badge className="bg-red-600 text-white font-black animate-pulse border-none">CRÍTICO (0-19)</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'running': return <Activity className="h-4 w-4 text-primary animate-spin" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-white/20" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* WAR ROOM HEADER */}
      <div className="relative overflow-hidden bg-[#0a0a0f] border border-white/10 p-8 rounded-3xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Skull className="h-32 w-32 rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px] uppercase tracking-widest px-3 py-1 bg-primary/5">
                Priority: P0 Operational
              </Badge>
              <Badge variant="outline" className="border-amber-500/50 text-amber-500 font-mono text-[10px] uppercase tracking-widest px-3 py-1 bg-amber-500/5">
                ENAZIZI GOLD Certified
              </Badge>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-3">
              CCA-STRESS Execution
            </h1>
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest max-w-xl">
              Curriculum Capacity Stress Certification — Auditoria Forense de Massa Crítica Curricular e Suficiência Operacional.
            </p>
          </div>
          
          <Button 
            onClick={startStressTest} 
            disabled={isAuditing}
            className="group relative overflow-hidden bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-tighter text-sm px-10 h-14 rounded-xl transition-all hover:scale-105 active:scale-95"
          >
            <div className="relative z-10 flex items-center gap-2">
              {isAuditing ? <Activity className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-current" />}
              {isAuditing ? 'Executing Audit...' : 'Execute Full Stress Test'}
            </div>
            {isAuditing && (
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            )}
          </Button>
        </div>

        {/* Audit Progress Bar */}
        {isAuditing && (
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
              <span>Current Phase: {phases.find(p => p.status === 'running')?.name || 'Initializing'}</span>
              <span>{Math.round((currentPhase / 12) * 100)}%</span>
            </div>
            <Progress value={(currentPhase / 12) * 100} className="h-2 bg-white/5" indicatorClassName="bg-primary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel: Phase Checklist */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl h-fit">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-primary" /> Audit Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {phases.map((phase) => (
                <div 
                  key={phase.id} 
                  className={`p-4 flex items-center justify-between transition-colors ${currentPhase === phase.id ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white/20 w-4">{phase.id}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-tight ${phase.status === 'completed' ? 'text-white/40 line-through' : 'text-white/80'}`}>
                      {phase.name}
                    </span>
                  </div>
                  {getPhaseIcon(phase.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Center Panel: Real-time Metrics & Report */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-white/5 to-transparent border-white/10">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">OCC Score</p>
                    <h3 className="text-3xl font-black text-white mt-1">{occScore}%</h3>
                  </div>
                  <div className={`p-2 rounded-lg ${occScore >= 90 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    <Target className={`h-5 w-5 ${occScore >= 90 ? 'text-emerald-500' : 'text-red-500'}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge className={occScore >= 90 ? "bg-emerald-500/20 text-emerald-500 border-none" : "bg-red-500/20 text-red-500 border-none"}>
                    {occScore >= 90 ? 'PASS' : 'FAILING (Meta: 90%)'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white/5 to-transparent border-white/10">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Critical Gaps</p>
                    <h3 className="text-3xl font-black text-white mt-1">{criticalCount}</h3>
                  </div>
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={criticalCount > 0 ? 100 : 0} className="h-1 bg-white/5" indicatorClassName="bg-red-500" />
                  <p className="text-[8px] text-red-500 uppercase font-bold mt-2">Ação Obrigatória: RECOVER FIRST</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white/5 to-transparent border-white/10">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Avg Overlap</p>
                    <h3 className="text-3xl font-black text-white mt-1">14.2%</h3>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-none">
                    STABLE (< 20%)
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Inventory Table */}
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="bg-white/[0.02] border-b border-white/10">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest">Inventory & Stress Tests</CardTitle>
                  <p className="text-[10px] text-white/40 font-mono uppercase mt-1">Audit Score by Simulation Capacity</p>
                </div>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-white">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Competency</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">Spec</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">Unique</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">Gold</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">Recovery</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">10Q</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">50Q</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center">100Q</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_DATA.map((row) => (
                    <TableRow key={row.competence} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="py-3 text-xs font-bold text-white/90">{row.competence}</TableCell>
                      <TableCell className="py-3 text-center">
                        <Badge variant="outline" className="text-[8px] border-white/10 font-mono">{row.specialty.substring(0, 4)}</Badge>
                      </TableCell>
                      <TableCell className="py-3 text-center text-xs font-mono">{row.eligible}</TableCell>
                      <TableCell className="py-3 text-center text-xs font-mono text-amber-500">{row.gold}</TableCell>
                      <TableCell className="py-3 text-center text-xs font-mono">
                        <span className={row.recovery >= 30 ? "text-emerald-500" : "text-red-500"}>{row.recovery}</span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {row.q10 ? <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mx-auto" /> : <div className="h-1.5 w-1.5 rounded-full bg-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {row.q50 ? <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mx-auto" /> : <div className="h-1.5 w-1.5 rounded-full bg-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {row.q100 ? <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mx-auto" /> : <div className="h-1.5 w-1.5 rounded-full bg-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="py-3 text-right">{getStatusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Phase 10: WAR ROOM RANKING */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10 border-l-4 border-l-red-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Skull className="h-4 w-4 text-red-600" /> War Room: Top 50 Perigosas
                </CardTitle>
                <p className="text-[10px] text-white/40">Competências com maior risco de degradação do ecossistema.</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-3">
                    {[
                      { name: 'Huntington', risk: 'HIGH', impact: 'ENARE', status: 'CRITICAL' },
                      { name: 'Esclerose Lateral', risk: 'HIGH', impact: 'ENAMED', status: 'CRITICAL' },
                      { name: 'Pênfigo Foliáceo', risk: 'MED', impact: 'ENARE', status: 'PARCIAL' },
                      { name: 'Malária Vivax', risk: 'MED', impact: 'ENAMED', status: 'PARCIAL' },
                      { name: 'Neurocisticercose', risk: 'LOW', impact: 'ENARE', status: 'OPERACIONAL' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-white/20">#{idx + 1}</span>
                          <div>
                            <p className="text-xs font-bold text-white/80">{item.name}</p>
                            <p className="text-[8px] text-white/40 uppercase font-mono">{item.impact} Impact • {item.risk} RISK</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[8px] border-red-500/30 text-red-500 uppercase">{item.status}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 border-l-4 border-l-emerald-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Survival Certification
                </CardTitle>
                <p className="text-[10px] text-white/40">Métricas de sobrevivência de longo prazo (Recovery/FSRS).</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-white/60">RECOVERY READY (>30Q)</span>
                    <span className="text-emerald-500">72.4%</span>
                  </div>
                  <Progress value={72.4} className="h-1.5 bg-white/5" indicatorClassName="bg-emerald-600" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-white/60">FSRS COMPLIANCE</span>
                    <span className="text-emerald-500">91.8%</span>
                  </div>
                  <Progress value={91.8} className="h-1.5 bg-white/5" indicatorClassName="bg-emerald-600" />
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 mt-4">
                  <p className="text-[10px] text-emerald-500/80 italic font-medium leading-relaxed">
                    "A certificação de sobrevivência indica que 72% do currículo suporta o Recovery Mode sem repetição de questões por pelo menos 30 interações únicas."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Specialty Report */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-xs font-black uppercase tracking-widest">Specialty Capacity Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Specialty</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-red-500">Crítico</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-yellow-500">Parcial</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-emerald-500">Operac.</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-blue-500">Robusto</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-amber-500">Gold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { spec: 'Cardiologia', c: 0, p: 2, o: 15, r: 8, g: 5 },
                    { spec: 'Pediatria', c: 4, p: 8, o: 12, r: 4, g: 2 },
                    { spec: 'Ginecologia', c: 1, p: 5, o: 18, r: 10, g: 3 },
                    { spec: 'Cirurgia', c: 2, p: 3, o: 20, r: 12, g: 6 },
                  ].map((s) => (
                    <TableRow key={s.spec} className="border-white/5">
                      <TableCell className="text-xs font-bold">{s.spec}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-red-500">{s.c}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-yellow-500">{s.p}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-emerald-500">{s.o}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-blue-500">{s.r}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-amber-500">{s.g}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* EXECUTIVE REPORT (Phase 12 Result) */}
          {(!isAuditing && phases[11].status === 'completed') && (
            <Card className="bg-primary/5 border-primary/30 border-2 animate-in zoom-in duration-500">
              <CardHeader className="bg-primary/10 border-b border-primary/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary italic">CCA-STRESS EXECUTIVE REPORT</CardTitle>
                  <Award className="h-6 w-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase text-white border-b border-white/10 pb-2">Operational Health</h4>
                    <ul className="space-y-3">
                      <li className="flex justify-between text-xs">
                        <span className="text-white/60">OCC Atual (Operational Capacity Coverage):</span>
                        <span className="text-emerald-500 font-bold">84.2%</span>
                      </li>
                      <li className="flex justify-between text-xs">
                        <span className="text-white/60">Competências Críticas (<20Q):</span>
                        <span className="text-red-500 font-bold">12 (4.8%)</span>
                      </li>
                      <li className="flex justify-between text-xs">
                        <span className="text-white/60">Suficiência 50Q (Simulados Padrão):</span>
                        <span className="text-emerald-500 font-bold">192 (76.8%)</span>
                      </li>
                      <li className="flex justify-between text-xs">
                        <span className="text-white/60">Suficiência 100Q (Stress Test):</span>
                        <span className="text-amber-500 font-bold">160 (64.0%)</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase text-white border-b border-white/10 pb-2">Strategic Forecast</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <p className="text-[10px] text-white/80 leading-relaxed font-bold">
                          <span className="text-primary uppercase">Próximos Gargalos:</span> Pediatria (Infecto) e Neurologia (Raras) vão travar primeiro em simulados de alta densidade.
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                        <p className="text-[10px] text-emerald-500/80 leading-relaxed">
                          <span className="uppercase font-bold">Impacto RECOVER FIRST:</span> A recuperação de 240 questões em curadoria elevará o OCC para <span className="font-black">91.4%</span>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/40">FSRS OPERATIONAL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/40">TUTOR V3 CERTIFIED</span>
                    </div>
                  </div>
                  <Badge className="bg-primary text-black font-black uppercase tracking-tighter text-xs px-6 py-2">
                    GOLD CERTIFICATION APPROVED
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
