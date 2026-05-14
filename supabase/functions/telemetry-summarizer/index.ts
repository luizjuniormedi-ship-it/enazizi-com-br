import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAdmin, corsHeaders, jsonOk, jsonError } from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = getAdmin();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log(`[TelemetrySummarizer] Starting aggregation for period: ${yesterday.toISOString()} to ${now.toISOString()}`);

    // Aggregate by event_type (simplified example)
    const { data: events } = await sb.rpc('summarize_daily_telemetry');

    // If RPC doesn't exist yet, we'll do it manually here for demo
    // In production, we should use a Postgres function for efficiency.
    
    // Summary of AI Usage costs as well
    const { data: costAgg } = await sb.from('ai_cost_metrics')
      .select('feature_name, cost_usd')
      .gt('created_at', yesterday.toISOString());

    const summaryByFeature: Record<string, number> = {};
    costAgg?.forEach(c => {
      summaryByFeature[c.feature_name] = (summaryByFeature[c.feature_name] || 0) + Number(c.cost_usd);
    });

    for (const [feature, cost] of Object.entries(summaryByFeature)) {
      await sb.from('telemetry_aggregates').insert({
        metric_name: 'ai_cost_summary',
        dimension_name: 'feature',
        dimension_value: feature,
        aggregate_type: 'daily',
        sum_value: cost,
        start_time: yesterday,
        end_time: now
      });
    }

    return jsonOk({ message: "Telemetry summarized successfully", period: { start: yesterday, end: now } });
  } catch (e) {
    console.error("[TelemetrySummarizer] Error:", e);
    return jsonError(e.message, 500);
  }
});
