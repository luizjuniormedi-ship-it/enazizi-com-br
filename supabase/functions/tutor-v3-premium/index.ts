import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[TUTOR_V3] Starting request ${requestId}`);

  try {
    // 1. Body Parsing
    const body = await req.json();
    const { message, sessionId } = body;

    // 2. Auth Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader && !sessionId) {
       console.log("[TUTOR_V3] No auth or session ID provided");
    }

    // 4. Fixed response (Layer 4) - Simulate Block 1 for now
    // We also implement currentBlock logic from Phase 4
    const currentBlock = body.currentBlock ?? "BLOCO_1_MISSAO_CLINICA";

    return new Response(JSON.stringify({
      success: true,
      content: `[DEBUG: Layer 1-4] Recebi: "${message}". Bloco atual: ${currentBlock}.`,
      currentBlock: currentBlock,
      shouldWaitForStudent: true,
      request_id: requestId,
      debug_stage: "layers_1_to_4_ok"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[TUTOR_V3_ERROR] ${requestId}:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      debug_stage: "error_handler"
    }), {
      status: 200, // Return 200 as per Phase 5
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
