import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGES = [
  'mission',
  'layman',
  'technical',
  'pathophysiology',
  'clinical_reasoning',
  'practical_integration',
  'exam_tricks',
  'active_recall',
  'mini_test',
  'summary',
  'next_step'
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { sessionId, userMessage, history, context } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get Session state
    const { data: session, error: sessionError } = await supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: corsHeaders });
    }

    const currentStage = session.current_stage || 'mission';
    const currentIndex = STAGES.indexOf(currentStage);

    // 2. Analyze user message to decide transition
    // Simple transition logic: if message is short or positive, move forward
    // In a real scenario, we could use an AI call here to evaluate if the student "passed" the stage
    let nextStage = currentStage;
    let transitionReason = "Maintaining current stage";
    let shouldAdvance = false;

    const lowerMsg = (userMessage || "").toLowerCase();
    const positiveSignals = ["entendi", "compreendi", "pode continuar", "proximo", "próximo", "ok", "avançar", "avancar", "entendido"];
    const negativeSignals = ["não entendi", "confuso", "explica de novo", "repete", "dúvida", "duvida", "mais detalhe"];

    if (positiveSignals.some(s => lowerMsg.includes(s)) || (userMessage && userMessage.length < 30 && !negativeSignals.some(s => lowerMsg.includes(s)))) {
      shouldAdvance = true;
    }

    // Special logic for active_recall and mini_test: they REQUIRE a response and validation
    if (currentStage === 'active_recall' || currentStage === 'mini_test') {
      // Here we could add AI validation. For now, let's assume we need to stay until validated.
      // But for the sake of the demo/initial restoration, we'll advance if they answered anything.
      if (userMessage.length > 10) {
        shouldAdvance = true;
      } else {
        shouldAdvance = false;
        transitionReason = "Aguardando resposta ao desafio cognitivo.";
      }
    }

    if (shouldAdvance && currentIndex < STAGES.length - 1) {
      nextStage = STAGES[currentIndex + 1];
      transitionReason = `Avançando de ${currentStage} para ${nextStage}`;
      
      // Update session
      await supabase.from("tutor_sessions").update({
        current_stage: nextStage,
        cognitive_progress: Math.round(((currentIndex + 1) / STAGES.length) * 100)
      }).eq("id", sessionId);

      // Log stage transition
      await supabase.from("tutor_stage_history").insert({
        session_id: sessionId,
        user_id: userId,
        stage: nextStage,
        outcome_metadata: { reason: transitionReason, previous_stage: currentStage }
      });
    }

    return new Response(JSON.stringify({
      currentStage: nextStage,
      previousStage: currentStage,
      transitionReason,
      progress: Math.round(((STAGES.indexOf(nextStage)) / STAGES.length) * 100)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[TUTOR_ORCHESTRATOR] Error:", error);
    return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500, headers: corsHeaders });
  }
});
