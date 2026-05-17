
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: admin-only endpoint
    const userId = await getUserIdFromRequest(req).catch(() => null);
    if (!userId) return errorResponse("Não autenticado", 401);

    const supabase = getServiceClient();
    const reports = [];

    // 1. Check for dead render jobs
    const { data: deadJobs } = await supabase
      .from("cme_render_jobs")
      .select("id")
      .eq("status", "rendering")
      .lt("updated_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (deadJobs?.length) reports.push(`Detected ${deadJobs.length} dead render jobs.`);

    // 2. Check for orphaned FSRS cards
    const { data: orphanedCards } = await supabase
      .from("fsrs_cards")
      .select("id")
      .is("user_id", null);
      
    if (orphanedCards?.length) reports.push(`Detected ${orphanedCards.length} orphaned FSRS cards.`);

    // 3. System health summary
    const status = reports.length === 0 ? "HEALTHY" : "DEGRADED";

    return jsonResponse({
      success: true,
      status,
      reports,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
