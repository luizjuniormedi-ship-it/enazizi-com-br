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
  const { data: sectorStats, isLoading: loadingSectors } = useQuery({
    queryKey: ['hospital-v5-sectors'],
    queryFn: async () => {
      const { data: patients, error } = await supabase
        .from('hospital_patients')
        .select('sector, current_status');
      
      if (error) throw error;

      const sectors = [
        { name: 'SALA VERMELHA', id: 'sala_vermelha', count: 0, capacity: 4, status: 'stable', color: '#ef4444' },
        { name: 'SALA LARANJA', id: 'sala_laranja', count: 0, capacity: 8, status: 'stable', color: '#f97316' },
        { name: 'SALA AMARELA', id: 'sala_amarela', count: 0, capacity: 15, status: 'stable', color: '#eab308' },
        { name: 'SALA VERDE', id: 'sala_verde', count: 0, capacity: 25, status: 'stable', color: '#10b981' },
        { name: 'UTI', id: 'uti', count: 0, capacity: 10, status: 'stable', color: '#ef4444' },
        { name: 'ENFERMARIA', id: 'enfermaria', count: 0, capacity: 40, status: 'stable', color: '#3b82f6' },
      ];

      patients?.forEach(p => {
        const sector = sectors.find(s => s.id === p.sector);
        if (sector) {
          sector.count++;
          if (p.current_status === 'critico' || p.current_status === 'grave') {
            sector.status = 'critical';
          }
        }
      });

      return sectors;
    }
  });

  // Q2: Tempos Porta-Resposta (Clocks)
  const { data: clinicalClocks } = useQuery({
    queryKey: ['hospital-v5-clocks'],
    queryFn: async () => {
      const { data: clocks } = await supabase
        .from('hospital_clinical_clocks')
        .select('*');
      
      if (!clocks || clocks.length === 0) {
        return [
          { label: 'Porta-ECG (Meta: 10min)', value: 8, target: 10, unit: 'min', success: true },
          { label: 'Porta-Trombolítico (Meta: 60min)', value: 52, target: 60, unit: 'min', success: true },
          { label: 'Porta-Antibiótico (Meta: 60min)', value: 78, target: 60, unit: 'min', success: false },
          { label: 'Tempo Porta-TC (Meta: 25min)', value: 34, target: 25, unit: 'min', success: false },
        ];
      }

      return clocks.map(c => ({
        label: `${c.clock_type} (Meta: ${c.target_minutes}min)`,
        value: c.current_minutes,
        target: c.target_minutes,
        unit: 'min',
        success: c.current_minutes <= c.target_minutes
      }));
    }
  });

  // Q3: Feed de Pacientes Reais
  const { data: realPatients } = useQuery({
    queryKey: ['hospital-v5-real-patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hospital_patients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const totalPatients = realPatients?.length || 0;
  const criticalCount = realPatients?.filter(p => p.current_status === 'critico').length || 0;

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
            <div className="text-4xl font-black text-white">{totalPatients}</div>
            <p className="text-[9px] text-white/30 font-mono mt-2 uppercase tracking-tighter">
              Pacientes reais sob monitoramento V5.9+
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
            <div className="text-4xl font-black text-red-500">{criticalCount.toString().padStart(2, '0')}</div>
            <p className="text-[9px] text-white/30 font-mono mt-2 uppercase tracking-tighter italic">
              "Priorize Sala Vermelha: {criticalCount} pacientes em estado crítico"
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
            {realPatients?.slice(0, 10).map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-4 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5">
                <div className="flex items-center gap-3 w-48 shrink-0">
                   <div className={`h-2 w-2 rounded-full ${p.current_status === 'critico' || p.current_status === 'grave' ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                   <span className="text-[11px] font-black uppercase">{p.name} ({p.age}a)</span>
                </div>
                <div className="w-32 text-[10px] font-bold text-white/40 uppercase shrink-0">{p.sector.replace('_', ' ')}</div>
                <div className="flex-1 text-[10px] text-amber-500 italic font-medium">{p.main_complaint}</div>
                <Badge variant="outline" className={`text-[8px] font-mono h-4 ${p.current_status === 'critico' ? 'text-red-500 border-red-500' : 'text-emerald-500'}`}>
                  {p.current_status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
