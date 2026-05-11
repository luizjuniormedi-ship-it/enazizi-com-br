import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Search } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];

export const ErrorIntelligence: React.FC = () => {
  const { data: errorPatterns } = useQuery({
    queryKey: ['error-patterns-forensic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_bank')
        .select('tema, categoria_erro');
      
      if (error) throw error;

      const categoryCounts: Record<string, number> = {};
      const topicCounts: Record<string, number> = {};

      data.forEach(err => {
        if (err.categoria_erro) categoryCounts[err.categoria_erro] = (categoryCounts[err.categoria_erro] || 0) + 1;
        if (err.tema) topicCounts[err.tema] = (topicCounts[err.tema] || 0) + 1;
      });

      const categories = Object.entries(categoryCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const topics = Object.entries(topicCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      return { categories, topics };
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            ERROR CATEGORIES (FORENSIC)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={errorPatterns?.categories || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {errorPatterns?.categories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}
                itemStyle={{ color: '#f8fafc' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" />
            CRITICAL TEMAS (ERROR RECURRENCE)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={errorPatterns?.topics || []} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke="#475569" 
                fontSize={10} 
                width={120}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
