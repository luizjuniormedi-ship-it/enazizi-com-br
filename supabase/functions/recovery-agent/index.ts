import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id } = await req.json();

    if (!user_id) throw new Error("user_id is required");

    // 1. Gather signals
    const { data: analytics } = await supabase
      .from("cognitive_analytics")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: fatigue } = await supabase
      .from("fatigue_metrics")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Threshold Analysis
    const isFatigued = (fatigue?.session_fatigue_score || 0) > 0.8 || (analytics?.fatigue_score || 0) > 0.7;
    const isOverloaded = analytics?.overload_flag || (analytics?.cognitive_pressure || 0) > 0.75;
    const lowRetention = (analytics?.overall_retention || 0) < 0.6;

    const interventions = [];

    if (isFatigued || isOverloaded) {
      interventions.push({
        type: "load_reduction",
        reason: isFatigued ? "high_fatigue" : "cognitive_overload",
        details: { reduce_daily_questions: 0.3, pause_new_topics: true }
      });
    }

    if (lowRetention) {
      interventions.push({
        type: "review_surge",
        reason: "critical_retention_drop",
        details: { focus_topics: "most_failed", flashcard_multiplier: 1.5 }
      });
    }

    // 3. Apply Interventions
    for (const intervention of interventions) {
      await supabase.from("recovery_interventions").insert({
        user_id,
        intervention_type: intervention.type,
        reason_code: intervention.reason,
        action_details: intervention.details,
        automatic: true
      });
      
      // Notify other systems (e.g., Planner) by updating flags
      if (intervention.type === "load_reduction") {
        await supabase.from("profiles").update({ 
          recovery_mode: true,
          updated_at: new Date().toISOString()
        }).eq("user_id", user_id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      interventions_applied: interventions.length,
      signals: { isFatigued, isOverloaded, lowRetention }
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
