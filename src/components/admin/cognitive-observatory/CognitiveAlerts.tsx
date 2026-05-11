import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, Info, ShieldAlert, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

export const CognitiveAlerts: React.FC = () => {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['cognitive-operational-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_operational_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3 text-emerald-500" />
            Cognitive Alerts
          </div>
          <Badge variant="outline" className="text-[9px] border-slate-800 text-slate-500">
            {alerts?.length || 0} ACTIVE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-900/50 rounded" />)}
              </div>
            ) : alerts?.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                <p className="text-[10px] text-slate-600 uppercase font-mono tracking-widest">System Coherent • No Alerts</p>
              </div>
            ) : (
              alerts?.map((alert) => (
                <div key={alert.id} className="group relative border-l-2 border-slate-800 hover:border-emerald-500/50 pl-4 py-1 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.severity)}
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-600 font-mono">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {alert.message}
                  </p>
                  {(alert.metadata as any)?.context && (
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline" className="text-[8px] h-4 bg-slate-900/50 border-slate-800 text-slate-500">
                        {(alert.metadata as any).context}
                      </Badge>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
