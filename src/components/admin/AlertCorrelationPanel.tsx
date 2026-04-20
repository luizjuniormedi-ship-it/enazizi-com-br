/**
 * AlertCorrelationPanel — correlação alerta crítico × approval_score
 * ───────────────────────────────────────────────────────────────────
 * Compara, na janela de 30 dias:
 *   - Grupo A: usuários que CLICARAM em algum alerta `critical`
 *   - Grupo B: usuários que foram EXPOSTOS mas NÃO clicaram
 *
 * Métrica reportada: delta médio do `approval_scores.score` entre o
 * primeiro e o último snapshot do usuário na janela.
 *
 * Não é ciência de dados — é uma agregação simples para sinalização.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GroupStats {
  users: number;
  avgDelta: number;
  improved: number;
  worsened: number;
}

interface CorrelationData {
  clickedGroup: GroupStats;
  ignoredGroup: GroupStats;
  windowDays: number;
}

function emptyGroup(): GroupStats {
  return { users: 0, avgDelta: 0, improved: 0, worsened: 0 };
}

async function computeCorrelation(): Promise<CorrelationData> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  // 1) Eventos de alertas críticos
  const { data: events } = await supabase
    .from("alert_events")
    .select("user_id,event_type,priority,created_at")
    .eq("priority", "critical")
    .gte("created_at", sinceIso)
    .not("user_id", "is", null)
    .limit(10000);

  const exposedUsers = new Set<string>();
  const clickedUsers = new Set<string>();
  for (const e of events ?? []) {
    if (!e.user_id) continue;
    if (e.event_type === "exposed") exposedUsers.add(e.user_id);
    if (e.event_type === "clicked") clickedUsers.add(e.user_id);
  }

  // Grupo "ignorou" = exposto mas nunca clicou
  const ignoredUsers = new Set(
    [...exposedUsers].filter((u) => !clickedUsers.has(u))
  );
  // Grupo "clicou" = clicou pelo menos uma vez (também precisa ter sido exposto)
  const realClicked = new Set(
    [...clickedUsers].filter((u) => exposedUsers.has(u))
  );

  // 2) Snapshots de approval_scores na janela
  const userIds = [...new Set([...realClicked, ...ignoredUsers])];
  if (userIds.length === 0) {
    return {
      clickedGroup: emptyGroup(),
      ignoredGroup: emptyGroup(),
      windowDays: 30,
    };
  }

  const { data: scores } = await supabase
    .from("approval_scores")
    .select("user_id,score,updated_at")
    .in("user_id", userIds)
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: true })
    .limit(20000);

  // Agrupa por user_id
  const byUser = new Map<string, { first: number; last: number }>();
  for (const s of scores ?? []) {
    if (!s.user_id || s.score == null) continue;
    const cur = byUser.get(s.user_id);
    if (!cur) {
      byUser.set(s.user_id, { first: s.score, last: s.score });
    } else {
      cur.last = s.score;
    }
  }

  const groupStats = (set: Set<string>): GroupStats => {
    const deltas: number[] = [];
    let improved = 0;
    let worsened = 0;
    for (const uid of set) {
      const snap = byUser.get(uid);
      if (!snap) continue;
      const delta = snap.last - snap.first;
      deltas.push(delta);
      if (delta > 1) improved += 1;
      else if (delta < -1) worsened += 1;
    }
    const avgDelta =
      deltas.length > 0
        ? deltas.reduce((s, d) => s + d, 0) / deltas.length
        : 0;
    return {
      users: deltas.length,
      avgDelta: Math.round(avgDelta * 10) / 10,
      improved,
      worsened,
    };
  };

  return {
    clickedGroup: groupStats(realClicked),
    ignoredGroup: groupStats(ignoredUsers),
    windowDays: 30,
  };
}

export default function AlertCorrelationPanel() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await computeCorrelation();
        if (!cancelled) {
          setData(result);
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
          <TrendingUp className="h-4 w-4" />
          Correlação alertas críticos × approval_score (30d)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}
        {loading && (
          <div className="text-xs text-muted-foreground p-3">Calculando…</div>
        )}
        {!loading && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <GroupCard
                title="🟢 Clicaram em alerta crítico"
                stats={data.clickedGroup}
              />
              <GroupCard
                title="🔴 Ignoraram alerta crítico"
                stats={data.ignoredGroup}
              />
            </div>

            {data.clickedGroup.users > 0 && data.ignoredGroup.users > 0 && (
              <div className="text-xs bg-muted/50 border rounded-md p-2.5 flex items-center gap-2">
                <span className="text-muted-foreground">Clicaram:</span>
                <span className="font-mono tabular-nums">
                  {data.clickedGroup.avgDelta > 0 ? "+" : ""}
                  {data.clickedGroup.avgDelta} pts
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Ignoraram:</span>
                <span className="font-mono tabular-nums">
                  {data.ignoredGroup.avgDelta > 0 ? "+" : ""}
                  {data.ignoredGroup.avgDelta} pts
                </span>
                <span className="text-muted-foreground ml-auto">
                  Diferença:{" "}
                  <strong className="text-foreground">
                    {(
                      data.clickedGroup.avgDelta - data.ignoredGroup.avgDelta
                    ).toFixed(1)}{" "}
                    pts
                  </strong>
                </span>
              </div>
            )}
          </>
        )}

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          Compara delta médio de <code>approval_scores.score</code> (primeiro vs.
          último snapshot na janela) entre quem interagiu com alertas críticos e
          quem foi exposto mas ignorou. Não é causal, é sinalização.
        </div>
      </CardContent>
    </Card>
  );
}

function GroupCard({ title, stats }: { title: string; stats: GroupStats }) {
  return (
    <div className="border rounded-md p-3 space-y-1.5">
      <div className="text-xs font-medium">{title}</div>
      <div className="text-2xl font-bold tabular-nums">
        {stats.users === 0
          ? "—"
          : `${stats.avgDelta > 0 ? "+" : ""}${stats.avgDelta}`}
        <span className="text-xs font-normal text-muted-foreground ml-1">
          pts
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {stats.users} usuários • 📈 {stats.improved} melhoraram • 📉{" "}
        {stats.worsened} pioraram
      </div>
    </div>
  );
}
