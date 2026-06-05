import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building2, 
  Users, 
  Clock, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  Stethoscope, 
  Timer,
  Zap,
  ChevronRight,
  LayoutGrid,
  HeartPulse,
  Monitor
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export const HospitalVirtualV5: React.FC = () => {
  // Q1: Ocupação por Setor
  const { data: sectorStats } = useQuery({
    queryKey: ['hospital-v5-sectors'],
    queryFn: async () => {
      // Mocked realistic hospital data for V5
      return [
        { name: 'SALA VERMELHA', count: 2, capacity: 4, status: 'critical', color: '#ef4444' },
        { name: 'SALA LARANJA', count: 5, capacity: 8, status: 'warning', color: '#f97316' },
        { name: 'SALA AMARELA', count: 12, capacity: 15, status: 'stable', color: '#eab308' },
        { name: 'SALA VERDE', count: 18, capacity: 25, status: 'stable', color: '#10b981' },
        { name: 'UTI', count: 6, capacity: 10, status: 'critical', color: '#ef4444' },
        { name: 'ENFERMARIA', count: 32, capacity: 40, status: 'stable', color: '#3b82f6' },
      ];
    }
  });

  // Q2: Tempos Porta-Resposta (Clocks)
  const { data: clinicalClocks } = useQuery({
    queryKey: ['hospital-v5-clocks'],
    queryFn: async () => {
      return [
        { label: 'Porta-ECG (Meta: 10min)', value: 8, target: 10, unit: 'min', success: true },
        { label: 'Porta-Trombolítico (Meta: 60min)', value: 52, target: 60, unit: 'min', success: true },
        { label: 'Porta-Antibiótico (Meta: 60min)', value: 78, target: 60, unit: 'min', success: false },
        { label: 'Tempo Porta-TC (Meta: 25min)', value: 34, target: 25, unit: 'min', success: false },
      ];
    }
  });

  return (
    <div className="space-y-8 p-6 bg-[#050508] text-white min-h-screen">
      {/* Header V5 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary animate-pulse" />
            Hospital Virtual ENAZIZI V5
          </h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-1">
            Intelligent Multi-Patient Simulation • Real-time Clinical Engine
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[9px] px-3 py-1">
            Plantonista: Dr. Aluno
          </Badge>
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Duty Active
          </div>
        </div>
      </div>

      {/* Grid de Visão Geral do Hospital */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl relative overflow-hidden group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Users className="h-3 w-3 text-primary" /> Total de Pacientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-white">75</div>
            <p className="text-[9px] text-white/30 font-mono mt-2 uppercase tracking-tighter">
              Sob seus cuidados em 8 setores
            </p>
            <div className="mt-4 flex gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i < 8 ? 'bg-primary' : 'bg-white/5'}`} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-500" /> Alertas Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-red-500">03</div>
            <p className="text-[9px] text-white/30 font-mono mt-2 uppercase tracking-tighter italic">
              "Enfermeiro no ramal 402: Choque na Sala 2"
            </p>
            <Badge variant="outline" className="mt-4 border-red-500/30 text-red-500 text-[8px] animate-pulse">
              Ação Requerida Imediata
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Timer className="h-3 w-3 text-amber-400" /> Média Porta-Conduta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-amber-400">14.2m</div>
            <p className="text-[9px] text-white/30 font-mono mt-2 uppercase tracking-tighter">
              Eficiência de triagem e decisão
            </p>
            <Progress value={78} className="h-1 mt-4 bg-white/5" indicatorClassName="bg-amber-400" />
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-emerald-400" /> Segurança do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-emerald-400">92%</div>
            <p className="text-[9px] text-white/30 font-mono mt-2 uppercase tracking-tighter">
              Aderência a protocolos e escalas
            </p>
            <div className="mt-4 flex items-center gap-1 overflow-hidden h-1">
               <div className="h-full bg-emerald-500 w-[92%]" />
               <div className="h-full bg-red-500 w-[8%]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Central: Setores e Clocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa de Setores */}
        <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Painel de Ocupação Hospitalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sectorStats?.map((sector) => (
                <div key={sector.name} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-white/60">{sector.name}</span>
                    <Badge className={sector.status === 'critical' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'}>
                      {sector.count}/{sector.capacity}
                    </Badge>
                  </div>
                  <Progress value={(sector.count / sector.capacity) * 100} className="h-1 bg-white/5" />
                  <div className="flex items-center gap-2 text-[8px] font-bold text-white/30 uppercase tracking-tighter">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sector.color }} />
                    {sector.status === 'critical' ? 'Sobrecarga' : 'Operacional'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clocks Clínicos */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" /> Clinical Clocks Active
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {clinicalClocks?.map((clock, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/60 font-medium">{clock.label}</span>
                  <span className={`font-mono font-bold ${clock.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {clock.value}{clock.unit}
                  </span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${clock.success ? 'bg-emerald-500' : 'bg-red-500'}`} 
                    style={{ width: `${Math.min(100, (clock.value / clock.target) * 100)}%` }} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Footer: Multi-Patient Status Feed */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-xl border-l-4 border-l-primary">
        <CardHeader className="py-3">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <HeartPulse className="h-3 w-3 text-primary" /> Live Hospital Multi-Patient Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="space-y-2">
            {[
              { id: '102', patient: 'L.S. (67a)', sector: 'Sala Vermelha', status: 'Deteriorando', alert: 'Troponina (+) / PA 80/40' },
              { id: '204', patient: 'M.A. (42a)', sector: 'Sala Amarela', status: 'Estável', alert: 'Aguardando RX Tórax (ETA 12m)' },
              { id: '301', patient: 'J.C. (19a)', sector: 'Observação', status: 'Alta Pendente', alert: 'Revisar prescrição de saída' },
              { id: '105', patient: 'R.T. (75a)', sector: 'UTI', status: 'Grave', alert: 'Gaso: Acidose Metabólica Severa' },
            ].map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-4 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5">
                <div className="flex items-center gap-3 w-48 shrink-0">
                   <div className={`h-2 w-2 rounded-full ${p.status === 'Deteriorando' ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                   <span className="text-[11px] font-black uppercase">{p.patient}</span>
                   <Badge variant="outline" className="text-[8px] font-mono h-4">{p.id}</Badge>
                </div>
                <div className="w-32 text-[10px] font-bold text-white/40 uppercase shrink-0">{p.sector}</div>
                <div className="flex-1 text-[10px] text-amber-500 italic font-medium">{p.alert}</div>
                <ChevronRight className="h-3 w-3 text-white/10 hidden sm:block self-center" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
