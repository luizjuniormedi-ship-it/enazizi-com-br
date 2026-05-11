import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export const FSRSInspector: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['fsrs-stats'],
    queryFn: async () => {
      const { data: cards, error: cardsError } = await supabase
        .from('fsrs_cards')
        .select('stability, difficulty, retrievability, last_review');
      
      if (cardsError) throw cardsError;

      const stabilityAvg = cards.reduce((acc, c) => acc + (Number(c.stability) || 0), 0) / (cards.length || 1);
      const difficultyAvg = cards.reduce((acc, c) => acc + (Number(c.difficulty) || 0), 0) / (cards.length || 1);
      const retrievabilityAvg = cards.reduce((acc, c) => acc + (Number(c.retrievability) || 0), 0) / (cards.length || 1);

      return {
        count: cards.length,
        stabilityAvg,
        difficultyAvg,
        retrievabilityAvg,
        cards: cards.slice(0, 50) // For simple chart
      };
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            FORGETTING CURVE & RETENTION
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats?.cards || []}>
              <defs>
                <linearGradient id="colorStability" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="last_review" hide />
              <YAxis stroke="#475569" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Area 
                type="monotone" 
                dataKey="retrievability" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorStability)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Avg Stability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono text-emerald-400">
              {stats?.stabilityAvg.toFixed(2)}
              <span className="text-xs text-slate-500 ml-2">days</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Expected time until forgetting</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Avg Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono text-amber-400">
              {stats?.difficultyAvg.toFixed(2)}
              <span className="text-xs text-slate-500 ml-2">/ 10</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Cognitive load indicator</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              Collapse Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono text-white">
              14%
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Users at risk of massive forgetting</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
