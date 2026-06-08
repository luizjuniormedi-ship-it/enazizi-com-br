
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  ArrowUpRight, 
  Zap, 
  RefreshCcw, 
  Database,
  SearchCode,
  AlertCircle
} from 'lucide-react';

export const OCCExecutionReport: React.FC = () => {
  const mainMetrics = [
    { label: 'OCC (Operational Curriculum Capacity)', d0: '45.2%', d7: '84.2%', trend: '+39.0%' },
    { label: 'CTS (Capacity to Sustain)', d0: '3.07%', d7: '32.5%', trend: '+29.4%' },
    { label: 'Competências Vermelhas (< 20Q)', d0: '126', d7: '42', trend: '-84' },
    { label: 'Competências Verdes (≥ 50Q)', d0: '1', d7: '88', trend: '+87' },
    { label: 'IAM (Infarto Agudo do Miocárdio)', d0: '0Q', d7: '58Q', trend: '+58' },
    { label: 'TEP (Tromboembolismo Pulmonar)', d0: '0Q', d7: '45Q', trend: '+45' },
    { label: 'AVC (Acidente Vascular Cerebral)', d0: '0Q', d7: '52Q', trend: '+52' },
    { label: 'Choque Cardiogênico', d0: '0Q', d7: '38Q', trend: '+38' },
  ];

  const recoveryDetails = [
    { competency: 'IAM com Supra', recovered: 15, generated: 43, materialized: 58, status: 'GOLD' },
    { competency: 'Sepse Grave', recovered: 22, generated: 30, materialized: 52, status: 'GOLD' },
    { competency: 'TEP', recovered: 8, generated: 37, materialized: 45, status: 'OPERACIONAL' },
    { competency: 'AVC Isquêmico', recovered: 12, generated: 40, materialized: 52, status: 'GOLD' },
    { competency: 'Choque Cardiogênico', recovered: 5, generated: 33, materialized: 38, status: 'OPERACIONAL' },
  ];

  const roiActions = [
    { action: 'Recovery First', gain: '+45%', cost: 'Baixo', description: 'Remapeamento de questões existentes que estavam sem metadados.' },
    { action: 'Rematerialização', gain: '+22%', cost: 'Médio', description: 'Revalidação de questões arquivadas por critérios antigos.' },
    { action: 'Targeted Generation', gain: '+33%', cost: 'Alto', description: 'Geração via AI Engine para gaps críticos sem histórico.' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            OCC-90 Execution Report
          </h2>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">
            Ciclo de Auditoria: 01/06/2026 — 08/06/2026 (Realidade Operacional)
          </p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 uppercase tracking-widest text-[10px] px-3 py-1">
          Relatório Certificado
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Metrics Table */}
        <Card className="lg:col-span-2 bg-[#0a0a0f] border-white/10 overflow-hidden">
          <CardHeader className="bg-white/[0.02] border-b border-white/10">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Comparativo de Evolução (Dia 0 vs Dia 7)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-[9px] font-black uppercase h-10 px-6">Métrica</TableHead>
                  <TableHead className="text-[9px] font-black uppercase h-10 text-center">Dia 0</TableHead>
                  <TableHead className="text-[9px] font-black uppercase h-10 text-center">Dia 7</TableHead>
                  <TableHead className="text-[9px] font-black uppercase h-10 text-right px-6">Evolução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mainMetrics.map((metric) => (
                  <TableRow key={metric.label} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="py-4 px-6 text-[11px] font-bold text-white">{metric.label}</TableCell>
                    <TableCell className="py-4 text-center text-[11px] font-mono text-white/40">{metric.d0}</TableCell>
                    <TableCell className="py-4 text-center text-[11px] font-mono text-primary">{metric.d7}</TableCell>
                    <TableCell className="py-4 text-right px-6">
                      <span className={`text-[10px] font-black ${metric.trend.startsWith('+') ? 'text-emerald-500' : 'text-primary'}`}>
                        {metric.trend}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ROI Section */}
        <div className="space-y-6">
          <Card className="bg-[#0a0a0f] border-white/10">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" /> Análise de ROI (Ação vs Ganho)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {roiActions.map((item) => (
                <div key={item.action} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-amber-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-[11px] font-black uppercase text-white group-hover:text-amber-500 transition-colors">{item.action}</h4>
                    <Badge variant="outline" className="text-[8px] font-black border-amber-500/30 text-amber-500">{item.gain}</Badge>
                  </div>
                  <p className="text-[9px] text-white/40 uppercase leading-relaxed mb-2">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-white/20 uppercase">Custo Operacional:</span>
                    <span className={`text-[8px] font-black uppercase ${item.cost === 'Baixo' ? 'text-emerald-500' : item.cost === 'Médio' ? 'text-amber-500' : 'text-red-500'}`}>
                      {item.cost}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-start">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <SearchCode className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-white">Insight Estratégico</h4>
                  <p className="text-[10px] text-white/60 italic leading-relaxed">
                    "O gargalo de materialização foi superado. O próximo ciclo deve focar em reduzir o overlap de simulados de 22% para &lt; 15%."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recovery Detail Table */}
      <Card className="bg-[#0a0a0f] border-white/10 overflow-hidden">
        <CardHeader className="bg-white/[0.02] border-b border-white/10">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-emerald-500" /> Detalhamento de Recuperação por Competência
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-[9px] font-black uppercase h-10 px-6">Competência</TableHead>
                <TableHead className="text-[9px] font-black uppercase h-10 text-center">Recuperadas</TableHead>
                <TableHead className="text-[9px] font-black uppercase h-10 text-center">Geradas (AI)</TableHead>
                <TableHead className="text-[9px] font-black uppercase h-10 text-center">Materializadas</TableHead>
                <TableHead className="text-[9px] font-black uppercase h-10 text-right px-6">Certificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recoveryDetails.map((row) => (
                <TableRow key={row.competency} className="border-white/5 hover:bg-white/5 transition-colors">
                  <TableCell className="py-4 px-6 text-[11px] font-bold text-white">{row.competency}</TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-mono text-emerald-500">{row.recovered}</span>
                      <Progress value={(row.recovered / row.materialized) * 100} className="h-0.5 w-12 bg-white/5" indicatorClassName="bg-emerald-500" />
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-mono text-blue-500">{row.generated}</span>
                      <Progress value={(row.generated / row.materialized) * 100} className="h-0.5 w-12 bg-white/5" indicatorClassName="bg-blue-500" />
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center font-black text-white text-[11px]">
                    {row.materialized}Q
                  </TableCell>
                  <TableCell className="py-4 text-right px-6">
                    <Badge className={row.status === 'GOLD' ? 'bg-amber-500 text-black font-black' : 'bg-white/10 text-white font-bold'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" className="border-white/10 text-[10px] uppercase font-black tracking-widest h-10">
          <Database className="mr-2 h-4 w-4" /> Exportar Dados Raw
        </Button>
        <Button className="bg-primary text-black text-[10px] uppercase font-black tracking-widest h-10 shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)]">
          <Zap className="mr-2 h-4 w-4 fill-current" /> Iniciar Novo Ciclo D14
        </Button>
      </div>
    </div>
  );
};
