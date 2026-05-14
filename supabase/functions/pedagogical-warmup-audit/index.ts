
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient } from "../_shared/assistant-helpers.ts";

/**
 * pedagogical-warmup-v11
 * Executes a simulated pedagogical cycle to re-teach the system.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const { phase = "audit" } = body;

    const report: any = {
      timestamp: new Date().toISOString(),
      phase,
      metrics: {}
    };

    // FASE 1: AUDIT SHADOW MODE
    const { data: shadowMetrics } = await supabase
      .from("shadow_adaptive_metrics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    
    report.metrics.shadow_count = shadowMetrics?.length || 0;
    report.metrics.avg_divergence = shadowMetrics?.reduce((acc, m) => acc + (m.divergence_score || 0), 0) / (shadowMetrics?.length || 1);

    // FASE 2: ORCHESTRATOR CONFIDENCE
    const { data: decisions } = await supabase
      .from("assistant_decisions")
      .select("confidence_score")
      .limit(20);
    
    report.metrics.orchestrator_confidence = decisions?.reduce((acc, d) => acc + (d.confidence_score || 0), 0) / (decisions?.length || 1);

    // FASE 3: COGNITIVE BASELINE (Aggregated from Golden Dataset)
    const { data: goldenStats } = await supabase
      .from("questions_bank")
      .select("cognitive_quality_score, hallucination_risk_score, clinical_reasoning_depth")
      .eq("quality_tier", "GOLDEN");

    if (goldenStats?.length) {
      report.metrics.baseline_quality = goldenStats.reduce((acc, q) => acc + (q.cognitive_quality_score || 0), 0) / goldenStats.length;
      report.metrics.baseline_hallucination = goldenStats.reduce((acc, q) => acc + (q.hallucination_risk_score || 0), 0) / goldenStats.length;
    }

    // FASE 4: FSRS READINESS
    const { count: fsrsCount } = await supabase
      .from("fsrs_cards")
      .select("*", { count: 'exact', head: true });
    
    report.metrics.fsrs_active_cards = fsrsCount || 0;

    // VERDICT
    const isReady = 
      report.metrics.baseline_quality > 0.85 && 
      report.metrics.orchestrator_confidence > 0.8 &&
      report.metrics.shadow_count >= 2; // Initial seed count

    report.status = isReady ? "APPROVED" : "PENDING_WARMUP";
    report.recommendation = isReady ? "Proceed to Scale Lote 1" : "Continue Golden Data Ingestion";

    return jsonResponse(report);

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
