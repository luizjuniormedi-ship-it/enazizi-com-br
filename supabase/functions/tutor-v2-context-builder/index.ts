import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    let errors = [];
    try {
      const { data } = await supabase.from("user_errors").select("*").eq("user_id", userId).limit(5);
      if (data) errors = data;
    } catch (e) { console.warn("Table user_errors not found or error:", e); }

    // 2. Fetch Planner/Mission
    let mission = null;
    try {
      const { data } = await supabase.from("user_missions").select("*").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (data) mission = data;
    } catch (e) { console.warn("Table user_missions not found or error:", e); }

    // 3. Fetch FSRS status
    let fsrs = null;
    try {
      const { data } = await supabase.from("user_fsrs_stats").select("*").eq("user_id", userId).maybeSingle();
      if (data) fsrs = data;
    } catch (e) { console.warn("Table user_fsrs_stats not found or error:", e); }

    // 4. Memory & Cognitive Metrics
    let memory_chunks_used = 0;
    try {
      const { data } = await supabase.from("tutor_memory_search_logs").select("chunks_found").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) memory_chunks_used = data.chunks_found;
    } catch (e) { console.warn("Table tutor_memory_search_logs not found or error:", e); }

    return new Response(JSON.stringify({ 
      ok: true, 
      context: {
        user_id: userId,
        errors: errors || [],
        mission: mission || null,
        fsrs: fsrs || null,
        memory_chunks_used: memory?.chunks_found || 0,
        cognitive_load: 0.45, // Placeholder for actual calculation
        detected_gaps: (errors || []).map((e: any) => e.topic)
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
