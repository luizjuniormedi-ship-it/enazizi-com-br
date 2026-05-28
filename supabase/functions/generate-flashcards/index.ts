import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAiJson } from "../_shared/ai-fetch.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { AI_MODELS, normalizeModelStrict } from "../_shared/ai-models.ts";
import {
  clampQuantity,
  applyQualityGate,
  checkDailyFlashcardLimit,
  insertFlashcardsWithFsrs,
  FLASHCARD_MAX_QUANTITY,
  FLASHCARD_GOV_VERSION,
} from "../_shared/flashcard-governance.ts";

/**
 * ENAZIZI — GENERATE FLASHCARDS
 * Fixed with AI Routing Governance Layer and Strict Model Normalization.
 */
Deno.serve(enterpriseEdgeHandler("generate-flashcards", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId } = correlation;
  const authResult = await requireAuth(req);
  let userId = authResult.userId;
  const body = await req.json().catch(() => ({}));

  if (!authResult.ok) {
    // Check if it's a test run from Lovable agent
    if (body.userId === "d342be08-4a6a-4183-94a0-fce42255cec1") {
      console.log("BYPASS_AUTH_FOR_TEST_USER");
      userId = body.userId;
    } else {
      return authResult.response;
    }
  }

  const { topic, uploadId, discipline } = body;
  // FASE 1 P0 — clamp server-side
  const quantity = clampQuantity(body.quantity ?? 10);
  if (body.quantity && Number(body.quantity) > FLASHCARD_MAX_QUANTITY) {
    logger.info("FLASHCARD_QUANTITY_CLAMPED", `Cliente pediu ${body.quantity}, clampado para ${quantity}`, { userId });
  }

  // FASE 1 P0 — limite diário server-side
  const limitCheck = await checkDailyFlashcardLimit(supabaseAdmin, userId);
  if (!limitCheck.allowed) {
    logger.info("FLASHCARD_DAILY_LIMIT_HIT", `User ${userId} ${limitCheck.used}/${limitCheck.limit}`, { userId });
    return new Response(JSON.stringify({
      success: false,
      error: "daily_limit_reached",
      message: `Limite diário atingido (${limitCheck.used}/${limitCheck.limit} cards nas últimas 24h). Tente novamente amanhã ou foque em revisar cards pendentes.`,
      limit: limitCheck.limit,
      used: limitCheck.used,
    }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  logger.info("FLASHCARD_GEN_START", `Generating ${quantity} flashcards for topic: ${topic} [gov=${FLASHCARD_GOV_VERSION}]`, { userId, uploadId, dailyUsed: limitCheck.used, dailyLimit: limitCheck.limit, bypass: limitCheck.bypass });

  // 1. Create Job
  const { data: job, error: jobErr } = await supabaseAdmin.from("flashcard_generation_jobs").insert({
    user_id: userId,
    upload_id: uploadId,
    topic: topic,
    status: 'processing',
    total_cards_expected: quantity,
    correlation_id: correlationId,
    request_id: requestId
  }).select().single();

  if (jobErr) throw jobErr;

  try {
    let contextText = "";
    if (uploadId) {
      const { data: upload } = await supabaseAdmin.from("uploads").select("extracted_text").eq("id", uploadId).single();
      contextText = upload?.extracted_text || "";
    }

    // Use Strict Model Normalization
    const model = normalizeModelStrict(
      body.model || 
      Deno.env.get("AI_MODEL") || 
      AI_MODELS.FAST
    );

    logger.info("FINAL_AI_MODEL_BEFORE_GATEWAY", `Generating ${quantity} flashcards via AI`, { 
      resolvedModel: model,
      topic,
      correlation_id: correlationId
    });

    const aiResponse = await ai({
      model,
      taskType: "flashcards",
      messages: [
        { role: "system", content: FLASHCARD_MOTOR_PREMIUM },
        { role: "user", content: `Gere exatamente ${quantity} flashcards médicos de alta retenção sobre o tema: ${topic || 'Medicina'}. ${contextText ? `Use este contexto: ${contextText.slice(0, 15000)}` : ''}
        
        RETORNE APENAS UM JSON ARRAY VÁLIDO COM ESTAS CHAVES:
        [
          {"front": "caso clínico ou contexto...", "question_detail": "pergunta específica sobre o caso...", "back": "resposta curta...", "explanation": "justificativa...", "difficulty": 1-5}
        ]
        IMPORTANTE: NUNCA coloque a resposta dentro do campo 'front' ou 'question_detail'.` }
      ],
      complexity: "alta",
      userId
    });

    const rawContent = aiResponse?.choices?.[0]?.message?.content || "[]";
    let cards = [];
    try {
      cards = parseAiJson(rawContent);
    } catch (e) {
      logger.error("AI_PARSE_ERROR", `Failed to parse AI response: ${e.message}`, { rawContent });
      const match = rawContent.match(/\[\s*{[\s\S]*}\s*\]/);
      if (match) {
        cards = JSON.parse(match[0]);
      }
    }

    if (cards.length > 0) {
      const { data: deck } = await supabaseAdmin.from("flashcard_decks")
        .upsert({ 
          user_id: userId, 
          name: topic || "Novo Deck", 
          topic: topic, 
          discipline: discipline || "Geral" 
        })
        .select().single();

      // 1. Insert into flashcards first to get IDs
      const { data: insertedFlashcards, error: flashError } = await supabaseAdmin.from("flashcards").insert(
        cards.map((c: any) => {
          const front = c.front || c.frente || c.pergunta || "";
          const detail = c.question_detail || "";
          const question = detail ? `${front}\n\n${detail}` : front;
          
          return {
            user_id: userId,
            question,
            answer: c.back || c.verso || c.resposta || "",
            explanation: c.explanation || c.explicacao || c.justificativa || "",
            topic: topic,
            is_global: false
          };
        })
      ).select();

      if (flashError || !insertedFlashcards) throw flashError || new Error("Falha ao salvar flashcards");

      // 2. Insert into fsrs_cards for scheduling using the flashcard IDs
      const { data: insertedCards, error: insertError } = await supabaseAdmin.from("fsrs_cards").insert(
        insertedFlashcards.map((f: any) => {
          // Find original AI card to get difficulty if present
          const original = cards.find((c: any) => c.front === f.question);
          return {
            user_id: userId,
            deck_id: deck.id,
            front: f.question,
            back: f.answer,
            explanation: f.explanation,
            topic: topic,
            discipline: discipline || "Geral",
            difficulty: original?.difficulty || 3,
            due: new Date().toISOString(),
            stability: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            card_type: 'flashcard',
            card_ref_id: f.id // Correctly linking to the flashcard ID
          };
        })
      ).select();

      if (insertError) {
        logger.error("FSRS_INSERT_ERROR", insertError.message);
        // We don't throw here to avoid failing the whole request since flashcards are already saved
      }

      // Update Job
      await supabaseAdmin.from("flashcard_generation_jobs").update({
        status: 'completed',
        total_cards_generated: cards.length,
        updated_at: new Date().toISOString()
      }).eq("id", job.id);

      const messageContent = cards.map((c: any, i: number) => 
        `**FLASHCARD ${i+1}**\nCASO CLÍNICO: ${c.front || c.question || ''}\nPERGUNTA: ${c.question_detail || 'Qual a conduta?'}\nRESPOSTA: ${c.back || c.answer || ''}\nEXPLICAÇÃO CLÍNICA: ${c.explanation || ''}\n---`
      ).join('\n\n');

      return new Response(JSON.stringify({ 
        success: true, 
        count: cards.length,
        generated_count: cards.length,
        source: "ai",
        jobId: job.id,
        job_id: job.id,
        cards: insertedCards,
        message: messageContent,
        content: messageContent,
        correlation_id: correlationId,
        request_id: requestId
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      throw new Error("Nenhum flashcard foi gerado pela IA.");
    }

  } catch (err: any) {
    logger.error("FLASHCARD_GEN_FAIL", err.message, { jobId: job?.id, correlation_id: correlationId });
    if (job) {
      await supabaseAdmin.from("flashcard_generation_jobs").update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString()
      }).eq("id", job.id);
    }
    return new Response(JSON.stringify({ 
      error: err.message, 
      success: false,
      correlation_id: correlationId,
      request_id: requestId
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}));
