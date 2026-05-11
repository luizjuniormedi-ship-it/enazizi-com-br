
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);

    // 1. Fetch error bank entries
    const { data: errors } = await supabase
      .from("error_bank")
      .select("tema, subtema, categoria_erro, vezes_errado")
      .eq("user_id", userId)
      .eq("dominado", false);

    if (!errors || errors.length === 0) {
      return jsonResponse({ clusters: [] });
    }

    // 2. Simple heuristic clustering (By Category & Topic)
    const clusters: Record<string, { count: number; subthemes: Set<string> }> = {};

    errors.forEach((err: any) => {
      const key = `${err.categoria_erro || "Desconhecido"} - ${err.tema || "Geral"}`;
      if (!clusters[key]) {
        clusters[key] = { count: 0, subthemes: new Set() };
      }
      clusters[key].count += err.vezes_errado || 1;
      if (err.subtema) clusters[key].subthemes.add(err.subtema);
    });

    const formattedClusters = Object.entries(clusters).map(([name, data]) => ({
      name,
      count: data.count,
      subthemes: Array.from(data.subthemes),
      urgency: data.count > 5 ? "high" : data.count > 2 ? "medium" : "low"
    })).sort((a, b) => b.count - a.count);

    // 3. Update cognitive snapshot with clusters (optional or separate call)
    // For now, just return them.

    return jsonResponse({
      success: true,
      clusters: formattedClusters,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
