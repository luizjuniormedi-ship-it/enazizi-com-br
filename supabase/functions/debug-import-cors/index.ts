import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ success: true, stage: "IMPORT_CORS_OK" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
