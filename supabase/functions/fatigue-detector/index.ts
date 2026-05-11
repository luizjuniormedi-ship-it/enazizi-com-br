
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";
import { detectFatigue } from "../_shared/cognitive-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);

    const fatigue = await detectFatigue(supabase, userId);

    return jsonResponse({
      success: true,
      fatigue_score: fatigue,
      status: fatigue > 0.8 ? "CRITICAL" : fatigue > 0.5 ? "WARNING" : "NORMAL",
      recommendation: fatigue > 0.8 ? "Mandatory break" : fatigue > 0.5 ? "Light content only" : "Full study session"
    });

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
