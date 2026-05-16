import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const TutorQualityMonitor: React.FC = () => {
    const { data: logs } = useQuery({
        queryKey: ['tutor-quality-logs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ai_governance_logs')
                .select('*')
                .eq('incident_type', 'missing_block')
                .order('audited_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            return data;
        }
    });

    const { data: effectiveness } = useQuery({
        queryKey: ['tutor-effectiveness-summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tutor_effectiveness')
                .select('pedagogical_impact_score')
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return data;
        }
    });

    const avgScore = effectiveness && effectiveness.length > 0
        ? effectiveness.reduce((acc, curr) => acc + (curr.pedagogical_impact_score || 0), 0) / effectiveness.length
        : 0;

    return (
        <div className="space-y-6">
            <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3 text-emerald-500" />
                        PEDAGOGICAL QUALITY SCORE (AVG)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-3 mb-2">
                        <div className="text-4xl font-black italic text-white tracking-tighter">
                            {avgScore.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-emerald-500 font-mono mb-2">
                            {avgScore >= 90 ? 'ENTERPRISE READY' : avgScore >= 70 ? 'STABLE' : 'CRITICAL'}
                        </div>
                    </div>
                    <Progress value={avgScore} className="h-1 bg-slate-800" />
                </CardContent>
            </Card>

            <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert className="w-3 h-3 text-amber-500" />
                        RECENT QUALITY INCIDENTS
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {logs?.map((log) => (
                            <div key={log.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-start gap-3">
                                {log.severity === 'critical' ? (
                                    <XCircle className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-1 shrink-0" />
                                )}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-white uppercase">{log.model_name}</span>
                                        <span className="text-[8px] text-slate-500 font-mono">
                                            {new Date(log.audited_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Missing Blocks: {(log.details as any)?.missingBlocks?.join(', ') || 'N/A'}
                                    </p>
                                    <div className="text-[9px] font-mono text-slate-600">
                                        REQ_ID: {log.details?.requestId?.slice(0, 8)}...
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!logs || logs.length === 0) && (
                            <div className="text-center py-6 text-slate-600">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-[10px] uppercase font-mono tracking-widest">No quality drift detected</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
