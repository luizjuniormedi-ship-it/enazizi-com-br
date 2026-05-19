/**
 * Autonomous Planner Engine v3 — Pedagogical Orchestration
 *
 * Toma decisões automáticas de orquestração baseadas em:
 *   - cognitive_analytics (fadiga, retenção, abandonment, mastery)
 *   - trajectory_health_scores (score-mestre + pre_exam_mode)
 *   - cognitive_predictions (overload, churn, approval)
 *   - cognitive_profiles (tolerância a fadiga)
 *
 * Aplica:
 *   - reduzir carga em sobrecarga
 *   - aumentar revisão se retenção cai
 *   - PRE-EXAM MODE: corta teoria, aumenta active recall + simulados
 *   - recuperação intensiva se collapse_risk alto
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const [cogRes, healthRes, predRes, profileRes, fatigueRes] = await Promise.all([
      supabase.from("cognitive_analytics").select("*").eq("user_id", user_id)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("trajectory_health_scores").select("*").eq("user_id", user_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("cognitive_predictions").select("*").eq("user_id", user_id)
        .eq("prediction_type", "approval")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("cognitive_profiles").select("*").eq("user_id", user_id).maybeSingle(),
      supabase.from("fatigue_metrics" as any).select("*").eq("user_id", user_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const cog: any = cogRes.data ?? {};
    const health: any = healthRes.data ?? {};
    const pred: any = predRes.data ?? {};
    const profile: any = profileRes.data ?? {};
    const fatigueMet: any = fatigueRes.data ?? {};

    // Defaults
    let dailyQuestionLimit = 50;
    let dailyReviewMultiplier = 1.0;
    let theoryWeight = 1.0;
    let simuladoWeight = 1.0;
    let recoveryMode: "off" | "light" | "intensive" = "off";
    let mode: "default" | "pre_exam" | "recovery" | "consolidation" = "default";
    const reasons: string[] = [];

    const fatigueTolerance = profile?.fatigue_tolerance_index ?? 1.0;
    const currentFatigue = (cog.fatigue_score ?? 0) / 100;
    const collapseRisk = cog.collapse_risk ?? 0;
    const retention = cog.overall_retention ?? 0.7;
    const consistency = cog.consistency_index ?? 0.5;

    // 1) Pre-exam mode tem prioridade máxima
    if (health.pre_exam_mode) {
      mode = "pre_exam";
      dailyQuestionLimit = 70;
      dailyReviewMultiplier = 1.4;
      theoryWeight = 0.3;
      simuladoWeight = 2.0;
      reasons.push("Pre-exam window (<=15d): focus on active recall + simulados");
    } else if (collapseRisk > 0.7) {
      // 2) Colapso iminente
      mode = "recovery";
      recoveryMode = "intensive";
      dailyQuestionLimit = 20;
      dailyReviewMultiplier = 1.8;
      theoryWeight = 0.4;
      simuladoWeight = 0.5;
      reasons.push("Imminent cognitive collapse: intensive recovery");
    } else if (currentFatigue > 0.7 * fatigueTolerance) {
      // 3) Fadiga alta
      mode = "recovery";
      recoveryMode = "light";
      dailyQuestionLimit = Math.round(dailyQuestionLimit * 0.6);
      dailyReviewMultiplier = 1.5;
      reasons.push("Fatigue above tolerance: reducing load");
    } else if (retention < 0.6) {
      // 4) Retenção caindo
      mode = "consolidation";
      dailyReviewMultiplier = 1.5;
      theoryWeight = 0.7;
      reasons.push("Retention below 60%: consolidate before new content");
    } else if (consistency < 0.4) {
      // 5) Baixa consistência: micro-sessões
      dailyQuestionLimit = 30;
      reasons.push("Low consistency: micro-sessions to rebuild habit");
    }

    // Adjuste de risco de churn → reduzir carga
    if (pred?.probability != null && pred.probability < 0.4) {
      dailyQuestionLimit = Math.round(dailyQuestionLimit * 0.8);
      reasons.push("Low approval probability: easing load to prevent churn");
    }

    const adjustments = {
      mode,
      recoveryMode,
      dailyQuestionLimit,
      dailyReviewMultiplier,
      theoryWeight,
      simuladoWeight,
    };

    // Persistir adjustment no study_plans ativo (se existir)
    await supabase
      .from("study_plans" as any)
      .update({
        daily_questions_target: dailyQuestionLimit,
        review_intensity: dailyReviewMultiplier,
        autonomous_adjustment_at: new Date().toISOString(),
        autonomous_mode: mode,
      })
      .eq("user_id", user_id)
      .eq("status", "active");

    // Log da decisão
    await supabase.from("cognitive_telemetry" as any).insert({
      user_id,
      event_type: "autonomous_orchestration",
      payload: {
        adjustments,
        reasons,
        signals: {
          fatigue: currentFatigue,
          collapseRisk,
          retention,
          consistency,
          healthScore: health.health_score,
          preExam: health.pre_exam_mode,
        },
      },
    });

    return new Response(JSON.stringify({
      success: true,
      adjustments,
      reasons,
      signals: {
        currentFatigue,
        fatigueTolerance,
        collapseRisk,
        retention,
        consistency,
        healthScore: health.health_score,
        classification: health.classification,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[AutonomousPlannerEngine v3] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
