import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";
import { telemetry, type TelemetryEventName } from "@/lib/pedagogicalTelemetry";
import { toast } from "sonner";

const EXPECTED_EVENTS: TelemetryEventName[] = [
  "dashboard_opened",
  "continuar_clicked",
  "revisoes_clicked",
  "hero_cta_clicked",
  "study_session_started",
  "first_question_loaded",
  "first_answer_submitted",
  "study_session_completed",
  "study_session_abandoned",
  "tutor_opened",
  "tutor_message_sent",
  "tutor_response_received",
  "tutor_memory_reused",
  "analytics_opened",
  // Fase A: módulos de estudo
  "plantao_opened",
  "plantao_completed",
  "anamnese_opened",
  "anamnese_completed",
  "simulado_opened",
  "simulado_completed",
  "flashcard_opened",
  "flashcard_completed",
  "mnemonic_opened",
  "practical_exam_opened",
  "practical_exam_completed",
];

type Row = { event_name: string; total: number; last_seen: string | null };
type DupRow = { session_id: string; event_name: string; cnt: number };

export function TelemetryHealthCheck() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [dups, setDups] = useState<DupRow[]>([]);
  const [days, setDays] = useState(7);
  const [running, setRunning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Fetch in batches via paginated select to avoid the 1000-row cap
      const counts = new Map<string, { total: number; last: string | null }>();
      const sessionDupMap = new Map<string, number>();

      let from = 0;
      const PAGE = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("telemetry_events")
          .select("event_name,timestamp,session_id")
          .gte("timestamp", since)
          .order("timestamp", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          const cur = counts.get(r.event_name) ?? { total: 0, last: null };
          cur.total += 1;
          if (!cur.last || r.timestamp > cur.last) cur.last = r.timestamp;
          counts.set(r.event_name, cur);
          const k = `${r.session_id}|${r.event_name}`;
          sessionDupMap.set(k, (sessionDupMap.get(k) ?? 0) + 1);
        }
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 20000) break; // safety
      }

      const allNames = new Set<string>([...EXPECTED_EVENTS, ...counts.keys()]);
      const out: Row[] = Array.from(allNames).map((name) => ({
        event_name: name,
        total: counts.get(name)?.total ?? 0,
        last_seen: counts.get(name)?.last ?? null,
      })).sort((a, b) => b.total - a.total);

      const dupList: DupRow[] = [];
      sessionDupMap.forEach((cnt, key) => {
        if (cnt > 5) {
          const [session_id, event_name] = key.split("|");
          dupList.push({ session_id, event_name, cnt });
        }
      });
      dupList.sort((a, b) => b.cnt - a.cnt);

      setRows(out);
      setDups(dupList.slice(0, 20));
    } catch (e: any) {
      toast.error("Falha ao carregar health check", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runFunnelTest = async () => {
    setRunning(true);
    try {
      const sequence: TelemetryEventName[] = [
        "dashboard_opened",
        "hero_cta_clicked",
        "continuar_clicked",
        "study_session_started",
        "first_question_loaded",
        "first_answer_submitted",
        "study_session_completed",
        "tutor_opened",
        "tutor_message_sent",
        "tutor_response_received",
        "analytics_opened",
        "revisoes_clicked",
      ];
      for (const ev of sequence) {
        await telemetry.track(ev, { source: "health_check_test", test_session: telemetry.getSessionId() });
      }
      toast.success(`Disparados ${sequence.length} eventos de teste`);
      // Aguarda flush automático + buffer
      await new Promise((r) => setTimeout(r, 9000));
      await fetchData();
    } catch (e: any) {
      toast.error("Teste falhou", { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const missing = rows.filter((r) => EXPECTED_EVENTS.includes(r.event_name as TelemetryEventName) && r.total === 0);
  const present = rows.filter((r) => EXPECTED_EVENTS.includes(r.event_name as TelemetryEventName) && r.total > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Health Check da Telemetria</h3>
          <p className="text-sm text-muted-foreground">Janela: últimos {days} dias</p>
        </div>
        <div className="flex gap-2">
          <select
            className="bg-background border rounded-md px-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>1 dia</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={runFunnelTest} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Rodar teste de funil
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Eventos esperados presentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-green-500">{present.length} / {EXPECTED_EVENTS.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ausentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-red-500">{missing.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sessões com possível duplicidade</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{dups.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contagem por evento</CardTitle>
          <CardDescription>Inclui esperados e quaisquer outros recebidos</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Status</th>
                    <th>Evento</th>
                    <th>Total</th>
                    <th>Último recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expected = EXPECTED_EVENTS.includes(r.event_name as TelemetryEventName);
                    const ok = r.total > 0;
                    return (
                      <tr key={r.event_name} className="border-b border-border/50">
                        <td className="py-2">
                          {ok ? (
                            <Badge variant="outline" className="border-green-500/40 text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                            </Badge>
                          ) : expected ? (
                            <Badge variant="outline" className="border-red-500/40 text-red-600">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Ausente
                            </Badge>
                          ) : (
                            <Badge variant="outline">extra</Badge>
                          )}
                        </td>
                        <td className="font-mono text-xs">{r.event_name}</td>
                        <td className="font-semibold">{r.total}</td>
                        <td className="text-muted-foreground text-xs">
                          {r.last_seen ? new Date(r.last_seen).toLocaleString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {dups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top duplicidades por sessão (&gt;5 do mesmo evento)</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th className="py-2">Sessão</th><th>Evento</th><th>Ocorrências</th></tr></thead>
              <tbody>
                {dups.map((d, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="font-mono text-xs py-1">{d.session_id.slice(0, 8)}…</td>
                    <td className="font-mono text-xs">{d.event_name}</td>
                    <td className="font-semibold">{d.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
