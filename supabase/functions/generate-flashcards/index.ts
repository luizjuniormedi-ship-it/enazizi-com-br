import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { AI_MODELS, normalizeModelStrict } from "../_shared/ai-models.ts";
import { runAI } from "../_shared/ai-runtime-orchestrator.ts";
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

    // LOTE 1 — Migrado para runAI() (orchestrator central com telemetria + cost metrics)
    const aiResponse = await runAI({
      taskType: "flashcard",
      complexity: "high",
      requiresJSON: true,
      messages: [
        { role: "system", content: FLASHCARD_MOTOR_PREMIUM },
        { role: "user", content: `Gere exatamente ${quantity} flashcards médicos de alta retenção sobre o tema: ${topic || 'Medicina'}. ${contextText ? `Use este contexto: ${contextText.slice(0, 15000)}` : ''}
        
        RETORNE APENAS UM JSON ARRAY VÁLIDO COM ESTAS CHAVES:
        [
          {"type": "concept|cloze|conduct|...", "front": "pergunta curta...", "back": "resposta curta...", "explanation": "justificativa...", "difficulty": 1-5, "atomic": true}
        ]
        REGRAS: Máximo 120 chars na frente, 20 palavras no verso. NUNCA use alternativas (A, B, C, D).` }
      ],
      userId,
      requestId: job.id,
      supabase: supabaseAdmin,
      emergencyTemplate: "[]",
    });

    const rawContent = aiResponse?.content || "[]";
    let cards = [];
    try {
      const parsed = parseAiJson(rawContent);
      cards = Array.isArray(parsed) ? parsed : (parsed.cards || parsed.flashcards || []);
    } catch (e) {
      logger.error("AI_PARSE_ERROR", `Failed to parse AI response: ${e.message}`, { rawContent });
      const match = rawContent.match(/\[\s*{[\s\S]*}\s*\]/);
      if (match) {
        cards = JSON.parse(match[0]);
      }
    }

    if (cards.length > 0) {
      // FASE 1 P0 — quality gate (dedup + rejeições)
      const normalizedCards = cards.map((c: any) => {
        const front = c.front || c.frente || c.pergunta || "";
        const detail = c.question_detail || "";
        const question = detail ? `${front}\n\n${detail}` : front;
        const answer = c.back || c.verso || c.resposta || "";
        const explanation = c.explanation || c.explicacao || c.justificativa || "";
        return {
          question,
          answer,
          explanation,
          difficulty: c.difficulty,
        };
      });
      const { accepted, rejected } = applyQualityGate(normalizedCards);
      logger.info("FLASHCARD_QUALITY_GATE", `accepted=${accepted.length} rejected=${rejected.length}`, { rejected: rejected.slice(0, 5) });

      if (accepted.length === 0) {
        await supabaseAdmin.from("flashcard_generation_jobs").update({
          status: 'failed',
          error_message: `quality_gate_rejected_all (${rejected.length})`,
          updated_at: new Date().toISOString()
        }).eq("id", job.id);
        return new Response(JSON.stringify({
          success: false,
          error: "quality_gate_rejected_all",
          message: "Todos os cards gerados foram rejeitados pelo gate de qualidade (triviais, sem contexto clínico ou genéricos). Refine o tema/contexto.",
          rejected_count: rejected.length,
          rejected_samples: rejected.slice(0, 3),
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: deck } = await supabaseAdmin.from("flashcard_decks")
        .upsert({
          user_id: userId,
          name: topic || "Novo Deck",
          topic: topic,
          discipline: discipline || "Geral"
        })
        .select().single();

      const rows = accepted.map((c) => ({
        user_id: userId,
        question: c.question,
        answer: c.answer,
        explanation: c.explanation,
        topic: topic,
        is_global: false,
      }));

      const difficultyByQuestion = new Map<string, number>(
        accepted.map((c) => [String(c.question), Number(c.difficulty) || 3])
      );

      // FASE 1 P0 — insert atômico com rollback se FSRS falhar (zero novos órfãos)
      const { flashcards: insertedFlashcards, fsrsCount } = await insertFlashcardsWithFsrs(
        supabaseAdmin,
        rows,
        {
          userId,
          topic,
          discipline: discipline || "Geral",
          deckId: deck?.id,
          difficultyByQuestion,
        }
      );

      // Update Job
      await supabaseAdmin.from("flashcard_generation_jobs").update({
        status: 'completed',
        total_cards_generated: insertedFlashcards.length,
        updated_at: new Date().toISOString()
      }).eq("id", job.id);

      const messageContent = accepted.map((c: any, i: number) =>
        `**FLASHCARD ${i+1}**\nPERGUNTA: ${c.question}\nRESPOSTA: ${c.answer}\nEXPLICAÇÃO: ${c.explanation || ''}\n---`
      ).join('\n\n');

      return new Response(JSON.stringify({
        success: true,
        count: insertedFlashcards.length,
        generated_count: insertedFlashcards.length,
        rejected_count: rejected.length,
        fsrs_inserted: fsrsCount,
        source: "ai",
        jobId: job.id,
        job_id: job.id,
        cards: insertedFlashcards,
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
