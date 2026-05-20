import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, Zap, Brain, ShieldAlert, History } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export const AIRoutingObservatory: React.FC = () => {
  const { data: decisions } = useQuery({
    queryKey: ['ai-routing-decisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_routing_decisions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000 // Poll every 5s
  });

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Map className="w-3 h-3 text-blue-500" />
          Semantic AI Routing Decisions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-500 text-[10px] uppercase">Time</TableHead>
              <TableHead className="text-slate-500 text-[10px] uppercase">Task / State</TableHead>
              <TableHead className="text-slate-500 text-[10px] uppercase">Selected Model</TableHead>
              <TableHead className="text-slate-500 text-[10px] uppercase">Reasoning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions?.map((dec: any) => (
              <TableRow key={dec.id} className="border-slate-800 hover:bg-slate-900/50">
                <TableCell className="text-[10px] text-slate-500 font-mono">
                  {formatDistanceToNow(new Date(dec.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="text-[8px] border-blue-500/20 text-blue-400 w-fit">
                      {dec.task_type || 'GENERAL'}
                    </Badge>
                    <span className="text-[9px] text-slate-500 font-mono italic">
                      State: {dec.cognitive_state || 'UNKNOWN'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[10px] text-emerald-400">
                  {dec.selected_model}
                </TableCell>
                <TableCell className="text-[10px] text-slate-400 italic">
                  {dec.routing_reason}
                </TableCell>
              </TableRow>
            ))}
            {decisions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-600 text-[10px] uppercase font-mono">
                  No routing decisions recorded yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
