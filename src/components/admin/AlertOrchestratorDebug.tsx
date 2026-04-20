/**
 * AlertOrchestratorDebug — painel admin de inspeção do orchestrator
 * ─────────────────────────────────────────────────────────────────
 * Lista todos os alertas (visíveis e suprimidos) com suas decisões,
 * para auditoria interna. Não é exibido ao aluno final.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAlertOrchestrator } from "@/hooks/useAlertOrchestrator";
import { Bell } from "lucide-react";

const PRIORITY_VARIANT: Record<
  string,
  "default" | "destructive" | "secondary" | "outline"
> = {
  critical: "destructive",
  important: "default",
  contextual: "secondary",
  informational: "outline",
};

export default function AlertOrchestratorDebug() {
  const { allAlerts, structuralAlerts, contextualAlerts } =
    useAlertOrchestrator();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Alert Orchestrator — árvore de decisão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">
              Estrutural
            </div>
            <div className="text-2xl font-bold">{structuralAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">
              Contextual
            </div>
            <div className="text-2xl font-bold">{contextualAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">
              Total candidatos
            </div>
            <div className="text-2xl font-bold">{allAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">
              Suprimidos
            </div>
            <div className="text-2xl font-bold">
              {allAlerts.filter((a) => !a.visible).length}
            </div>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Source</th>
                <th className="p-2">Prioridade</th>
                <th className="p-2">Camada</th>
                <th className="p-2">Visível</th>
                <th className="p-2">Dedupe key</th>
                <th className="p-2">Suprimido por</th>
              </tr>
            </thead>
            <tbody>
              {allAlerts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Nenhum alerta candidato no momento.
                  </td>
                </tr>
              )}
              {allAlerts.map((a) => (
                <tr key={`${a.id}-${a.suppressedBy ?? "v"}`} className="border-t">
                  <td className="p-2 font-mono">{a.source}</td>
                  <td className="p-2">
                    <Badge variant={PRIORITY_VARIANT[a.priority]}>
                      {a.priority}
                    </Badge>
                  </td>
                  <td className="p-2">{a.layer}</td>
                  <td className="p-2">
                    {a.visible ? (
                      <Badge variant="default">sim</Badge>
                    ) : (
                      <Badge variant="outline">não</Badge>
                    )}
                  </td>
                  <td className="p-2 font-mono text-muted-foreground">
                    {a.dedupeKey ?? "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {a.suppressedBy ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
