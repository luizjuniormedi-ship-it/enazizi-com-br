import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function CMEAudit() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['cme-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cme_audit_logs')
        .select('*, aggregation:cme_session_aggregations(*)')
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
    <div className="container mx-auto py-8">
      <header className="mb-8">
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
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Data</TableHead>
                  <TableHead className="text-zinc-400">Ação</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Sessão Origem</TableHead>
                  <TableHead className="text-zinc-400">Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="text-zinc-300">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium text-white">{log.action}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.aggregation?.status)}
                        <Badge variant="outline" className="capitalize">
                          {log.aggregation?.status || 'unknown'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {log.aggregation_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {log.user_id?.slice(0, 8)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
