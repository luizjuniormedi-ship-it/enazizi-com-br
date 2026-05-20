import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { aiFetch, cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { logAiUsage, buildPromptHash, getCachedAIResponse, saveAIResponseToCache, logAIUsage, CACHE_TTL_DAYS } from "../_shared/ai-cache.ts";
import { isValidQuestion, hasMinimumContext, validateQuestionContext, logGenerationRejection, IMAGE_REF_PATTERN, ENGLISH_PATTERN } from "../_shared/question-filters.ts";
import { validateQuestionBatch } from "../_shared/ai-validation.ts";
import { PROFILES, resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { fetchDynamicBlueprint } from "../_shared/dynamic-blueprints.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";

Deno.serve(enterpriseEdgeHandler("question-generator", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));

  const { 
    messages: rawMessages, 
    userContext, 
    difficulty, 
    outputFormat, 
    avoidStatements, 
    generationContext, 
    targetExam, 
    count,
    topicWeights,
    specialty
  } = body;

  const isJsonMode = outputFormat === "json";
  const requestedCount = Math.min(Number(count ?? 10), 20);
  const safeTargetExam = String(targetExam || "default");
  const bancaInfo = resolveBanca(safeTargetExam);

  let systemPrompt = QUESTION_MOTOR_PREMIUM;
  systemPrompt += buildBancaBlock(bancaInfo.profile);

  if (isJsonMode) {
    const aiResponse = await ai({
      taskType: "generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere ${requestedCount} questões médicas em JSON. Especialidade: ${specialty || (generationContext && generationContext.specialty) || "Geral"}.` }
      ],
      complexity: "high"
    });

    const rawContent = aiResponse.choices?.[0]?.message?.content || "[]";
    let questions = parseAiJson(rawContent);

    if (Array.isArray(questions)) {
      questions = questions.map(q => ({
        ...q,
        topic: q.topic || specialty || "Geral",
        metadata: { generation_engine: "ENAZIZI Question Motor v3.1 (Unified ALOS)" }
      }));
    }

    // Persistência Longitudinal do Simulado no Banco de Dados
    if (questions.length > 0) {
      const { data: session } = await supabaseAdmin.from("simulado_sessions").insert({
        user_id: user.id,
        mode: body.mode || 'estudo',
        total_questions: questions.length,
        status: 'active',
        metadata: { ...generationContext, source: 'ai_generator' }
      }).select().single();

      if (session) {
        await supabaseAdmin.from("simulado_questions").insert(
          questions.map((_, idx) => ({
            session_id: session.id,
            order_index: idx
          }))
        );
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      questions, 
      choices: [{ message: { content: JSON.stringify(questions) } }] 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Fallback for chat
  const aiResponse = await ai({
    taskType: "reasoning",
    messages: [{ role: "system", content: systemPrompt }, ...(rawMessages || [])],
    complexity: "medium"
  });

  return new Response(JSON.stringify(aiResponse), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}));
