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

    // 1. Load Autonomous Signals
    const [
      { data: fatigue },
      { data: prediction },
      { data: profile }
    ] = await Promise.all([
      supabase.from("fatigue_metrics").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("cognitive_predictions").select("*").eq("user_id", user_id).eq("prediction_type", "overload").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("cognitive_profiles").select("*").eq("user_id", user_id).maybeSingle()
    ]);

    // 2. Adaptive Logic
    let dailyQuestionLimit = 50; // default
    let dailyReviewMultiplier = 1.0;

    // Adjust based on fatigue tolerance
    const fatigueTolerance = profile?.fatigue_tolerance_index || 1.0;
    const currentFatigue = fatigue?.session_fatigue_score || 0;

    if (currentFatigue > (0.7 * fatigueTolerance)) {
       // Reduce load
       dailyQuestionLimit = Math.round(dailyQuestionLimit * 0.6);
       dailyReviewMultiplier = 1.5; // Prioritize retention over new content
    }

    if (prediction?.probability > 0.8) {
       // High overload risk: aggressive load balancing
       dailyQuestionLimit = Math.round(dailyQuestionLimit * 0.4);
    }

    // 3. Update Daily Plan
    const { data: updatedPlan } = await supabase
      .from("study_plans" as any)
      .update({
        daily_questions_target: dailyQuestionLimit,
        review_intensity: dailyReviewMultiplier,
        autonomous_adjustment_at: new Date().toISOString()
      })
      .eq("user_id", user_id)
      .eq("status", "active")
      .select();

    return new Response(JSON.stringify({ 
      success: true, 
      adjustments: { dailyQuestionLimit, dailyReviewMultiplier },
      signals: { currentFatigue, fatigueTolerance }
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
