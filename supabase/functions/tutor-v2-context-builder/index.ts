import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Tutor V2 Context Builder — ALOS Integration
 * Fetches real pedagogical state for the AI Tutor.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch Error Bank (Real ALOS Table)
    const { data: errorBank } = await supabase
      .from("error_bank")
      .select("tema, subtema, vezes_errado, conteudo")
      .eq("user_id", userId)
      .eq("dominado", false)
      .order("vezes_errado", { ascending: false })
      .limit(10);

    // 2. Fetch Cognitive State
    const { data: cogState } = await supabase
      .from("cognitive_states")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 3. Fetch FSRS Status (Summary)
    const { data: fsrsSummary } = await supabase
      .from("fsrs_cards")
      .select("id, topic, stability, difficulty, due")
      .eq("user_id", userId)
      .order("due", { ascending: true })
      .limit(5);

    // 4. Fetch Active Planner/Mission
    const { data: dailyPlan } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    return new Response(JSON.stringify({ 
      ok: true, 
      context: {
        user_id: userId,
        errors: errorBank || [],
        cognitive_state: cogState || { retention_score: 50, cognitive_load: 10 },
        fsrs_overview: fsrsSummary || [],
        active_plan: dailyPlan,
        detected_gaps: (errorBank || []).map((e: any) => e.tema),
        pedagogical_mode: cogState?.metadata?.anomaly_detected ? 'recovery' : 'standard'
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[TUTOR-V2-CONTEXT] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
