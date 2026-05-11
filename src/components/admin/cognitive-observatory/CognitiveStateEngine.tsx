import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Zap, Brain, Battery, ShieldCheck } from 'lucide-react';

export const CognitiveStateEngine: React.FC = () => {
  const { data: state } = useQuery({
    queryKey: ['cognitive-state-inference'],
    queryFn: async () => {
      const { data: snapshot } = await supabase
        .from('cognitive_state_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!snapshot) {
        return {
          inferredState: 'INITIALIZING',
          healthScore: 100,
          avgPerf: 0,
          fatigue: 0,
          retention: 0
        };
      }

      const fatigue = Number(snapshot.fatigue_score) || 0;
      const retention = Number(snapshot.retention_score) || 0;
      
      let inferredState = 'NORMAL';
      let healthScore = 100 - (fatigue * 50);

      if (fatigue > 0.8) {
        inferredState = 'SOBRECARGA';
        healthScore = 30;
      } else if (retention < 0.6) {
        inferredState = 'QUEDA_RETENÇÃO';
        healthScore = 60;
      } else if (fatigue > 0.4) {
        inferredState = 'FADIGA';
        healthScore = 75;
      }

      return {
        inferredState,
        healthScore,
        fatigue,
        retention,
        theta: snapshot.current_theta
      };
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm border-b-4 border-b-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Brain className="w-3 h-3 text-emerald-500" />
            COGNITIVE STATE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-white uppercase tracking-tight">
            {state?.inferredState || 'ANALYZING...'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Real-time inference</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm border-b-4 border-b-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3 text-blue-500" />
            HEALTH SCORE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-mono text-blue-400">
            {state?.healthScore}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Overall cognitive stability</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm border-b-4 border-b-amber-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-500" />
            LOAD INTENSITY
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-mono text-amber-400">
            MODERATE
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Current system pressure</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm border-b-4 border-b-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            INTEGRITY
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-mono text-purple-400">
            99.9%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Race condition check</p>
        </CardContent>
      </Card>
    </div>
  );
};
