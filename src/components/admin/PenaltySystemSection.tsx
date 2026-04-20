/**
 * PenaltySystemSection — Memória de Intervenção (Fase 5)
 * ───────────────────────────────────────────────────────
 * Sub-bloco read-only do painel admin que mostra penalidades ativas
 * e taxa de recuperação por tipo de intervenção.
 *
 * Fontes:
 *   - `intervention_penalties` (admin RLS já permite SELECT total)
 *   - `alert_events` (source = "intervention") — para taxa de recuperação
 *
 * Defensivo: erros viram "sem dados", nunca quebra o painel.
 */
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LEVEL_WEIGHT_DELTA } from "@/lib/interventionPenaltyUpdater";

const TYPE_LABEL: Record<string, string> = {
  "min-mission": "🚨 Missão destrava",
  fsrs: "📚 Revisões FSRS",
  recovery: "📉 Recuperação",
  coverage: "🔥 Cobertura",
  default: "🟢 Default",
  unknown: "❔ Desconhecido",
};

interface PenaltyRow {
  intervention_type: string;
  penalty_level: number;
  penalty_until: string | null;
  user_id: string;
}

interface AggregatedPenalty {
  type: string;
  activeUsers: number;
  avgLevel: number;
  avgRemainingHours: number;
  maxLevel: number;
}

interface RecoveryRow {
  type: string;
  exposed: number;
  clicked: number;
  recoveryRate: number; // clicked / exposed (heurística)
}

async function fetchActivePenalties(): Promise<AggregatedPenalty[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("intervention_penalties")
    .select("intervention_type, penalty_level, penalty_until, user_id")
    .gt("penalty_level", 0)
    .gt("penalty_until", nowIso)
    .limit(5000);

  if (error) {
    console.warn("[PenaltySystemSection] read failed:", error.message);
    return [];
  }

  const buckets = new Map<
    string,
    { users: Set<string>; levels: number[]; remainingMs: number[] }
  >();
  const now = Date.now();
  for (const r of (data ?? []) as PenaltyRow[]) {
    const b =
      buckets.get(r.intervention_type) ??
      { users: new Set<string>(), levels: [], remainingMs: [] };
    b.users.add(r.user_id);
    b.levels.push(r.penalty_level);
    if (r.penalty_until) {
      const until = new Date(r.penalty_until).getTime();
      if (Number.isFinite(until)) {
        b.remainingMs.push(Math.max(0, until - now));
      }
    }
    buckets.set(r.intervention_type, b);
  }

  return Array.from(buckets.entries())
    .map(([type, v]) => {
      const avgLevel =
        v.levels.reduce((s, x) => s + x, 0) / Math.max(1, v.levels.length);
      const avgRemainingHours =
        v.remainingMs.reduce((s, x) => s + x, 0) /
        Math.max(1, v.remainingMs.length) /
        (1000 * 60 * 60);
      return {
        type,
        activeUsers: v.users.size,
        avgLevel,
        avgRemainingHours,
        maxLevel: Math.max(...v.levels),
      };
    })
    .sort((a, b) => b.activeUsers - a.activeUsers);
}

async function fetchRecoveryRates(windowDays = 14): Promise<RecoveryRow[]> {
  const sinceIso = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("alert_events")
    .select("event_type, metadata")
    .eq("source", "intervention")
    .gte("created_at", sinceIso)
    .limit(5000);

  if (error) {
    console.warn("[PenaltySystemSection] recovery read failed:", error.message);
    return [];
  }

  const buckets = new Map<string, { exposed: number; clicked: number }>();
  for (const r of (data ?? []) as { event_type: string; metadata: unknown }[]) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const type =
      (typeof meta.actionType === "string" && meta.actionType) ||
      (typeof (meta as { action_type?: string }).action_type === "string"
        ? (meta as { action_type?: string }).action_type
        : null);
    if (!type) continue;
    const b = buckets.get(type) ?? { exposed: 0, clicked: 0 };
    if (r.event_type === "exposed") b.exposed++;
    else if (r.event_type === "clicked") b.clicked++;
    buckets.set(type, b);
  }

  return Array.from(buckets.entries())
    .map(([type, v]) => ({
      type,
      exposed: v.exposed,
      clicked: v.clicked,
      recoveryRate: v.exposed > 0 ? v.clicked / v.exposed : 0,
    }))
    .sort((a, b) => b.recoveryRate - a.recoveryRate);
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default function PenaltySystemSection() {
  const { data: penalties, isLoading: loadingPenalties } = useQuery({
    queryKey: ["intervention-penalties-admin"],
    queryFn: fetchActivePenalties,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: recovery, isLoading: loadingRecovery } = useQuery({
    queryKey: ["intervention-recovery-rates"],
    queryFn: () => fetchRecoveryRates(14),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const isLoading = loadingPenalties || loadingRecovery;
  const empty = !penalties || penalties.length === 0;

  const mostPenalized = penalties && penalties.length > 0 ? penalties[0] : null;
  const mostRecovered =
    recovery && recovery.length > 0
      ? recovery.find((r) => r.exposed >= 5) ?? null
      : null;

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Penalty System (Fase 5)</div>
        <Badge variant="outline" className="text-[10px]">
          read-only
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Carregando penalidades…
        </div>
      ) : empty ? (
        <div className="text-xs text-muted-foreground py-4 text-center italic">
          Nenhuma penalidade ativa no momento. Sistema operando como V2.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                Mais penalizado
              </div>
              {mostPenalized ? (
                <div>
                  <div className="text-sm font-medium">
                    {TYPE_LABEL[mostPenalized.type] ?? mostPenalized.type}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    {mostPenalized.activeUsers}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    usuários · nível médio {mostPenalized.avgLevel.toFixed(1)}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">—</div>
              )}
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Maior taxa de recuperação (14d)
              </div>
              {mostRecovered ? (
                <div>
                  <div className="text-sm font-medium">
                    {TYPE_LABEL[mostRecovered.type] ?? mostRecovered.type}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    {fmtPct(mostRecovered.recoveryRate)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {mostRecovered.clicked} cliques / {mostRecovered.exposed}{" "}
                    exposições
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  Sem amostra suficiente
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Usuários ativos</TableHead>
                  <TableHead className="text-right">Nível médio</TableHead>
                  <TableHead className="text-right">Δ peso</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Tempo restante
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {penalties.map((p) => {
                  const delta =
                    LEVEL_WEIGHT_DELTA[Math.round(p.avgLevel)] ?? 0;
                  return (
                    <TableRow key={`pen-${p.type}`}>
                      <TableCell className="font-medium">
                        {TYPE_LABEL[p.type] ?? p.type}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.activeUsers}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.avgLevel.toFixed(2)}
                        <Badge
                          variant="outline"
                          className="ml-1 text-[9px] px-1 py-0"
                        >
                          max {p.maxLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono text-destructive">
                        {delta}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtHours(p.avgRemainingHours)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
