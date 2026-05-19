
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, getServiceClient, getUserIdFromRequest, jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { calculatePedagogicalHealth, detectCognitiveState } from "../_shared/cognitive-governance-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);

    // 1. Calculate Comprehensive Health
    const healthData = await calculatePedagogicalHealth(supabase, userId);
    
    // 2. Detect Cognitive State
    const cognitiveState = await detectCognitiveState(supabase, userId);

    // 3. Persist Health Snapshot
    const { data: snapshot, error: snapshotErr } = await supabase
      .from("pedagogical_health_indices")
      .insert({
        user_id: userId,
        health_score: healthData.health_score,
        retention_rate: healthData.retention_rate,
        consistency_score: healthData.consistency_score,
        recovery_efficiency: healthData.recovery_efficiency,
        metadata: {
          ...healthData.metadata,
          detected_cognitive_state: cognitiveState,
          governor_version: "2.1-governance"
        }
      })
      .select()
      .single();

    if (snapshotErr) throw snapshotErr;

    // 4. Record Cognitive State
    await supabase.from("cognitive_states").insert({
      user_id: userId,
      state: cognitiveState,
      trigger_source: "health_governor_periodic_check"
    });

    // 5. Governance Logging for significant health drops
    const { data: lastHealth } = await supabase
      .from("pedagogical_health_indices")
      .select("health_score")
      .eq("user_id", userId)
      .lt("created_at", snapshot.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastHealth && (lastHealth.health_score - healthData.health_score > 15)) {
      await supabase.from("governance_logs").insert({
        user_id: userId,
        event_type: "critical_health_drop",
        details: {
          previous: lastHealth.health_score,
          current: healthData.health_score,
          state: cognitiveState
        }
      });
    }

    // 6. Update enazizi_progress with scores
    await supabase.from("enazizi_progress").update({
      retention_score: Math.round(healthData.retention_rate * 100),
      recovery_score: Math.round(healthData.recovery_efficiency * 100)
    }).eq("user_id", userId);

    return jsonResponse({
      success: true,
      health_score: healthData.health_score,
      cognitive_state: cognitiveState,
      snapshot_id: snapshot.id
    });

  } catch (error) {
    console.error("[PedagogicalHealthGovernor] Error:", error);
    return errorResponse(error.message, 500);
  }
});
