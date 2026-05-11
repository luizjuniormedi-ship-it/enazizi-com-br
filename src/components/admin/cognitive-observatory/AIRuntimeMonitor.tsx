import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, Zap, Activity, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const AIRuntimeMonitor: React.FC = () => {
  const { data: logs } = useQuery({
    queryKey: ['ai-runtime-observability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_runtime_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: health } = useQuery({
    queryKey: ['ai-provider-health-forensic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_provider_health')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {health?.map((provider) => (
          <Card key={provider.provider} className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{provider.provider}</p>
                  <p className="text-lg font-mono text-slate-200 uppercase">{provider.status}</p>
                </div>
                <Activity className={`w-4 h-4 ${provider.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${provider.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  style={{ width: `${provider.latency_ms ? Math.min(100, (1000 / provider.latency_ms) * 100) : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-500" />
            LIVE AI RUNTIME LOGS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-500 text-[10px] uppercase">Task</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase">Model</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase">Latency</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase">Fallback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id} className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell className="font-mono text-xs text-slate-300">{log.task_type}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">{log.model}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">{log.latency_ms}ms</TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "default" : "destructive"} className="text-[9px] h-5">
                      {log.success ? 'SUCCESS' : 'ERROR'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.fallback_used && (
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
