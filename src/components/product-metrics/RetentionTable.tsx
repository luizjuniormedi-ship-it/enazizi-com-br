import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRetentionRow } from "@/hooks/useProductMetrics";

interface Props {
  data: UserRetentionRow[];
}

export function RetentionTable({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.active_days - a.active_days);
  const top = sorted.slice(0, 20);

  const avgDays = data.length > 0
    ? Math.round(data.reduce((a, u) => a + u.active_days, 0) / data.length * 10) / 10
    : 0;
  const avgLoops = data.length > 0
    ? Math.round(data.reduce((a, u) => a + u.total_loops, 0) / data.length * 10) / 10
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Retenção de Usuários</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{data.length} usuários ativos</span>
            <span>Média: {avgDays} dias</span>
            <span>~{avgLoops} loops/user</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado de retenção disponível.
          </p>
        ) : (
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Usuário</th>
                  <th className="text-right py-2 font-medium">Dias ativos</th>
                  <th className="text-right py-2 font-medium">Loops</th>
                  <th className="text-right py-2 font-medium">Concluídos</th>
                  <th className="text-right py-2 font-medium">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {top.map((u) => (
                  <tr key={u.user_id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-1.5 font-mono text-[10px] text-muted-foreground">
                      {u.user_id.slice(0, 8)}…
                    </td>
                    <td className="text-right py-1.5 tabular-nums font-medium">{u.active_days}</td>
                    <td className="text-right py-1.5 tabular-nums">{u.total_loops}</td>
                    <td className="text-right py-1.5 tabular-nums">{u.total_completes}</td>
                    <td className="text-right py-1.5 text-muted-foreground">{u.last_active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
