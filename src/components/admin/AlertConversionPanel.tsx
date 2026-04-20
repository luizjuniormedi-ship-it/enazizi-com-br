/**
 * AlertConversionPanel — conversão alerta → ação real
 * ────────────────────────────────────────────────────
 * Mostra, para cada source que tem `resolved` registrado, a taxa de
 * conversão (resolved / exposed) e o tempo médio até resolução.
 *
 * Fonte: tabela `alert_events`, eventos `exposed` e `resolved`.
 * Read-only, sem amostragem — limita janela em 30 dias.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ConversionRow {
  source: string;
  exposed: number;
  resolved: number;
  conversionPct: number;
  avgTimeToResolveMs: number | null;
}

const TRACKED_SOURCES = [
  "exam-date",
  "fsrs-backlog",
  "inactivity",
  "approval-risk",
  "min-mission",
  "recovery",
];

const SOURCE_LABEL: Record<string, string> = {
  "exam-date": "Data da prova preenchida",
  "fsrs-backlog": "Backlog FSRS reduzido",
  inactivity: "Voltou a praticar",
  "approval-risk": "Saiu do risco alto",
  "min-mission": "Iniciou missão mínima",
  recovery: "Saiu do modo recuperação",
};

function fmtTime(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export default function AlertConversionPanel() {
  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 30);

        const { data, error: qErr } = await supabase
          .from("alert_events")
          .select("user_id,source,event_type,created_at")
          .in("source", TRACKED_SOURCES)
          .in("event_type", ["exposed", "resolved", "clicked"])
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true })
          .limit(10000);

        if (cancelled) return;
        if (qErr) {
          setError(qErr.message);
          setLoading(false);
          return;
        }

        const events = (data ?? []) as Array<{
          user_id: string | null;
          source: string;
          event_type: string;
          created_at: string;
        }>;

        const out: ConversionRow[] = [];
        for (const source of TRACKED_SOURCES) {
          const slice = events.filter((e) => e.source === source);
          // Usuários únicos expostos
          const exposedUsers = new Set(
            slice.filter((e) => e.event_type === "exposed").map((e) => e.user_id ?? "anon")
          );
          // Usuários únicos resolvidos OU clicados (para min-mission/recovery, "clicked" conta como conversão)
          const conversionEventType =
            source === "min-mission" || source === "recovery" ? "clicked" : "resolved";
          const convertedUsers = new Set(
            slice
              .filter((e) => e.event_type === conversionEventType)
              .map((e) => e.user_id ?? "anon")
          );
          const exposed = exposedUsers.size;
          const resolved = [...convertedUsers].filter((u) => exposedUsers.has(u)).length;

          // Tempo médio entre primeira exposição e primeira conversão por usuário
          let totalDelta = 0;
          let deltaCount = 0;
          for (const uid of convertedUsers) {
            if (!exposedUsers.has(uid)) continue;
            const userEvents = slice.filter((e) => (e.user_id ?? "anon") === uid);
            const firstExposed = userEvents.find((e) => e.event_type === "exposed");
            const firstConverted = userEvents.find(
              (e) => e.event_type === conversionEventType
            );
            if (!firstExposed || !firstConverted) continue;
            const delta =
              new Date(firstConverted.created_at).getTime() -
              new Date(firstExposed.created_at).getTime();
            if (delta > 0) {
              totalDelta += delta;
              deltaCount += 1;
            }
          }

          out.push({
            source,
            exposed,
            resolved,
            conversionPct: exposed > 0 ? (resolved / exposed) * 100 : 0,
            avgTimeToResolveMs: deltaCount > 0 ? totalDelta / deltaCount : null,
          });
        }

        if (!cancelled) {
          setRows(out);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Conversão por alerta (30d)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Source</th>
                <th className="p-2">Significado</th>
                <th className="p-2 text-right">Expostos</th>
                <th className="p-2 text-right">Convertidos</th>
                <th className="p-2 text-right">Conversão</th>
                <th className="p-2">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && rows.every((r) => r.exposed === 0) && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Nenhum alerta exposto ainda nesta janela.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.source} className="border-t">
                    <td className="p-2 font-mono">{r.source}</td>
                    <td className="p-2 text-muted-foreground">
                      {SOURCE_LABEL[r.source] ?? "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.exposed}</td>
                    <td className="p-2 text-right tabular-nums">{r.resolved}</td>
                    <td className="p-2 text-right">
                      {r.exposed > 0 ? (
                        <Badge
                          variant={
                            r.conversionPct >= 30
                              ? "default"
                              : r.conversionPct >= 10
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {r.conversionPct.toFixed(1)}%
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtTime(r.avgTimeToResolveMs)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          Para <code>min-mission</code> e <code>recovery</code> a conversão usa{" "}
          <code>clicked</code>; para os demais usa <code>resolved</code> (estado
          do usuário melhorou após exposição).
        </div>
      </CardContent>
    </Card>
  );
}
