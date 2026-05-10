import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 1. Fetch Error Bank
    const { data: errors } = await supabase
      .from("user_errors") // Assuming this table exists based on previous history
      .select("*")
      .eq("user_id", userId)
      .limit(5);

    // 2. Fetch Planner/Mission
    const { data: mission } = await supabase
      .from("user_missions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    // 3. Fetch FSRS status
    const { data: fsrs } = await supabase
      .from("user_fsrs_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    return new Response(JSON.stringify({ 
      ok: true, 
      context: {
        errors: errors || [],
        mission: mission || null,
        fsrs: fsrs || null
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
