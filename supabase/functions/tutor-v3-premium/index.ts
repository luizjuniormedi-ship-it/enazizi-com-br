import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[TUTOR_MINIMAL_BOOT] file loaded");

serve(async (req) => {
  console.log("[TUTOR_MINIMAL_REQ]", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    return new Response(JSON.stringify({
      success: true,
      content: "Tutor V3 mínimo respondeu corretamente.",
      currentBlock: "RUNTIME_HEALTHCHECK",
      shouldWaitForStudent: false,
      debug_stage: "minimal_ok",
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[TUTOR_MINIMAL_ERROR]", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
