
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  return new Response(JSON.stringify({
    success: true,
    function: "ingest-questions",
    stage: "BOOT_OK",
    timestamp: new Date().toISOString()
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  })
})
