import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function CMEAudit() {
  const navigate = useNavigate();
  const { data: logs, isLoading } = useQuery({
    queryKey: ['cme-aggregation-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cme_session_aggregation_summary')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'builder_ready': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Auditoria CME Cinematic Factory</h1>
        <p className="text-muted-foreground">Monitoramento do pipeline de agregação e geração de videoaulas.</p>
      </header>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Logs de Processamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Data</TableHead>
                  <TableHead className="text-zinc-400">Projeto</TableHead>
                  <TableHead className="text-zinc-400">Aggregation Status</TableHead>
                  <TableHead className="text-zinc-400">Render Status</TableHead>
                  <TableHead className="text-zinc-400">Capítulos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer" onClick={() => log.id && navigate(`/admin/cinematic-builder/${log.id}`)}>
                    <TableCell className="text-zinc-300">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium text-white">
                      {log.title || 'Sem título'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.aggregation_status)}
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {log.aggregation_status || 'unknown'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.render_status ? (
                        <Badge className={cn(
                          "capitalize text-[10px]",
                          log.render_status === 'ready' ? "bg-green-500/20 text-green-500" : 
                          log.render_status === 'failed' ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                        )}>
                          {log.render_status}
                        </Badge>
                      ) : (
                        <span className="text-zinc-600 text-[10px]">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-xs">
                      {log.blocks_count || 0} capítulos
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Auditoria de Elegibilidade (Tutor IA)</CardTitle>
        </CardHeader>
        <CardContent>
          <EligibilityTable />
        </CardContent>
      </Card>
    </div>
  );
}

function EligibilityTable() {
  const { data: eligibilityLogs, isLoading } = useQuery({
    queryKey: ['cme-eligibility-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cme_generation_eligibility_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="text-zinc-400">Data</TableHead>
          <TableHead className="text-zinc-400">Status</TableHead>
          <TableHead className="text-zinc-400">Score</TableHead>
          <TableHead className="text-zinc-400">Motivo de Rejeição</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {eligibilityLogs?.map((log) => (
          <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/30">
            <TableCell className="text-zinc-300">
              {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
            </TableCell>
            <TableCell>
              <Badge variant={log.eligible ? "default" : "destructive"} className="text-[10px] uppercase font-bold">
                {log.eligible ? "Elegível" : "Inelegível"}
              </Badge>
            </TableCell>
            <TableCell className="text-zinc-300 font-mono text-xs">{log.structure_score?.toFixed(2) || '0.00'}</TableCell>
            <TableCell className="text-zinc-400 text-xs italic">{log.rejection_reason || '-'}</TableCell>
          </TableRow>
        ))}
        {(!eligibilityLogs || eligibilityLogs.length === 0) && (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-4 text-zinc-500 text-xs">Nenhum log de elegibilidade encontrado.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
