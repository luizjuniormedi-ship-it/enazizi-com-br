import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Brain, ShieldCheck, AlertCircle, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const ExecutiveOverview: React.FC = () => {
    const { data: stats } = useQuery({
        queryKey: ['executive-summary'],
        queryFn: async () => {
            const { data: scores } = await supabase.from('approval_scores').select('score').limit(100);
            const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const { data: costs } = await supabase.from('ai_cost_metrics' as any).select('cost_usd').limit(30);
            
            return {
                avgApproval: scores?.reduce((a, b) => a + (b.score || 0), 0) / (scores?.length || 1),
                totalUsers: users || 0,
                estimatedCost: costs?.reduce((a, b) => a + (b.cost_usd || 0), 0) || 0
            };
        }
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            PREDICTED APPROVAL RATE
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white italic">
                            {(stats?.avgApproval || 0).toFixed(1)}%
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Current cohort health</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3 h-3 text-blue-500" />
                            ACTIVE STUDENTS
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white italic">
                            {stats?.totalUsers || 0}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Learning now</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Brain className="w-3 h-3 text-purple-500" />
                            AI QUALITY (GOV)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white italic">
                            98.2<span className="text-purple-500">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Pedagogical drift</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        COGNITIVE GROWTH CURVE (30D)
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                            { day: '1', score: 60 },
                            { day: '5', score: 62 },
                            { day: '10', score: 68 },
                            { day: '15', score: 75 },
                            { day: '20', score: 82 },
                            { day: '25', score: 88 },
                            { day: '30', score: 91 }
                        ]}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                itemStyle={{ color: '#10b981', fontSize: '10px' }}
                            />
                            <Area type="monotone" dataKey="score" stroke="#10b981" fillOpacity={1} fill="url(#colorScore)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};
