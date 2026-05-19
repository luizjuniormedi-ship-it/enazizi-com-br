
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, getServiceClient, getUserIdFromRequest, jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { detectFatigue, calculateRetention } from "../_shared/cognitive-helpers.ts";

/**
 * Pedagogical Health Governor
 * 
 * Computes the multi-factor health index (PedagogicalHealthScore)
 * and detects longitudinal deterioration.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);

    // 1. Gather component metrics
    const [fatigue, retention, { data: attempts }] = await Promise.all([
      detectFatigue(supabase, userId),
      calculateRetention(supabase, userId),
      supabase.from("practice_attempts").select("created_at, correct").eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
    ]);

    // 2. Consistency Calculation (Days active in last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const activeDays = new Set((attempts || []).map(a => new Date(a.created_at).toISOString().split('T')[0])).size;
    const consistencyScore = (activeDays / 7) * 100;

    // 3. Risk of Abandonment (Simplified: inverse of consistency + fatigue penalty)
    const riskScore = Math.min(100, (100 - consistencyScore) + (fatigue * 20));

    // 4. Composite Health Score
    // Weighting: 40% Retention, 30% Consistency, 30% Cognitive State (1 - Fatigue)
    const healthScore = (retention * 40) + (consistencyScore * 0.3) + ((1 - fatigue) * 30);

    // 5. Persist Snapshot
    const { data: snapshot, error: snapshotErr } = await supabase
      .from("pedagogical_health_indices")
      .insert({
        user_id: userId,
        health_score: healthScore,
        retention_factor: retention * 100,
        consistency_score: consistencyScore,
        fatigue_index: fatigue * 100,
        risk_of_abandonment: riskScore,
        metadata: {
          active_days_count: activeDays,
          recent_attempts_count: attempts?.length || 0,
          governor_version: "2026.1"
        }
      })
      .select()
      .single();

    if (snapshotErr) throw snapshotErr;

    // 6. Check for deterioration (compare with previous average)
    const { data: previousAvg } = await supabase
      .from("pedagogical_health_indices")
      .select("health_score")
      .eq("user_id", userId)
      .lt("created_at", snapshot.created_at)
      .order("created_at", { ascending: false })
      .limit(5);

    const prevScore = previousAvg?.length 
      ? previousAvg.reduce((acc, s) => acc + Number(s.health_score), 0) / previousAvg.length
      : 100;

    const deterioration = prevScore - healthScore;
    if (deterioration > 15) {
      // Record governance log for significant drop
      await supabase.from("engine_governance_logs").insert({
        engine_name: "health_governor",
        event_type: "deterioration_detected",
        severity: "medium",
        details: { deterioration_value: deterioration, current_score: healthScore, prev_avg: prevScore },
        user_id: userId // Since we have user_id in the logs table
      } as any);
    }

    return jsonResponse({
      success: true,
      health_score: healthScore,
      deterioration: deterioration > 0 ? deterioration : 0,
      snapshot_id: snapshot.id,
      metrics: {
        retention,
        consistency: consistencyScore,
        fatigue,
        risk: riskScore
      }
    });

  } catch (error) {
    console.error("[HealthGovernor] Error:", error);
    return errorResponse(error.message, 500);
  }
});
