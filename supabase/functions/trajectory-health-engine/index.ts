/**
 * Trajectory Health Engine — TrajectoryHealthScore (Master Metric)
 *
 * Consolida todos os sinais longitudinais em um score-mestre 0–100
 * + classificação: excellent | stable | critical | high_risk | imminent_collapse
 *
 * Componentes:
 *   delay, retention, consistency, execution, fatigue, recovery, simulado, longitudinal_risk
 *
 * Considera proximidade da prova → ativa pre_exam_mode (≤ 15 dias).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function classify(score: number, collapse: number): string {
  if (collapse > 0.8) return "imminent_collapse";
  if (score >= 80) return "excellent";
  if (score >= 60) return "stable";
  if (score >= 40) return "critical";
  return "high_risk";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [cogRes, snapRes, profileRes, plansRes] = await Promise.all([
      supabase.from("cognitive_analytics").select("*").eq("user_id", userId)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("trajectory_snapshots").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("exam_date").eq("user_id", userId).maybeSingle(),
      supabase.from("study_plan_tasks").select("id,status,date")
        .eq("user_id", userId)
        .lte("date", new Date().toISOString().slice(0, 10))
        .limit(500),
    ]);

    const cog: any = cogRes.data ?? {};
    const snap: any = snapRes.data ?? {};
    const profile: any = profileRes.data ?? {};
    const tasks: any[] = plansRes.data ?? [];

    // Delay: % de tasks vencidas não concluídas
    const overdueTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "done").length;
    const delayScore = clamp100(100 - (tasks.length > 0 ? (overdueTasks / tasks.length) * 100 : 0));

    const retentionScore = clamp100((cog.overall_retention ?? 0.5) * 100);
    const consistencyScore = clamp100((cog.consistency_index ?? 0.5) * 100);
    const executionScore = clamp100(snap.overall_score ?? 50);
    const fatigueScore = clamp100(100 - (cog.fatigue_score ?? 0));
    const recoveryScore = clamp100((cog.recovery_success_rate ?? 0) * 100);
    const simuladoScore = clamp100(Math.min(100, (snap.simulado_count_last_28d ?? 0) * 25));
    const longitudinalRisk = clamp100(100 - ((cog.collapse_risk ?? 0) * 60 + (cog.abandonment_risk ?? 0) * 40));

    // Score-mestre ponderado
    const healthScore = clamp100(
      delayScore * 0.10 +
      retentionScore * 0.20 +
      consistencyScore * 0.15 +
      executionScore * 0.15 +
      fatigueScore * 0.10 +
      recoveryScore * 0.10 +
      simuladoScore * 0.05 +
      longitudinalRisk * 0.15
    );

    // Proximidade da prova
    let examProximityDays: number | null = null;
    let preExamMode = false;
    if (profile?.exam_date) {
      const dt = new Date(profile.exam_date);
      if (!Number.isNaN(dt.getTime())) {
        examProximityDays = Math.max(0, Math.floor((dt.getTime() - Date.now()) / 86400_000));
        preExamMode = examProximityDays <= 15;
      }
    }

    const classification = classify(healthScore, cog.collapse_risk ?? 0);

    const { data: inserted, error } = await supabase
      .from("trajectory_health_scores")
      .insert({
        user_id: userId,
        health_score: Number(healthScore.toFixed(2)),
        classification,
        delay_score: Number(delayScore.toFixed(2)),
        retention_score: Number(retentionScore.toFixed(2)),
        consistency_score: Number(consistencyScore.toFixed(2)),
        execution_score: Number(executionScore.toFixed(2)),
        fatigue_score: Number(fatigueScore.toFixed(2)),
        recovery_score: Number(recoveryScore.toFixed(2)),
        simulado_score: Number(simuladoScore.toFixed(2)),
        longitudinal_risk: Number(longitudinalRisk.toFixed(2)),
        exam_proximity_days: examProximityDays,
        pre_exam_mode: preExamMode,
        metadata: {
          source_cog: cog?.id ?? null,
          source_snapshot: snap?.id ?? null,
          tasks_total: tasks.length,
          overdue_tasks: overdueTasks,
        },
      })
      .select()
      .single();

    if (error) console.error("[TrajectoryHealthEngine] insert error:", error);

    return new Response(JSON.stringify({
      success: true,
      trajectory_health: inserted ?? {
        health_score: healthScore,
        classification,
        pre_exam_mode: preExamMode,
        exam_proximity_days: examProximityDays,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[TrajectoryHealthEngine] Fatal:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
