import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { runAI } from "../_shared/ai-runtime-orchestrator.ts";
import { validateFlashcardQuality } from "../_shared/flashcard-governance.ts";

/**
 * ENAZIZI — FLASHCARD SANITIZATION ENGINE
 * Identifies and rewrites legacy "disguised question" flashcards.
 */
Deno.serve(enterpriseEdgeHandler("flashcard-sanitization", async ({ req, logger, supabaseAdmin, correlation }) => {
  const { user } = await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  
  const batchSize = Math.min(body.batch_size || 5, 20);
  const dryRun = body.dry_run !== false;

  logger.info("SANITIZATION_START", `Auditing ${batchSize} cards`, { dryRun });

  // 1. Identify legacy/contaminated cards
  // Strategy: Created before June, or containing banned patterns, or too long
  const { data: legacyCards, error: fetchError } = await supabaseAdmin
    .from("flashcards")
    .select("*")
    .or("created_at.lt.2026-06-05,question.ilike.%alternativa%,answer.ilike.%alternativa%,question.ilike.% A)%,question.ilike.% B)%")
    .limit(batchSize);

  if (fetchError) throw fetchError;

  const results = [];

  for (const card of (legacyCards || [])) {
    const quality = validateFlashcardQuality(card);
    
    if (quality.ok && !card.question.includes("A)")) {
      results.push({ id: card.id, status: "SKIPPED", reason: "Already compliant" });
      continue;
    }

    if (dryRun) {
      results.push({ id: card.id, status: "PENDING_REWRITE", reason: quality.reason || "legacy_format" });
      continue;
    }

    // 2. Rewrite via AI Premium Motor
    try {
      const aiResponse = await runAI({
        taskType: "flashcard",
        complexity: "high",
        messages: [
          { role: "system", content: FLASHCARD_MOTOR_PREMIUM },
          { role: "user", content: `Converta este flashcard antigo/contaminado em um flashcard PREMIUM (atômico, curto, sem alternativas).
          
          CARD ANTIGO:
          FRENTE: ${card.question}
          VERSO: ${card.answer}
          
          REESCREVA EM JSON: {"front": "...", "back": "...", "explanation": "..."}` }
        ],
        userId: user.id,
        supabase: supabaseAdmin
      });

      const parsed = JSON.parse(aiResponse.content);
      
      const { error: updateError } = await supabaseAdmin
        .from("flashcards")
        .update({
          question: parsed.front,
          answer: parsed.back,
          explanation: parsed.explanation || card.explanation,
          generation_method: "sanitized_v1",
          updated_at: new Date().toISOString()
        })
        .eq("id", card.id);

      if (updateError) throw updateError;
      results.push({ id: card.id, status: "SANITIZED" });

    } catch (err) {
      logger.error("REWRITE_FAIL", `Card ${card.id} failed rewrite`, { error: err.message });
      results.push({ id: card.id, status: "FAILED", error: err.message });
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    processed: results.length,
    results 
  }), { headers: corsHeaders });
}));
