import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Target, TrendingUp, Users } from 'lucide-react';

export const PerformanceAnalytics: React.FC = () => {
  const { data: performanceData } = useQuery({
    queryKey: ['cognitive-performance-forensic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_scores')
        .select('score, created_at')
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      return data.map(d => ({
        ...d,
        timestamp: new Date(d.created_at).toLocaleDateString()
      }));
    }
  });

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          TRI & PERFORMANCE EVOLUTION
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={performanceData || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="timestamp" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Legend verticalAlign="top" height={36}/>
            <Line 
              type="monotone" 
              dataKey="score" 
              name="Proficiency (TRI)"
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#020617' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
