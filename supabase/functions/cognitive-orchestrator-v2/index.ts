
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, getServiceClient, getUserIdFromRequest, jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { calculatePlannerPriority } from "../_shared/cognitive-governance-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);

    // 1. Gather all inputs for the Master Planner 2.1 Formula
    // Formula: PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) + (ImpactoClínico × 2) + (FraquezaLongitudinal × 2) - (Domínio × 2)

    const [health, profile, errors, fsrs, exam] = await Promise.all([
      supabase.from("pedagogical_health_indices").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("exam_date, level").eq("user_id", userId).maybeSingle(),
      supabase.from("error_bank").select("*").eq("user_id", userId).eq("dominado", false),
      supabase.from("user_topic_profiles").select("*").eq("user_id", userId),
      supabase.from("curriculum_weights").select("*") // Mock or real table with weights per topic
    ]);

    const examDate = profile.data?.exam_date ? new Date(profile.data.exam_date) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const daysToExam = Math.max(1, Math.ceil((examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    // 2. Identify Topics to prioritize
    const topicScores = fsrs.data?.map(t => {
      const errorCount = errors.data?.filter(e => e.tema === t.topic).length || 0;
      const weight = exam.data?.find(w => w.topic === t.topic)?.weight || 0.5;
      
      const priority = calculatePlannerPriority({
        errorRate: errorCount / 10,
        probOfFalling: weight,
        fsrsRisk: (1 - (t.retention || 0)),
        daysToExam: daysToExam,
        clinicalImpact: weight * 1.2, // Clinical impact often correlates with weight
        longitudinalWeakness: (t.lapses || 0) / 5,
        mastery: (t.stability || 0) / 100
      });

      return { topic: t.topic, priority, discipline: t.discipline };
    }) || [];

    const sortedTopics = topicScores.sort((a, b) => b.priority - a.priority).slice(0, 5);

    // 3. Detect Recovery Mode
    const healthScore = health.data?.health_score || 100;
    const isRecoveryMode = healthScore < 60 || (health.data?.metadata?.detected_cognitive_state === 'fatigue');

    // 4. Generate Daily Plan Projections
    const plan = sortedTopics.map((t, idx) => ({
      title: isRecoveryMode ? `[RECOVERY] Revisão guiada: ${t.topic}` : `Dominar: ${t.topic}`,
      topic: t.topic,
      priority: t.priority,
      duration: isRecoveryMode ? "20min" : "45min",
      type: isRecoveryMode ? "review" : "study",
      recovery_active: isRecoveryMode
    }));

    // 5. Governance Log
    await supabase.from("governance_logs").insert({
      user_id: userId,
      event_type: "planner_orchestration",
      details: {
        topics_count: topicScores.length,
        top_priority_topic: sortedTopics[0]?.topic,
        is_recovery_mode: isRecoveryMode,
        health_score: healthScore
      }
    });

    return jsonResponse({
      success: true,
      plan,
      is_recovery_mode: isRecoveryMode,
      health_score: healthScore,
      days_to_exam: daysToExam
    });

  } catch (error) {
    console.error("[CognitiveOrchestratorV2] Error:", error);
    return errorResponse(error.message, 500);
  }
});
