import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SIMULANDO O QUE shared/supabase.ts OU shared/pipeline-logger.ts PODE ESTAR FAZENDO
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

console.log("[DEBUG] Initializing client at top-level...");
// Se isso crashar, o boot falha
const client = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ success: true, stage: "TOP_LEVEL_CLIENT_OK" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
