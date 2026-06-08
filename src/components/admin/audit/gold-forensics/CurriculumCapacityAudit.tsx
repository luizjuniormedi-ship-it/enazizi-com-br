import React, { useState } from 'react';
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
  ShieldAlert
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

interface CompetencyAudit {
  competence: string;
  total: number;
  eligible: number;
  q10: boolean;
  q20: boolean;
  q50: boolean;
  q100: boolean;
  status: 'GOLD' | 'AMARELO' | 'CRÍTICO' | 'OPERACIONAL' | 'ROBUSTO';
  score: number;
}

const MOCK_DATA: CompetencyAudit[] = [
  { competence: 'IAM com Supra', total: 180, eligible: 165, q10: true, q20: true, q50: true, q100: true, status: 'GOLD', score: 220 },
  { competence: 'TEP', total: 42, eligible: 38, q10: true, q20: true, q50: false, q100: false, status: 'AMARELO', score: 42 },
  { competence: 'Sepse', total: 21, eligible: 20, q10: true, q20: true, q50: false, q100: false, status: 'AMARELO', score: 21 },
  { competence: 'Miastenia Gravis', total: 5, eligible: 5, q10: false, q20: false, q50: false, q100: false, status: 'CRÍTICO', score: 5 },
  { competence: 'Pneumonia Comunitária', total: 110, eligible: 95, q10: true, q20: true, q50: true, q100: false, status: 'OPERACIONAL', score: 110 },
  { competence: 'Insuficiência Cardíaca', total: 250, eligible: 230, q10: true, q20: true, q50: true, q100: true, status: 'GOLD', score: 250 },
];

export const CurriculumCapacityAudit: React.FC = () => {
  const { toast } = useToast();
  const [isAuditing, setIsAuditing] = useState(false);
  const [progress, setProgress] = useState(0);

  const startAudit = () => {
    setIsAuditing(true);
    setProgress(0);
    toast({
      title: "Iniciando CCA Audit",
      description: "Curriculum Capacity Audit: Mapeando suficiência operacional...",
    });

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAuditing(false);
          toast({
            title: "Auditoria CCA Concluída",
            description: "Mapa Nacional de Capacidade Curricular gerado.",
          });
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GOLD': return <Badge className="bg-amber-500 text-black font-black">GOLD (200+)</Badge>;
      case 'ROBUSTO': return <Badge className="bg-emerald-600 text-white font-black">PREMIUM (100-199)</Badge>;
      case 'OPERACIONAL': return <Badge className="bg-emerald-500 text-black font-black">VERDE (50-99)</Badge>;
      case 'AMARELO': return <Badge className="bg-yellow-500 text-black font-black">AMARELO (20-49)</Badge>;
      case 'CRÍTICO': return <Badge className="bg-red-600 text-white font-black animate-pulse">CRÍTICO (0-19)</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getSuccessIcon = (success: boolean) => {
    return success ? 
      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : 
      <XCircle className="h-4 w-4 text-red-500 mx-auto" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* CCA Header Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/5 border border-white/10 p-5 rounded-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
            <LayoutGrid className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white italic">CCA — Curriculum Capacity Audit</h3>
            <p className="text-[10px] text-white/40 uppercase font-mono mt-1">Auditando: Suficiência Operacional do Ecossistema (Simulados/Tutor/FSRS)</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {isAuditing && (
            <div className="flex-1 md:w-48 space-y-2">
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-primary/60">
                <span>Calculando Densidade Curricular</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1 bg-white/5" indicatorClassName="bg-primary" />
            </div>
          )}
          <Button 
            onClick={startAudit} 
            disabled={isAuditing}
            className="w-full md:w-auto bg-primary hover:bg-primary/80 text-black font-black uppercase tracking-widest text-[10px] px-8 h-10"
          >
            {isAuditing ? 'Auditando...' : 'Executar CCA Full Audit'}
          </Button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl group hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Database className="h-3 w-3 text-blue-400" /> Operacionalidade Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div className="text-2xl font-black text-white">84.2%</div>
              <div className="text-[10px] font-mono text-emerald-500 mb-1">+2.4% vs D-7</div>
            </div>
            <Progress value={84.2} className="h-1 mt-3 bg-white/5" indicatorClassName="bg-blue-400" />
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl group hover:border-red-500/30 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="h-3 w-3 text-red-500" /> Competências Críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div className="text-2xl font-black text-white">12</div>
              <div className="text-[10px] font-mono text-red-500 mb-1">Ação Necessária</div>
            </div>
            <div className="flex gap-1 mt-3">
              {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-1 flex-1 bg-red-500/50 rounded-full" />)}
              {[1, 2, 3].map(i => <div key={i} className="h-1 flex-1 bg-white/10 rounded-full" />)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl group hover:border-amber-500/30 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Target className="h-3 w-3 text-amber-500" /> Overlap de Simulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div className="text-2xl font-black text-white">14.2%</div>
              <div className="text-[10px] font-mono text-emerald-500 mb-1">Meta: &lt;20%</div>
            </div>
            <Progress value={14.2} className="h-1 mt-3 bg-white/5" indicatorClassName="bg-amber-500" />
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl group hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-3 w-3 text-primary" /> Tutor Readiness Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div className="text-2xl font-black text-white">91.8</div>
              <div className="text-[10px] font-mono text-primary mb-1">Elite</div>
            </div>
            <Progress value={91.8} className="h-1 mt-3 bg-white/5" indicatorClassName="bg-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Main Table Section */}
      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <CardHeader className="border-b border-white/10 bg-white/[0.02]">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Relatório de Capacidade Curricular
              </CardTitle>
              <CardDescription className="text-[10px] text-white/40">Visão por Competência • Teste Real de Stress (10Q–100Q)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 border-white/10 text-[9px] font-black uppercase tracking-widest bg-white/5">
                <Filter className="h-3 w-3 mr-2" /> Filtrar Especialidade
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10">Competência</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-center">Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-center">Elegíveis</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-center">10Q</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-center">20Q</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-center">50Q</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-center">100Q</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 text-right">Status CCS-OP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_DATA.map((item) => (
                <TableRow key={item.competence} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                  <TableCell className="py-3 text-xs font-bold text-white/80">{item.competence}</TableCell>
                  <TableCell className="py-3 text-center text-xs font-mono">{item.total}</TableCell>
                  <TableCell className="py-3 text-center text-xs font-mono">{item.eligible}</TableCell>
                  <TableCell className="py-3 text-center">{getSuccessIcon(item.q10)}</TableCell>
                  <TableCell className="py-3 text-center">{getSuccessIcon(item.q20)}</TableCell>
                  <TableCell className="py-3 text-center">{getSuccessIcon(item.q50)}</TableCell>
                  <TableCell className="py-3 text-center">{getSuccessIcon(item.q100)}</TableCell>
                  <TableCell className="py-3 text-right">{getStatusBadge(item.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Logic Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" /> Pontos de Travamento (Bottlenecks)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-[10px] text-white/80 leading-relaxed font-bold">
                ⚠️ <span className="text-red-500 uppercase">Alerta de Inviabilidade:</span> Miastenia Gravis, Huntington e Esclerose Lateral estão com volume &lt; 20 questões. O Tutor V3 vai repetir conteúdo após 2 sessões.
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[10px] text-white/80 leading-relaxed">
                📢 <span className="text-amber-500 uppercase font-black">Recomendação:</span> Direcionar o Motor de Geração para 4 competências de Pediatria que não suportam simulados de 50Q.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl border-l-4 border-l-emerald-500">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Capacidade de Escalonamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-white/40 leading-relaxed uppercase font-mono">
              O ecossistema GOLD atual suporta 1.200 simulados simultâneos de 50 questões com overlap inferior a 15% em 82% do currículo. A rede de segurança (SILVER) garante redundância para os outros 18%.
            </p>
            <div className="mt-4 flex gap-4">
              <div className="flex-1 text-center p-2 rounded-lg bg-white/5">
                <div className="text-xl font-black text-emerald-500">92%</div>
                <div className="text-[8px] text-white/40 uppercase mt-1">Suficiência 10Q</div>
              </div>
              <div className="flex-1 text-center p-2 rounded-lg bg-white/5">
                <div className="text-xl font-black text-amber-500">76%</div>
                <div className="text-[8px] text-white/40 uppercase mt-1">Suficiência 50Q</div>
              </div>
              <div className="flex-1 text-center p-2 rounded-lg bg-white/5">
                <div className="text-xl font-black text-blue-500">64%</div>
                <div className="text-[8px] text-white/40 uppercase mt-1">Suficiência 100Q</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
