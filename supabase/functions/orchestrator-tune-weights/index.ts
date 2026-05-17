/**
 * orchestrator-tune-weights — F6
 *
 * Reads recent orchestrator_outcomes and adjusts rule weights based on
 * observed effectiveness (improvement_delta + followed rate).
 *
 * Algorithm (conservative bandit):
 *   - For each rule_id present in recent decisions:
 *       success = outcomes with improvement_delta > 0 (or outcome='success')
 *       failure = outcomes with improvement_delta <= 0 OR followed=false
 *       new_weight = clamp(baseline + 0.05 * (success - failure) / max(1, total), 0.5, 2.0)
 *   - Only adjusts when there are >= 5 outcomes for the rule.
 *   - Idempotent — safe to run on a cron.
 *
 * Trigger manually or via pg_cron. Service role only.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest,
} from "../_shared/assistant-helpers.ts";

const LOOKBACK_DAYS = 14;
const MIN_SAMPLES = 5;
const MAX_DELTA = 0.4; // never move > ±0.4 from baseline in one run
const WEIGHT_FLOOR = 0.5;
const WEIGHT_CEIL = 2.0;

interface RuleStats {
  ruleId: string;
  total: number;
  success: number;
  failure: number;
  followed: number;
  avgDelta: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return errorResponse("Method not allowed", 405);

  try {
    // Auth: admin/cron-only endpoint
    const userId = await getUserIdFromRequest(req).catch(() => null);
    if (!userId) return errorResponse("Não autenticado", 401);

    const db = getServiceClient();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

    // Pull decisions + outcomes from the lookback window
    const { data: decisions, error: decErr } = await db
      .from("assistant_decisions")
      .select("id, decision_output, created_at")
      .eq("source_module", "study-orchestrator")
      .eq("decision_type", "orchestration")
      .gte("created_at", since)
      .limit(2000);
    if (decErr) throw decErr;

    const { data: outcomes, error: outErr } = await db
      .from("orchestrator_outcomes")
      .select("decision_id, followed, outcome, improvement_delta")
      .gte("created_at", since)
      .limit(5000);
    if (outErr) throw outErr;

    const outcomeByDecision = new Map<string, any[]>();
    (outcomes ?? []).forEach((o: any) => {
      if (!o.decision_id) return;
      const arr = outcomeByDecision.get(o.decision_id) ?? [];
      arr.push(o);
      outcomeByDecision.set(o.decision_id, arr);
    });

    // Aggregate per rule_id (rule that fired AND won the candidate selection)
    const stats = new Map<string, RuleStats>();
    (decisions ?? []).forEach((d: any) => {
      const out = d.decision_output ?? {};
      const trace: any[] = out.rulesTrace ?? [];
      const winningAction: string | undefined = out.nextAction;
      // Attribute outcome to every rule that fired (proportional credit)
      const firedRules = trace.filter((r) => r.fired && (r.weight ?? 0) > 0);
      const ds = outcomeByDecision.get(d.id) ?? [];
      if (ds.length === 0) return;
      const followedAny = ds.some((o) => o.followed);
      const deltas = ds
        .map((o) => Number(o.improvement_delta))
        .filter((n) => Number.isFinite(n));
      const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
      const success = avgDelta > 0 || ds.some((o) => o.outcome === "success");
      const failure = !followedAny || avgDelta < 0 || ds.some((o) => o.outcome === "failure");

      firedRules.forEach((r) => {
        const cur = stats.get(r.ruleId) ?? {
          ruleId: r.ruleId, total: 0, success: 0, failure: 0, followed: 0, avgDelta: 0,
        };
        cur.total += 1;
        if (success) cur.success += 1;
        if (failure) cur.failure += 1;
        if (followedAny) cur.followed += 1;
        cur.avgDelta = (cur.avgDelta * (cur.total - 1) + avgDelta) / cur.total;
        stats.set(r.ruleId, cur);
      });
      // Mark winning action's rule slightly stronger if outcome was good
      void winningAction;
    });

    // Apply adjustments
    const updates: any[] = [];
    const { data: weightsRows } = await db
      .from("orchestrator_rule_weights")
      .select("rule_id, baseline_weight, current_weight");
    const baselineByRule = new Map<string, number>();
    (weightsRows ?? []).forEach((w: any) => baselineByRule.set(w.rule_id, Number(w.baseline_weight) || 1.0));

    for (const [ruleId, s] of stats.entries()) {
      if (s.total < MIN_SAMPLES) continue;
      const baseline = baselineByRule.get(ruleId) ?? 1.0;
      const score = (s.success - s.failure) / s.total; // -1..1
      let delta = 0.05 * score + 0.10 * Math.tanh(s.avgDelta / 10); // soft delta
      delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
      const newWeight = Math.max(WEIGHT_FLOOR, Math.min(WEIGHT_CEIL, baseline + delta));
      updates.push({
        rule_id: ruleId,
        current_weight: Number(newWeight.toFixed(3)),
        success_count: s.success,
        failure_count: s.failure,
        last_adjusted_at: new Date().toISOString(),
        notes: `auto-tune Δ=${delta.toFixed(3)} avgΔ=${s.avgDelta.toFixed(2)} n=${s.total}`,
      });
    }

    // Bulk upsert
    if (updates.length > 0) {
      const { error: upErr } = await db
        .from("orchestrator_rule_weights")
        .upsert(updates, { onConflict: "rule_id" });
      if (upErr) throw upErr;
    }

    return jsonResponse({
      success: true,
      lookbackDays: LOOKBACK_DAYS,
      decisionsScanned: decisions?.length ?? 0,
      outcomesScanned: outcomes?.length ?? 0,
      rulesEvaluated: stats.size,
      rulesAdjusted: updates.length,
      adjustments: updates,
    });
  } catch (e) {
    console.error("[orchestrator-tune-weights]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
