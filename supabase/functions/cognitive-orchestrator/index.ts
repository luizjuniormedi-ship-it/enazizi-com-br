
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, corsHeaders, logTelemetry } from "../_shared/unified-core.ts";
import { detectFatigue, calculateRetention } from "../_shared/cognitive-helpers.ts";
import { estimateTheta, IRTResponse } from "../_shared/irt-engine.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // 1. GATHER DATA
    const [fatigue, retention, { data: profiles }] = await Promise.all([
      detectFatigue(supabase, userId),
      calculateRetention(supabase, userId),
      supabase.from("profiles").select("exam_date").eq("user_id", userId).single(),
    ]);

    // 2. IRT ESTIMATION
    const { data: attempts } = await supabase
      .from("practice_attempts")
      .select("correct, questions_bank(difficulty)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const irtResponses: IRTResponse[] = (attempts || []).map((a: any) => ({
      correct: a.correct,
      item: {
        id: "placeholder",
        a: 1, // Discrimination default
        b: a.questions_bank?.difficulty || 0, // Difficulty
        c: 0.2, // Guessing default
      }
    }));

    const theta = estimateTheta(irtResponses);

    // 3. LOG SNAPSHOT
    const snapshot = {
      user_id: userId,
      fatigue_score: fatigue,
      retention_score: retention,
      overload_score: fatigue > 0.7 ? 0.8 : 0.2,
      engagement_score: 0.9, // Default for now
      abandonment_risk: fatigue > 0.9 ? 0.5 : 0.1,
      current_theta: theta,
      created_at: new Date().toISOString()
    };

    await supabase.from("cognitive_state_snapshots").insert(snapshot);

    // 4. ORCHESTRATION DECISION
    let nextAction = "study_session";
    let reasoning = "Plano padrão mantido.";
    let priority = 1;

    if (fatigue > 0.8) {
      nextAction = "recovery_mode";
      reasoning = "Fadiga crítica detectada. Iniciando protocolo de recuperação.";
      priority = 10;
    } else if (retention < 0.6) {
      nextAction = "review_fsrs";
      reasoning = "Retenção abaixo da meta. Priorizando revisões pendentes.";
      priority = 8;
    } else if (theta < -1) {
      nextAction = "tutor_explain";
      reasoning = "Dificuldade detectada em conceitos base. Ativando Tutor IA.";
      priority = 5;
    }

    const decision = {
      user_id: userId,
      source: "cognitive-orchestrator",
      decision_type: nextAction,
      priority,
      reasoning,
      input_snapshot: snapshot,
      output_action: { nextAction, priority, reasoning },
      confidence: 0.9
    };

    const { data: decisionData } = await supabase.from("orchestrator_decisions").insert(decision).select().single();

    // 5. AGENT LOGGING (Cognitive Supervisor) - Unified Telemetry
    await logTelemetry(supabase, "ORCHESTRATION_COMPLETE", { 
      decision_id: decisionData?.id, 
      nextAction,
      fatigue,
      retention
    }, userId);

    return new Response(JSON.stringify({
      success: true,
      decision: decisionData,
      snapshot
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Orchestrator Error:", err);
    return errorResponse(err.message, 500);
  }
});
