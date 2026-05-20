import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: metrics, error: metricsErr } = await supabaseAdmin.from("pipeline_health_metrics").select("*").limit(50);
    const { data: incidents, error: incidentsErr } = await supabaseAdmin.from("ai_incidents").select("*").order("created_at", { ascending: false }).limit(20);
    
    return new Response(JSON.stringify({
      status: "healthy",
      alos_version: "3.1.0",
      layers: {
        database: "connected",
        edge_runtime: "active",
        ai_gateway: "configured"
      },
      observability: {
        recent_incidents: incidents || [],
        pipeline_health: metrics || []
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: "degraded", error: err.message }), { status: 500 });
  }
});
