import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, ArrowRight, AlertCircle, RefreshCcw } from "lucide-react";

export function AdaptivePathwaysLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["adaptive-path-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_path_logs")
        .select(`
          id,
          trigger_reason,
          adjustment_type,
          created_at,
          original_node:knowledge_nodes!original_path_node_id(name),
          new_node:knowledge_nodes!new_path_node_id(name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Rastreando caminhos adaptativos...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          Adaptive Clinical Pathways — Reroteamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {logs?.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-8">
            Nenhum reroteamento automático necessário até o momento.
          </div>
        ) : (
          <div className="space-y-3">
            {logs?.map((log: any) => (
              <div key={log.id} className="flex flex-col p-3 rounded-lg border bg-muted/30 gap-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {log.adjustment_type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[10px] text-muted-foreground uppercase">De</span>
                    <span className="text-sm font-medium">{log.original_node?.name || 'Início'}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[10px] text-primary uppercase">Para</span>
                    <span className="text-sm font-bold text-primary">{log.new_node?.name}</span>
                  </div>
                </div>

                <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mt-0.5 text-amber-500" />
                  <span>Razão: {log.trigger_reason}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
