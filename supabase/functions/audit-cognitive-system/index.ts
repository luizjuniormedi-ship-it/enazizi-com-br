import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";

/**
 * Audit Cognitive System v2
 * Comprehensive technical health check for Tutor IA V3 Premium.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserIdFromRequest(req).catch(() => null);
    if (!userId) return errorResponse("UNAUTHORIZED", 401);

    const supabase = getServiceClient();
    const metrics: any = {
      timestamp: new Date().toISOString(),
      status: "HEALTHY",
      checks: []
    };

    // 1. Check for Duplicate Pedagogical Sessions
    const { data: duplicates } = await supabase.rpc('check_duplicate_tutor_sessions');
    if (duplicates && duplicates.length > 0) {
      metrics.status = "DEGRADED";
      metrics.checks.push({ 
        name: "Session Integrity", 
        status: "FAIL", 
        message: `Found ${duplicates.length} duplicate conversation clusters.` 
      });
    } else {
      metrics.checks.push({ name: "Session Integrity", status: "PASS", message: "No duplicate clusters found." });
    }

    // 2. AI Runtime Stability (Recent Incidents)
    const { data: recentIncidents } = await supabase
      .from("runtime_incidents")
      .select("*")
      .eq("is_resolved", false)
      .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(10);
    
    if (recentIncidents && recentIncidents.length > 3) {
      metrics.status = "DEGRADED";
      metrics.checks.push({ 
        name: "Runtime Stability", 
        status: "WARN", 
        message: `Detected ${recentIncidents.length} active incidents in the last 24h.` 
      });
    } else {
      metrics.checks.push({ name: "Runtime Stability", status: "PASS" });
    }

    // 3. AI Performance (Latency)
    const { data: latencyAvg } = await supabase.rpc('get_avg_tutor_latency', { hours: 6 });
    metrics.checks.push({ 
      name: "AI Latency (6h)", 
      status: (latencyAvg && latencyAvg > 5000) ? "WARN" : "PASS",
      value: latencyAvg ? `${Math.round(latencyAvg)}ms` : "N/A"
    });

    // 4. Memory Continuity
    const { count: memoryCount } = await supabase
      .from("tutor_learning_memory")
      .select("*", { count: 'exact', head: true });
    
    metrics.checks.push({ 
      name: "Longitudinal Memory Size", 
      status: "PASS", 
      value: memoryCount || 0 
    });

    return jsonResponse(metrics);

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});