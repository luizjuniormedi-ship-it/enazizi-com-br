/**
 * AlertOrchestratorDebug — painel admin de inspeção do orchestrator
 * ─────────────────────────────────────────────────────────────────
 * Lista todos os alertas (visíveis e suprimidos) com decisões e origem.
 * Atualizado na Fase 2 para mostrar `legacyOrigin`, `viaBridge` e
 * `reasonSuppressed` (alias humano de `suppressedBy`).
 *
 * Não exibido ao aluno final — apenas em rotas admin.
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

function humanizeSuppression(raw?: string): string {
  if (!raw) return "—";
  if (raw.startsWith("dedupe:")) return `dedupe (vencedor: ${raw.replace("dedupe:", "")})`;
  if (raw === "structural-cap") return "cap de structural (≤2)";
  if (raw === "contextual-cap") return "cap de contextual (≤2)";
  if (raw === "deep-cap") return "cap de deep (≤1)";
  if (raw === "critical-structural-active") return "critical structural ativo";
  return raw;
}

export default function AlertOrchestratorDebug() {
  const { allAlerts, structuralAlerts, contextualAlerts, ephemeralAlerts, deepAlerts } =
    useAlertOrchestrator();

  const visibleCount = allAlerts.filter((a) => a.visible).length;
  const suppressedCount = allAlerts.length - visibleCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Alert Orchestrator — árvore de decisão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">Estrutural</div>
            <div className="text-2xl font-bold">{structuralAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">Contextual</div>
            <div className="text-2xl font-bold">{contextualAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">Ephemeral</div>
            <div className="text-2xl font-bold">{ephemeralAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">Deep</div>
            <div className="text-2xl font-bold">{deepAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">Total candidatos</div>
            <div className="text-2xl font-bold">{allAlerts.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wide">Suprimidos</div>
            <div className="text-2xl font-bold">{suppressedCount}</div>
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Source</th>
                <th className="p-2">Prioridade</th>
                <th className="p-2">Camada</th>
                <th className="p-2">Visível</th>
                <th className="p-2">Origem</th>
                <th className="p-2">Bridge</th>
                <th className="p-2">Dedupe key</th>
                <th className="p-2">Motivo da supressão</th>
              </tr>
            </thead>
            <tbody>
              {allAlerts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    Nenhum alerta candidato no momento.
                  </td>
                </tr>
              )}
              {allAlerts.map((a) => (
                <tr key={`${a.id}-${a.suppressedBy ?? "v"}`} className="border-t">
                  <td className="p-2 font-mono">{a.source}</td>
                  <td className="p-2">
                    <Badge variant={PRIORITY_VARIANT[a.priority]}>{a.priority}</Badge>
                  </td>
                  <td className="p-2">{a.layer}</td>
                  <td className="p-2">
                    {a.visible ? (
                      <Badge variant="default">sim</Badge>
                    ) : (
                      <Badge variant="outline">não</Badge>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">{a.legacyOrigin ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{a.viaBridge ? "sim" : "—"}</td>
                  <td className="p-2 font-mono text-muted-foreground">{a.dedupeKey ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">
                    {humanizeSuppression(a.suppressedBy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Fase 2:</strong> achievements e popups deep agora são gated via{" "}
          <code>getDecision("achievement")</code> / <code>getDecision("onboarding-popup")</code>.
          Família <code>Smart*</code> marcada como <code>@deprecated</code> (sem renderização ativa).
        </div>
      </CardContent>
    </Card>
  );
}
