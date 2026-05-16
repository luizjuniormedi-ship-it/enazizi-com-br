import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGES = [
  'mission',             // Bloco 1
  'roadmap',             // Bloco 2
  'layman',              // Bloco 3
  'technical',           // Bloco 4
  'pathophysiology',     // Bloco 5
  'clinical_reasoning',  // Bloco 6
  'differential_diagnosis', // Bloco 7
  'exam_tricks',         // Bloco 8
  'guidelines',          // Bloco 9
  'guided_question',     // Bloco 10
  'commented_correction',// Bloco 11
  'active_recall',       // Bloco 12
  'flashcards',          // Bloco 13
  'summary',             // Bloco 14
  'recovery_plan'        // Bloco 15
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

    // 2. Analyze user message to decide transition (V3 Adaptive Logic)
    let nextStage = currentStage;
    let transitionReason = "Mantendo estágio para consolidação.";
    let shouldAdvance = false;

    const lowerMsg = (userMessage || "").toLowerCase();
    
    // Positive signals: understanding, asking to continue, or giving a technical answer
    const positiveSignals = ["entendi", "compreendi", "pode continuar", "proximo", "próximo", "ok", "avançar", "avancar", "entendido", "perfeito", "exato", "correto"];
    const negativeSignals = ["não entendi", "confuso", "explica de novo", "repete", "dúvida", "duvida", "mais detalhe", "como assim"];
    
    // Heuristic: if user provides a technical answer (longer message) or positive signal
    const isTechnicalResponse = userMessage.length > 40;
    const isPositive = positiveSignals.some(s => lowerMsg.includes(s));
    const isNegative = negativeSignals.some(s => lowerMsg.includes(s));

    if ((isPositive || isTechnicalResponse) && !isNegative) {
      shouldAdvance = true;
    }

    // Special logic for validation stages: they REQUIRE a technical response
    const validationStages = ['guided_question', 'commented_correction', 'active_recall'];
    if (validationStages.includes(currentStage)) {
      if (userMessage.length > 15 && !isNegative) {
        shouldAdvance = true;
      } else {
        shouldAdvance = false;
        transitionReason = "Aguardando validação cognitiva profunda do aluno.";
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
