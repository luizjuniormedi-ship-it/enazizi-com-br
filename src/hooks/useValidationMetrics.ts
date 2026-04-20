/**
 * useValidationMetrics
 * ────────────────────
 * Agregador read-only para o painel admin /admin/validation.
 * Mede o impacto real do Study Engine V3.2 + Approval Prediction
 * usando apenas dados existentes (assistant_decisions, practice_attempts,
 * revisoes, daily_plan_tasks, profiles).
 *
 * Não escreve nada. Não altera o sistema. Defensivo a tabelas vazias.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApprovalBucketDist {
  high: number;   // 0–40
  medium: number; // 40–70
  low: number;    // 70–100
}

export interface ValidationMetrics {
  // Seção 1 — Visão Geral
  activeUsers: { d1: number; d7: number; d30: number };
  avgActivity: { questionsPerUser7d: number; reviewsPerUser7d: number };
  missions: { startRatePct: number; completionRatePct: number };

  // Seção 2 — Approval score
  approval: {
    sampleSize: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    buckets: ApprovalBucketDist;
    bucketsPct: ApprovalBucketDist;
  };

  // Seção 3 — Tendência
  trend: {
    upPct: number;
    stablePct: number;
    downPct: number;
    avgDelta: number; // média do delta (current - previous) por usuário
  };

  // Seção 4 — Risco
  risk: {
    highRiskPct: number;
    enteredHighRisk7d: number; // usuários
    leftHighRisk7d: number;    // usuários
  };

  // Seção 5 — Impacto do motor (últimos 7d)
  engineImpact: {
    approvalRiskBoosts: number;
    approvalDownBoosts: number;
    approvalLowBoosts: number;
    totalUsers: number;
    avgPerUser: number;
  };

  // Seção 6 — Comportamento real (high vs low risk)
  behavior: {
    highRisk: { qPerDay: number; rPerDay: number; missionCompletionPct: number; users: number };
    lowRisk:  { qPerDay: number; rPerDay: number; missionCompletionPct: number; users: number };
  };

  // Seção 7 — Antes vs Depois
  beforeAfter: {
    usersWithHistory: number;
    avgEvolution7d: number; // média (currentScore - oldScore7d) por usuário
    improvedPct: number;
    worsenedPct: number;
  };
}

const D1 = 1 * 86400000;
const D7 = 7 * 86400000;
const D30 = 30 * 86400000;

const isoSince = (ms: number) => new Date(Date.now() - ms).toISOString();

const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const round = (v: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

const pct = (part: number, total: number) =>
  total > 0 ? round((part / total) * 100, 1) : 0;

export function useValidationMetrics() {
  return useQuery<ValidationMetrics>({
    queryKey: ["validation-metrics-v1"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ValidationMetrics> => {
      // ── 1) Activity (practice_attempts + revisoes)
      const since30 = isoSince(D30);
      const since7 = isoSince(D7);
      const since1 = isoSince(D1);

      const [
        { data: pa30 },
        { data: rv30 },
        { data: snapshots },
        { data: tasks7d },
      ] = await Promise.all([
        supabase
          .from("practice_attempts")
          .select("user_id, created_at")
          .gte("created_at", since30)
          .limit(50000),
        supabase
          .from("revisoes")
          .select("user_id, status, data_revisao, updated_at")
          .gte("updated_at", since30)
          .limit(50000),
        supabase
          .from("assistant_decisions")
          .select("user_id, created_at, input_snapshot, decision_output")
          .eq("source_module", "study-engine-v3")
          .eq("decision_type", "engine_snapshot")
          .gte("created_at", isoSince(D30))
          .order("created_at", { ascending: false })
          .limit(20000),
        supabase
          .from("daily_plan_tasks")
          .select("user_id, completed, created_at")
          .gte("created_at", since7)
          .limit(20000),
      ]);

      const attempts = pa30 ?? [];
      const reviews = rv30 ?? [];
      const decisions = snapshots ?? [];
      const tasks = tasks7d ?? [];

      // Active users
      const activeIn = (cutoffISO: string) => {
        const cutoff = new Date(cutoffISO).getTime();
        const set = new Set<string>();
        for (const a of attempts) {
          if (new Date(a.created_at).getTime() >= cutoff) set.add(a.user_id);
        }
        for (const r of reviews) {
          if (new Date(r.updated_at).getTime() >= cutoff) set.add(r.user_id);
        }
        return set.size;
      };
      const activeUsers = {
        d1: activeIn(since1),
        d7: activeIn(since7),
        d30: activeIn(isoSince(D30)),
      };

      // Avg activity 7d (apenas usuários ativos no período)
      const since7ms = Date.now() - D7;
      const usersActive7d = new Set<string>();
      const qByUser = new Map<string, number>();
      const rByUser = new Map<string, number>();

      for (const a of attempts) {
        if (new Date(a.created_at).getTime() >= since7ms) {
          usersActive7d.add(a.user_id);
          qByUser.set(a.user_id, (qByUser.get(a.user_id) ?? 0) + 1);
        }
      }
      for (const r of reviews) {
        if (new Date(r.updated_at).getTime() >= since7ms) {
          usersActive7d.add(r.user_id);
          rByUser.set(r.user_id, (rByUser.get(r.user_id) ?? 0) + 1);
        }
      }
      const totalActive7 = usersActive7d.size || 1;
      const avgActivity = {
        questionsPerUser7d: round(
          [...qByUser.values()].reduce((s, v) => s + v, 0) / totalActive7,
          1
        ),
        reviewsPerUser7d: round(
          [...rByUser.values()].reduce((s, v) => s + v, 0) / totalActive7,
          1
        ),
      };

      // Missions (daily_plan_tasks últimos 7d)
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.completed).length;
      const usersWithTasks = new Set<string>(tasks.map((t: any) => t.user_id));
      const missions = {
        startRatePct: pct(usersWithTasks.size, activeUsers.d7),
        completionRatePct: pct(completedTasks, totalTasks),
      };

      // ── 2/3/4) Approval — agregação por usuário (último snapshot e penúltimo)
      const byUser = new Map<
        string,
        Array<{ ts: number; score: number; trend: string; risk: string }>
      >();
      for (const d of decisions) {
        const snap: any = d.input_snapshot ?? {};
        if (typeof snap.approval_score !== "number") continue;
        const arr = byUser.get(d.user_id) ?? [];
        arr.push({
          ts: new Date(d.created_at).getTime(),
          score: snap.approval_score,
          trend: snap.approval_trend ?? "stable",
          risk: snap.approval_risk ?? "medium",
        });
        byUser.set(d.user_id, arr);
      }

      const latestPerUser: Array<{
        userId: string;
        score: number;
        trend: string;
        risk: string;
        previous: number | null;
        previous7d: number | null;
      }> = [];

      for (const [userId, arr] of byUser.entries()) {
        arr.sort((a, b) => b.ts - a.ts);
        const latest = arr[0];
        const previous = arr[1]?.score ?? null;
        // snapshot mais antigo dentro de 7d (para evolução)
        const cutoff7 = Date.now() - D7;
        const old7 = [...arr].reverse().find((s) => s.ts >= cutoff7 - D7 && s.ts < cutoff7);
        latestPerUser.push({
          userId,
          score: latest.score,
          trend: latest.trend,
          risk: latest.risk,
          previous,
          previous7d: old7?.score ?? null,
        });
      }

      const scores = latestPerUser.map((u) => u.score);
      const buckets: ApprovalBucketDist = { high: 0, medium: 0, low: 0 };
      for (const s of scores) {
        if (s < 40) buckets.high++;
        else if (s < 70) buckets.medium++;
        else buckets.low++;
      }
      const total = scores.length || 0;
      const approval = {
        sampleSize: total,
        mean: total ? round(scores.reduce((a, b) => a + b, 0) / total, 1) : 0,
        median: total ? round(median(scores), 1) : 0,
        min: total ? Math.min(...scores) : 0,
        max: total ? Math.max(...scores) : 0,
        buckets,
        bucketsPct: {
          high: pct(buckets.high, total),
          medium: pct(buckets.medium, total),
          low: pct(buckets.low, total),
        },
      };

      // Trend
      const upN = latestPerUser.filter((u) => u.trend === "up").length;
      const dnN = latestPerUser.filter((u) => u.trend === "down").length;
      const stN = latestPerUser.filter((u) => u.trend === "stable").length;
      const deltas = latestPerUser
        .filter((u) => u.previous !== null)
        .map((u) => u.score - (u.previous as number));
      const trend = {
        upPct: pct(upN, total),
        stablePct: pct(stN, total),
        downPct: pct(dnN, total),
        avgDelta: deltas.length
          ? round(deltas.reduce((a, b) => a + b, 0) / deltas.length, 2)
          : 0,
      };

      // Risk transitions (últimos 7d) — comparando latest vs previous
      let entered = 0;
      let left = 0;
      const cutoff7 = Date.now() - D7;
      for (const [userId, arr] of byUser.entries()) {
        const sorted = [...arr].sort((a, b) => a.ts - b.ts);
        // último snapshot anterior a 7d, e último snapshot recente
        const old = [...sorted].reverse().find((s) => s.ts < cutoff7);
        const recent = sorted[sorted.length - 1];
        if (!old || !recent) continue;
        const wasHigh = old.risk === "high";
        const isHigh = recent.risk === "high";
        if (!wasHigh && isHigh) entered++;
        else if (wasHigh && !isHigh) left++;
      }
      const risk = {
        highRiskPct: pct(latestPerUser.filter((u) => u.risk === "high").length, total),
        enteredHighRisk7d: entered,
        leftHighRisk7d: left,
      };

      // ── 5) Engine impact — somar boost_totals últimos 7d
      const recent7Decisions = decisions.filter(
        (d: any) => new Date(d.created_at).getTime() >= cutoff7
      );
      const engineImpactRaw = recent7Decisions.reduce(
        (acc: any, d: any) => {
          const t = d.decision_output?.boost_totals ?? {};
          acc.r += t.approvalRiskBoosts ?? 0;
          acc.d += t.approvalDownBoosts ?? 0;
          acc.l += t.approvalLowBoosts ?? 0;
          acc.users.add(d.user_id);
          return acc;
        },
        { r: 0, d: 0, l: 0, users: new Set<string>() }
      );
      const engineUsers = engineImpactRaw.users.size;
      const totalBoosts =
        engineImpactRaw.r + engineImpactRaw.d + engineImpactRaw.l;
      const engineImpact = {
        approvalRiskBoosts: engineImpactRaw.r,
        approvalDownBoosts: engineImpactRaw.d,
        approvalLowBoosts: engineImpactRaw.l,
        totalUsers: engineUsers,
        avgPerUser: engineUsers ? round(totalBoosts / engineUsers, 1) : 0,
      };

      // ── 6) Behavior — high vs low risk (questões/dia & revisões/dia & missão)
      const usersHigh = new Set(
        latestPerUser.filter((u) => u.risk === "high").map((u) => u.userId)
      );
      const usersLow = new Set(
        latestPerUser.filter((u) => u.risk === "low").map((u) => u.userId)
      );

      const aggBehavior = (set: Set<string>) => {
        if (!set.size) return { qPerDay: 0, rPerDay: 0, missionCompletionPct: 0, users: 0 };
        let q = 0;
        let r = 0;
        for (const a of attempts) {
          if (set.has(a.user_id) && new Date(a.created_at).getTime() >= since7ms) q++;
        }
        for (const rv of reviews) {
          if (set.has(rv.user_id) && new Date(rv.updated_at).getTime() >= since7ms) r++;
        }
        const groupTasks = tasks.filter((t: any) => set.has(t.user_id));
        const completed = groupTasks.filter((t: any) => t.completed).length;
        return {
          qPerDay: round(q / set.size / 7, 2),
          rPerDay: round(r / set.size / 7, 2),
          missionCompletionPct: pct(completed, groupTasks.length),
          users: set.size,
        };
      };
      const behavior = {
        highRisk: aggBehavior(usersHigh),
        lowRisk: aggBehavior(usersLow),
      };

      // ── 7) Antes vs depois (evolução 7d)
      const evolutions = latestPerUser
        .filter((u) => u.previous7d !== null)
        .map((u) => u.score - (u.previous7d as number));
      const usersWithHistory = evolutions.length;
      const improved = evolutions.filter((d) => d > 0).length;
      const worsened = evolutions.filter((d) => d < 0).length;
      const beforeAfter = {
        usersWithHistory,
        avgEvolution7d: usersWithHistory
          ? round(evolutions.reduce((a, b) => a + b, 0) / usersWithHistory, 2)
          : 0,
        improvedPct: pct(improved, usersWithHistory),
        worsenedPct: pct(worsened, usersWithHistory),
      };

      return {
        activeUsers,
        avgActivity,
        missions,
        approval,
        trend,
        risk,
        engineImpact,
        behavior,
        beforeAfter,
      };
    },
  });
}
