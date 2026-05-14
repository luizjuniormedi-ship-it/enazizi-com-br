import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, getAdmin, jsonOk, jsonError, extractUserId,
  callAIWithGovernance, parseAiJsonSafe, contentHash,
  triggerHumanAudit, updateQuestionLifecycle
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    const sb = getAdmin();

    // Verify if user is admin for massive scaling
    if (userId) {
      const { data: profile } = await sb.from("profiles").select("role").eq("id", userId).single();
      if (profile?.role !== 'admin') return jsonError("Acesso negado", 403);
    }

    const { totalToGenerate = 500, batchSize = 50, specialty } = await req.json();
    const batchId = crypto.randomUUID();

    console.log(`[MassiveScale] Starting generation of ${totalToGenerate} questions (batch size: ${batchSize}) for ${specialty || 'All'}`);

    // Create a governance queue entry
    await sb.from("governance_queues").insert({
      batch_id: batchId,
      queue_type: 'progressive',
      status: 'processing',
      payload: { totalToGenerate, batchSize, specialty }
    });

    // In a real production environment, this would be handled by a worker/queue.
    // Here we will process one batch to demonstrate the v13 protocol.
    const currentBatchCount = Math.min(batchSize, 50);
    
    const system = `Você é um professor de medicina de elite. Gere ${currentBatchCount} questões MCQ de nível Residência Médica.
    Use CASOS CLÍNICOS DENSOS (>450 chars). 
    Retorne APENAS um array JSON: [{"statement": "...", "options": ["A", "B", "C", "D"], "correct_index": 0, "explanation": "...", "topic": "...", "difficulty": 4}]`;

    const prompt = `Gere ${currentBatchCount} questões sobre ${specialty || "temas variados de Clínica Médica"}.
    FOCO: Raciocínio clínico profundo e diretrizes 2024.`;

    const raw = await callAIWithGovernance("massive_scale_gen", "heavy", system, prompt);
    const questions = parseAiJsonSafe(raw);

    if (!Array.isArray(questions)) throw new Error("AI did not return an array");

    let imported = 0;
    let duplicates = 0;

    for (const q of questions) {
      const hash = await contentHash(q.statement);
      
      // Semantic Deduplication Check
      const { data: existing } = await sb.from("questions_bank")
        .select("id")
        .eq("embedding_hash", hash)
        .maybeSingle();

      if (existing) {
        duplicates++;
        continue;
      }

      const { data: inserted, error: insertError } = await sb.from("questions_bank").insert({
        statement: q.statement,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        topic: q.topic || specialty,
        difficulty: q.difficulty || 3,
        lifecycle_state: 'generated',
        embedding_hash: hash,
        batch_id: batchId,
        is_global: true
      }).select().single();

      if (inserted) {
        imported++;
        
        // Every 100th overall (simplified logic here: check a counter or random)
        if (Math.random() < 0.1) { // 10% chance for human audit trigger as per Phase 9
          await triggerHumanAudit(inserted.id, 'random');
        }
      }
    }

    // Update queue status
    await sb.from("governance_queues")
      .update({ status: 'completed', payload: { imported, duplicates, totalGenerated: questions.length } })
      .eq("batch_id", batchId);

    return jsonOk({
      message: "Batch processed",
      batchId,
      stats: {
        totalGenerated: questions.length,
        imported,
        duplicates
      }
    });

  } catch (e) {
    console.error("[MassiveScale] Error:", e);
    return jsonError(e.message, 500);
  }
});
