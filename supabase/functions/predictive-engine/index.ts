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

    // 1. Fetch historical data
    const { data: metrics } = await supabase
      .from("cognitive_analytics")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: progress } = await supabase
      .from("approval_scores")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    // 2. Predict Approval Probability
    // Heuristic: Weighted average of current retention + progress
    const approvalProb = ((metrics?.overall_retention || 0) * 0.6) + ((progress?.overall_score || 0) / 100 * 0.4);

    await supabase.from("cognitive_predictions").insert({
      user_id,
      prediction_type: "approval",
      probability: Math.min(1, Math.max(0, approvalProb)),
      confidence_score: 0.85,
      contributing_factors: { retention: metrics?.overall_retention, progress: progress?.overall_score }
    });

    // 3. Predict Churn Risk
    // Signals: fatigue high, activity low, retention dropping
    const churnRisk = (metrics?.fatigue_score || 0) * 0.5 + (1 - (metrics?.overall_retention || 0)) * 0.5;

    await supabase.from("cognitive_predictions").insert({
      user_id,
      prediction_type: "churn",
      probability: Math.min(1, Math.max(0, churnRisk)),
      confidence_score: 0.75,
      contributing_factors: { fatigue: metrics?.fatigue_score, low_retention: (1 - (metrics?.overall_retention || 0)) }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      predictions: { approval: approvalProb, churn: churnRisk }
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
