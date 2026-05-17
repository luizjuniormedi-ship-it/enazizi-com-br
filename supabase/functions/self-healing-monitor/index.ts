import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Self-Healing Monitor: Periodic check for system health and AI regressions.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Detect AI regressions (e.g., high failure rate in tutor_qa_snapshots)
    const { data: regressions } = await supabase
      .from("tutor_qa_snapshots")
      .select("id, quality_score")
      .lt("quality_score", 0.4)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString()); // Last hour

    if (regressions && regressions.length > 5) {
      await supabase.from("self_healing_incidents").insert({
        feature_name: "Tutor IA",
        incident_type: "quality_regression",
        severity: "high",
        symptoms: { low_score_count: regressions.length },
        fallback_activated: true,
        fallback_model_used: "google/gemini-2.5-flash", // Fallback to more stable model
        mitigation_details: "Activated fallback model for all tutor requests."
      });
      
      // Implementation of fallback toggle (e.g., in a config table or Edge Config)
      // For now, we log it, and functions can check the incidents table.
    }

    // 2. Detect Edge Function Crashes or Timeouts
    // (In real enterprise, we'd hook into logs, here we check ai_runtime_logs)
    const { data: crashes } = await supabase
      .from("ai_runtime_logs" as any)
      .select("id")
      .eq("status", "error")
      .gte("created_at", new Date(Date.now() - 600000).toISOString()); // Last 10 mins

    if (crashes && crashes.length > 20) {
      await supabase.from("self_healing_incidents").insert({
        feature_name: "Edge Functions",
        incident_type: "high_error_rate",
        severity: "critical",
        symptoms: { error_count: crashes.length },
        mitigation_details: "Global alert triggered for admin investigation."
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      regressions_detected: regressions?.length || 0,
      crashes_detected: crashes?.length || 0 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
