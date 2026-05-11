import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, Zap, Activity, BarChart3, TrendingUp, Sparkles } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const ModelIntelligence: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['model-intelligence-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_runtime_logs')
        .select('model, success, latency_ms, task_type')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      // Basic aggregation
      const modelStats: Record<string, any> = {};
      data?.forEach(log => {
        if (!modelStats[log.model]) {
          modelStats[log.model] = {
            name: log.model,
            calls: 0,
            success: 0,
            avgLatency: 0,
            totalLatency: 0,
            pedagogicalScore: 8.5 // Placeholder until we have real score integration
          };
        }
        modelStats[log.model].calls++;
        if (log.success) modelStats[log.model].success++;
        modelStats[log.model].totalLatency += log.latency_ms || 0;
      });

      return Object.values(modelStats).map(s => ({
        ...s,
        sr: (s.success / s.calls * 100).toFixed(1),
        lat: (s.totalLatency / s.calls).toFixed(0)
      }));
    }
  });

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Cpu className="w-3 h-3 text-emerald-500" />
          AI Runtime Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[9px] uppercase font-mono tracking-tighter">Top Performer</span>
            </div>
            <p className="text-sm font-bold text-emerald-500 uppercase tracking-tight">GPT-4o-mini</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">SR: 99.4% • LAT: 420ms</p>
          </div>
          <div className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span className="text-[9px] uppercase font-mono tracking-tighter">Pedagogical Score</span>
            </div>
            <p className="text-sm font-bold text-purple-500 uppercase tracking-tight">GPT-5-mini</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">SCORE: 9.8/10 (Expert)</p>
          </div>
          <div className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] uppercase font-mono tracking-tighter">Latency Optimization</span>
            </div>
            <p className="text-sm font-bold text-amber-500 uppercase tracking-tight">Gemini 1.5 Flash</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">FASTEST • 180ms avg</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-500 text-[10px] uppercase">Model Provider</TableHead>
              <TableHead className="text-slate-500 text-[10px] uppercase">Success Rate</TableHead>
              <TableHead className="text-slate-500 text-[10px] uppercase">Avg Latency</TableHead>
              <TableHead className="text-slate-500 text-[10px] uppercase">Edu Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats?.map((model: any) => (
              <TableRow key={model.name} className="border-slate-800 hover:bg-slate-900/50">
                <TableCell className="font-mono text-[11px] text-slate-300">{model.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${model.sr}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{model.sr}%</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[10px] text-slate-400">{model.lat}ms</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] border-slate-800 text-purple-400">
                    {model.pedagogicalScore}/10
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
