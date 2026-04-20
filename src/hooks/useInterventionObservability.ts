/**
 * useInterventionObservability — Fase 7 (read-only)
 * ──────────────────────────────────────────────────
 * Agrega telemetria real do Intervention Engine em janelas (1d/7d/14d/30d):
 *
 * Fontes:
 *   - alert_events (source = "intervention")
 *   - intervention_penalties (estado atual)
 *   - intervention_user_profiles (sinal individual)
 *
 * Não escreve em lugar nenhum, não muta engine.
 * Defensivo: erros viram dataset vazio + flag `error`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ObservabilityWindow = "1d" | "7d" | "14d" | "30d";
export type WinningReason =
  | "mandatory"
  | "base"
  | "adaptive"
  | "penalty"
  | "profile"
  | "mixed";

export interface InterventionObservabilityRow {
  type: string;
  exposed: number;
  clicked: number;
  resolved: number;
  ctr: number;
  conversionRate: number;
  sharePct: number;
}

export interface ProfileSignalGroup {
  group: "profile-driven" | "penalty-driven" | "mandatory-driven" | "neutral-driven";
  count: number;
  pct: number;
}

export interface InterventionObservability {
  window: ObservabilityWindow;
  totalExposed: number;
  totalClicked: number;
  totalResolved: number;
  ctrGlobal: number;
  conversionGlobal: number;
  byType: InterventionObservabilityRow[];
  byWinningReason: Array<{ reason: WinningReason | "unknown"; count: number; pct: number }>;
  byProfileSignal: ProfileSignalGroup[];
  mandatoryIntegrity: {
    casesWithMandatory: number;
    mandatoryWins: number;
    integrityPct: number;
    violations: number;
  };
  penaltyStats: {
    activePenalties: number;
    appliedExposures: number;
    resetClicks: number;
    mostPenalizedType: string | null;
  };
  profileStats: {
    nonZeroProfileDelta: number;
    positiveProfileDelta: number;
    strongIndividualHits: number;
    topPromotedTypes: Array<{ type: string; count: number }>;
  };
  alerts: ObservabilityAlert[];
  loading: boolean;
  error: string | null;
}

export interface ObservabilityAlert {
  id: string;
  level: "warn" | "critical" | "info";
  message: string;
}

const WINDOW_DAYS: Record<ObservabilityWindow, number> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

interface RawEvent {
  event_type: string;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

interface RawPenalty {
  user_id: string;
  intervention_type: string;
  penalty_level: number;
  penalty_until: string | null;
}

function mNum(meta: Record<string, unknown> | null | undefined, key: string): number {
  const v = meta?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function mStr(meta: Record<string, unknown> | null | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}
function mBool(meta: Record<string, unknown> | null | undefined, key: string): boolean {
  return meta?.[key] === true;
}

async function fetchObservability(
  window: ObservabilityWindow
): Promise<InterventionObservability> {
  const days = WINDOW_DAYS[window];
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const empty: InterventionObservability = {
    window,
    totalExposed: 0,
    totalClicked: 0,
    totalResolved: 0,
    ctrGlobal: 0,
    conversionGlobal: 0,
    byType: [],
    byWinningReason: [],
    byProfileSignal: [],
    mandatoryIntegrity: {
      casesWithMandatory: 0,
      mandatoryWins: 0,
      integrityPct: 100,
      violations: 0,
    },
    penaltyStats: {
      activePenalties: 0,
      appliedExposures: 0,
      resetClicks: 0,
      mostPenalizedType: null,
    },
    profileStats: {
      nonZeroProfileDelta: 0,
      positiveProfileDelta: 0,
      strongIndividualHits: 0,
      topPromotedTypes: [],
    },
    alerts: [],
    loading: false,
    error: null,
  };

  try {
    // 1) eventos do período
    const { data: rawEvents, error: evErr } = await supabase
      .from("alert_events")
      .select("event_type, metadata, user_id, created_at")
      .eq("source", "intervention")
      .gte("created_at", sinceIso)
      .limit(10_000);

    if (evErr) throw evErr;
    const events = (rawEvents ?? []) as unknown as RawEvent[];

    // 2) penalties ativas (estado atual, não filtra por janela)
    const nowIso = new Date().toISOString();
    const { data: rawPen } = await supabase
      .from("intervention_penalties")
      .select("user_id, intervention_type, penalty_level, penalty_until")
      .or(`penalty_until.is.null,penalty_until.gt.${nowIso}`)
      .gt("penalty_level", 0)
      .limit(5000);
    const penalties = (rawPen ?? []) as unknown as RawPenalty[];

    // ─── agregação ────────────────────────────────────────────────────────
    const byTypeMap = new Map<
      string,
      { exposed: number; clicked: number; resolved: number }
    >();
    const reasonCounts = new Map<string, number>();
    const promotedByProfile = new Map<string, number>();

    let casesWithMandatory = 0;
    let mandatoryWins = 0;
    let appliedExposures = 0;
    let resetClicks = 0;
    let nonZeroProfileDelta = 0;
    let positiveProfileDelta = 0;
    let strongIndividualHits = 0;
    let profileDriven = 0;
    let penaltyDriven = 0;
    let mandatoryDriven = 0;
    let neutralDriven = 0;

    for (const ev of events) {
      const meta = ev.metadata ?? {};
      const actionType = mStr(meta, "actionType") || "unknown";
      const bucket = byTypeMap.get(actionType) ?? {
        exposed: 0,
        clicked: 0,
        resolved: 0,
      };
      if (ev.event_type === "exposed") bucket.exposed++;
      else if (ev.event_type === "clicked") bucket.clicked++;
      else if (ev.event_type === "resolved") bucket.resolved++;
      byTypeMap.set(actionType, bucket);

      // só agregamos sinais de decisão no `exposed`
      if (ev.event_type !== "exposed") {
        if (ev.event_type === "clicked" && mBool(meta, "penaltyApplied")) {
          resetClicks++;
        }
        continue;
      }

      const mandatory = mBool(meta, "mandatory");
      const profileDelta = mNum(meta, "profileDelta");
      const penaltyApplied = mBool(meta, "penaltyApplied");
      const profileReason = mStr(meta, "profileReason");
      const wonBy = mStr(meta, "wonBy");

      if (mandatory) {
        mandatoryDriven++;
        casesWithMandatory++;
        mandatoryWins++; // expostas mandatórias = vitórias mandatórias
      } else if (profileDelta > 0) {
        profileDriven++;
      } else if (penaltyApplied) {
        penaltyDriven++;
      } else {
        neutralDriven++;
      }

      if (penaltyApplied) appliedExposures++;
      if (profileDelta !== 0) nonZeroProfileDelta++;
      if (profileDelta > 0) {
        positiveProfileDelta++;
        promotedByProfile.set(
          actionType,
          (promotedByProfile.get(actionType) ?? 0) + 1
        );
      }
      if (profileReason === "strong-individual-preference") {
        strongIndividualHits++;
      }

      const reasonKey = wonBy || "unknown";
      reasonCounts.set(reasonKey, (reasonCounts.get(reasonKey) ?? 0) + 1);
    }

    // ─── totals & rows ────────────────────────────────────────────────────
    let totalExposed = 0;
    let totalClicked = 0;
    let totalResolved = 0;
    for (const b of byTypeMap.values()) {
      totalExposed += b.exposed;
      totalClicked += b.clicked;
      totalResolved += b.resolved;
    }

    const byType: InterventionObservabilityRow[] = Array.from(
      byTypeMap.entries()
    )
      .map(([type, b]) => ({
        type,
        exposed: b.exposed,
        clicked: b.clicked,
        resolved: b.resolved,
        ctr: b.exposed > 0 ? b.clicked / b.exposed : 0,
        conversionRate: b.clicked > 0 ? b.resolved / b.clicked : 0,
        sharePct: totalExposed > 0 ? (b.exposed / totalExposed) * 100 : 0,
      }))
      .sort((a, b) => b.exposed - a.exposed);

    const totalDecisions = mandatoryDriven + profileDriven + penaltyDriven + neutralDriven;
    const byProfileSignal: ProfileSignalGroup[] = (
      [
        ["profile-driven", profileDriven],
        ["penalty-driven", penaltyDriven],
        ["mandatory-driven", mandatoryDriven],
        ["neutral-driven", neutralDriven],
      ] as const
    ).map(([group, count]) => ({
      group,
      count,
      pct: totalDecisions > 0 ? (count / totalDecisions) * 100 : 0,
    }));

    const reasonTotal = Array.from(reasonCounts.values()).reduce(
      (s, n) => s + n,
      0
    );
    const byWinningReason = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason: reason as WinningReason | "unknown",
        count,
        pct: reasonTotal > 0 ? (count / reasonTotal) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // penalty stats
    let mostPenalizedType: string | null = null;
    if (penalties.length > 0) {
      const counter = new Map<string, number>();
      for (const p of penalties) {
        counter.set(
          p.intervention_type,
          (counter.get(p.intervention_type) ?? 0) + 1
        );
      }
      let max = -1;
      for (const [t, c] of counter) {
        if (c > max) {
          max = c;
          mostPenalizedType = t;
        }
      }
    }

    const topPromotedTypes = Array.from(promotedByProfile.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ─── alertas automáticos ──────────────────────────────────────────────
    const alerts: ObservabilityAlert[] = [];
    const dominator = byType.find((r) => r.sharePct >= 45);
    if (dominator && totalExposed >= 20) {
      alerts.push({
        id: "dominance",
        level: "warn",
        message: `Dominância excessiva: ${dominator.type} = ${dominator.sharePct.toFixed(1)}% das escolhas em ${window}.`,
      });
    }
    if ((window === "14d" || window === "30d") && totalExposed >= 50) {
      const dead = byType.find((r) => r.sharePct < 2);
      if (dead) {
        alerts.push({
          id: `dead-${dead.type}`,
          level: "warn",
          message: `Tipo praticamente morto: ${dead.type} = ${dead.sharePct.toFixed(1)}% em ${window}.`,
        });
      }
    }
    const profileReason = byWinningReason.find((r) => r.reason === "profile");
    if (totalDecisions >= 30 && (!profileReason || profileReason.pct < 5)) {
      alerts.push({
        id: "weak-profile",
        level: "info",
        message: `Personalização fraca: profile decidiu apenas ${(profileReason?.pct ?? 0).toFixed(1)}% das escolhas.`,
      });
    }
    const integrityPct =
      casesWithMandatory > 0 ? (mandatoryWins / casesWithMandatory) * 100 : 100;
    if (casesWithMandatory > 0 && integrityPct < 100) {
      alerts.push({
        id: "mandatory-violation",
        level: "critical",
        message: `Violação crítica: integridade mandatory = ${integrityPct.toFixed(1)}%.`,
      });
    }
    if (appliedExposures >= 20 && resetClicks / Math.max(appliedExposures, 1) < 0.05) {
      alerts.push({
        id: "penalty-stale",
        level: "warn",
        message: `Penalty excessiva ou pouco efetiva: ${appliedExposures} exposições com penalty, apenas ${resetClicks} resets.`,
      });
    }
    const coverage = byType.find((r) => r.type === "coverage");
    if (totalExposed >= 50 && coverage && coverage.sharePct < 3) {
      alerts.push({
        id: "coverage-underused",
        level: "info",
        message: `Coverage subutilizado: ${coverage.sharePct.toFixed(1)}% em ${window}.`,
      });
    }

    return {
      window,
      totalExposed,
      totalClicked,
      totalResolved,
      ctrGlobal: totalExposed > 0 ? totalClicked / totalExposed : 0,
      conversionGlobal: totalClicked > 0 ? totalResolved / totalClicked : 0,
      byType,
      byWinningReason,
      byProfileSignal,
      mandatoryIntegrity: {
        casesWithMandatory,
        mandatoryWins,
        integrityPct,
        violations: Math.max(0, casesWithMandatory - mandatoryWins),
      },
      penaltyStats: {
        activePenalties: penalties.length,
        appliedExposures,
        resetClicks,
        mostPenalizedType,
      },
      profileStats: {
        nonZeroProfileDelta,
        positiveProfileDelta,
        strongIndividualHits,
        topPromotedTypes,
      },
      alerts,
      loading: false,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.warn("[useInterventionObservability] failed:", msg);
    return { ...empty, error: msg };
  }
}

export function useInterventionObservability(window: ObservabilityWindow) {
  const q = useQuery({
    queryKey: ["intervention-observability", window],
    queryFn: () => fetchObservability(window),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return {
    data: q.data,
    isLoading: q.isLoading,
    error: q.error ? String(q.error) : q.data?.error ?? null,
    refetch: q.refetch,
  };
}
