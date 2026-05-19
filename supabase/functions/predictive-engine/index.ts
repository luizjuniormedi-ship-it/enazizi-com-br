/**
 * Predictive Engine v3 — Predictive Recovery
 *
 * Antecipa falhas antes do erro acontecer:
 *  - aprovação esperada na prova
 *  - risco de churn
 *  - tópicos prováveis de esquecimento (stability baixa + próximo do due)
 *  - semanas críticas (densidade de revisão futura)
 *
 * Persiste em cognitive_predictions + predictive_recovery_forecasts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const now = new Date();

    const [metricsRes, progressRes, cardsRes, errorsRes, profileRes] = await Promise.all([
      supabase.from("cognitive_analytics").select("*").eq("user_id", user_id)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("approval_scores").select("*").eq("user_id", user_id)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("fsrs_cards").select("id,stability,difficulty,due_at,topic")
        .eq("user_id", user_id).limit(3000),
      supabase.from("error_bank").select("id,tema,specialty,created_at")
        .eq("user_id", user_id).eq("dominado", false).limit(1000),
      supabase.from("profiles").select("exam_date").eq("user_id", user_id).maybeSingle(),
    ]);

    const metrics: any = metricsRes.data ?? {};
    const progress: any = progressRes.data ?? {};
    const cards: any[] = cardsRes.data ?? [];
    const errors: any[] = errorsRes.data ?? [];

    // ─── Aprovação ───────────────────────────────────────────────────────────
    const approvalProb = clamp01(
      (metrics.overall_retention || 0) * 0.35 +
      (metrics.mastery_index || 0) * 0.30 +
      ((progress.overall_score || 0) / 100) * 0.20 +
      (metrics.consistency_index || 0) * 0.15
    );

    await supabase.from("cognitive_predictions").insert({
      user_id,
      prediction_type: "approval",
      probability: approvalProb,
      confidence_score: 0.85,
      contributing_factors: {
        retention: metrics.overall_retention,
        mastery: metrics.mastery_index,
        progress: progress.overall_score,
        consistency: metrics.consistency_index,
      },
    });

    // ─── Churn ───────────────────────────────────────────────────────────────
    const churnRisk = clamp01(
      (metrics.abandonment_risk || 0) * 0.6 +
      (metrics.fatigue_score || 0) / 100 * 0.4
    );

    await supabase.from("cognitive_predictions").insert({
      user_id,
      prediction_type: "churn",
      probability: churnRisk,
      confidence_score: 0.75,
      contributing_factors: {
        abandonment: metrics.abandonment_risk,
        fatigue: metrics.fatigue_score,
      },
    });

    // ─── Tópicos com risco de esquecimento ───────────────────────────────────
    const forgetForecasts: any[] = [];
    const topicRisk = new Map<string, { count: number; avgStab: number; sumStab: number }>();

    cards.forEach((c) => {
      const stab = Number(c.stability) || 1;
      const dueDays = c.due_at
        ? (new Date(c.due_at).getTime() - now.getTime()) / 86400_000
        : 30;
      // risco: stability baixa + due próximo
      const risk = (1 / Math.max(0.5, stab)) * (1 / Math.max(0.5, dueDays + 1));
      if (risk > 0.5 && c.topic) {
        const cur = topicRisk.get(c.topic) ?? { count: 0, avgStab: 0, sumStab: 0 };
        cur.count++;
        cur.sumStab += stab;
        cur.avgStab = cur.sumStab / cur.count;
        topicRisk.set(c.topic, cur);
      }
    });

    Array.from(topicRisk.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .forEach(([topic, data]) => {
        forgetForecasts.push({
          user_id,
          forecast_type: "topic_forgetting",
          target_topic: topic,
          predicted_failure_date: new Date(now.getTime() + Math.max(1, data.avgStab) * 86400_000).toISOString(),
          risk_score: clamp01(data.count / 20),
          confidence: 0.7,
          recommended_action: "schedule_review_block",
          payload: { cardCount: data.count, avgStability: data.avgStab },
        });
      });

    // ─── Erros recorrentes por especialidade ─────────────────────────────────
    const specCount = new Map<string, number>();
    errors.forEach((e) => {
      const k = e.specialty || e.tema;
      if (k) specCount.set(k, (specCount.get(k) ?? 0) + 1);
    });
    Array.from(specCount.entries())
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([spec, count]) => {
        forgetForecasts.push({
          user_id,
          forecast_type: "specialty_degradation",
          target_specialty: spec,
          risk_score: clamp01(count / 15),
          confidence: 0.8,
          recommended_action: "error_review_block",
          payload: { errorCount: count },
        });
      });

    // ─── Semana crítica: densidade de revisão próximos 14d ───────────────────
    const dueIn14 = cards.filter((c) =>
      c.due_at && new Date(c.due_at).getTime() <= now.getTime() + 14 * 86400_000
    ).length;
    if (dueIn14 > 80) {
      forgetForecasts.push({
        user_id,
        forecast_type: "critical_week",
        risk_score: clamp01(dueIn14 / 200),
        confidence: 0.9,
        recommended_action: "redistribute_load",
        payload: { dueIn14d: dueIn14 },
        predicted_failure_date: new Date(now.getTime() + 7 * 86400_000).toISOString(),
      });
    }

    if (forgetForecasts.length > 0) {
      const { error } = await supabase
        .from("predictive_recovery_forecasts")
        .insert(forgetForecasts);
      if (error) console.error("[PredictiveEngine v3] forecast insert error:", error);
    }

    return new Response(JSON.stringify({
      success: true,
      predictions: { approval: approvalProb, churn: churnRisk },
      forecasts_generated: forgetForecasts.length,
      details: { topicRisks: topicRisk.size, specRisks: specCount.size, dueIn14 },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[PredictiveEngine v3] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
