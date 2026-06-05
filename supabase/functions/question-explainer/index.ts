import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { runAI } from "../_shared/ai-runtime-orchestrator.ts";

/**
 * ENAZIZI — QUESTION EXPLAINER (Cache First)
 * Explains medical questions with clinical reasoning and key points.
 * Implements AI COST REDUCTION PHASE A.
 */
Deno.serve(enterpriseEdgeHandler("question-explainer", async ({ req, logger, supabaseAdmin, correlation }) => {
  const { requestId, correlationId } = correlation;
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  const { questionId, forceRefresh = false } = await req.json();

  if (!questionId) {
    return new Response(JSON.stringify({ error: "questionId is required" }), { status: 400, headers: corsHeaders });
  }

  // 1. Check Cache First (AI COST REDUCTION)
  if (!forceRefresh) {
    const { data: cached } = await supabaseAdmin
      .from("question_explanations")
      .select("*")
      .eq("question_id", questionId)
      .maybeSingle();

    if (cached) {
      console.log(`[EXPLANATION_CACHE_HIT] questionId=${questionId}`);
      return new Response(JSON.stringify({
        success: true,
        source: "cache",
        explanation: cached.explanation,
        clinical_reasoning: cached.clinical_reasoning,
        key_points: cached.key_points,
        requestId
      }), { headers: corsHeaders });
    }
  }

  // 2. Fetch Question Data
  const { data: question } = await supabaseAdmin
    .from("real_exam_questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (!question) {
    return new Response(JSON.stringify({ error: "Question not found" }), { status: 404, headers: corsHeaders });
  }

  // 3. Generate via AI (Premium Mode)
  console.log(`[AI_CALL_EXECUTED] task=question_explanation questionId=${questionId}`);
  const aiResponse = await runAI({
    taskType: "clinical_reasoning",
    complexity: "high",
    requiresJSON: true,
    messages: [
      { role: "system", content: "Você é um preceptor médico sênior. Explique a questão fornecida com profundidade acadêmica e clareza clínica." },
      { role: "user", content: `Questão: ${question.statement}
      Alternativas: ${JSON.stringify(question.options)}
      Correta: ${question.correct_index}
      
      Gere um JSON com:
      {
        "explanation": "Explicação didática das alternativas...",
        "clinical_reasoning": "O raciocínio clínico passo-a-passo para chegar à resposta...",
        "key_points": ["ponto 1", "ponto 2", "ponto 3"]
      }` }
    ],
    userId,
    requestId,
    supabase: supabaseAdmin
  });

  const parsed = JSON.parse(aiResponse.content);

  // 4. Save to Cache
  await supabaseAdmin.from("question_explanations").upsert({
    question_id: questionId,
    explanation: parsed.explanation,
    clinical_reasoning: parsed.clinical_reasoning,
    key_points: parsed.key_points,
    updated_at: new Date().toISOString()
  });

  // 5. Telemetry
  const costSaved = forceRefresh ? 0 : 0.02; // Estimated cost saved for future hits
  console.log(`[AI_COST_SAVED] amount=${costSaved} source=explanation_cache`);

  return new Response(JSON.stringify({
    success: true,
    source: "ai",
    ...parsed,
    requestId
  }), { headers: corsHeaders });
}));
