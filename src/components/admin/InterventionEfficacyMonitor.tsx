import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

export function InterventionEfficacyMonitor() {
  const { data: efficacy, isLoading } = useQuery({
    queryKey: ["intervention-efficacy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_interventions")
        .select(`
          id,
          trigger_type,
          action_taken,
          post_intervention_outcome,
          friction_score_snapshot,
          created_at,
          status
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Carregando ciclo de aprendizado...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Closed Adaptive Loop — Monitor de Eficácia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Intervenção</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Resultado (ACE Learns)</TableHead>
                <TableHead>Fricção Inicial</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {efficacy?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.action_taken}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.trigger_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.post_intervention_outcome === "improved" && (
                        <Badge className="bg-emerald-500 gap-1">
                          <TrendingUp className="h-3 w-3" /> Melhora
                        </Badge>
                      )}
                      {item.post_intervention_outcome === "stagnant" && (
                        <Badge variant="secondary" className="gap-1">
                          <Minus className="h-3 w-3" /> Estável
                        </Badge>
                      )}
                      {item.post_intervention_outcome === "declined" && (
                        <Badge variant="destructive" className="gap-1">
                          <TrendingDown className="h-3 w-3" /> Queda
                        </Badge>
                      )}
                      {!item.post_intervention_outcome && (
                        <span className="text-xs text-muted-foreground italic">Em medição...</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {(item.friction_score_snapshot * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'accepted' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
