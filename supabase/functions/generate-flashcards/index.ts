import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";

Deno.serve(enterpriseEdgeHandler("generate-flashcards", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await (async () => {
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    return { user };
  })();
  
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { topic, uploadId, discipline, quantity = 10 } = body;

  logger.info("FLASHCARD_GEN_START", `Generating ${quantity} flashcards for topic: ${topic}`, { userId: user.id, uploadId });

  // 1. Create Job
  const { data: job } = await supabaseAdmin.from("flashcard_generation_jobs").insert({
    user_id: user.id,
    upload_id: uploadId,
    topic: topic,
    status: 'processing',
    total_cards_expected: quantity
  }).select().single();

  try {
    let contextText = "";
    if (uploadId) {
      const { data: upload } = await supabaseAdmin.from("uploads").select("extracted_text").eq("id", uploadId).single();
      contextText = upload?.extracted_text || "";
    }

    const aiResponse = await ai({
      taskType: "flashcards",
      messages: [
        { role: "system", content: FLASHCARD_MOTOR_PREMIUM },
        { role: "user", content: `Gere exatamente ${quantity} flashcards sobre o tema: ${topic || 'Medicina'}. ${contextText ? `Use este contexto: ${contextText.slice(0, 15000)}` : ''}
        Retorne JSON array: [{"front": "...", "back": "...", "explanation": "...", "difficulty": 1-5}]` }
      ],
      complexity: "high"
    });

    const cards = parseAiJson(aiResponse.choices?.[0]?.message?.content || "[]");

    if (cards.length > 0) {
      const { data: deck } = await supabaseAdmin.from("flashcard_decks")
        .upsert({ 
          user_id: user.id, 
          name: topic || "Novo Deck", 
          topic: topic, 
          discipline: discipline || "Geral" 
        })
        .select().single();

      const { data: insertedCards, error: insertError } = await supabaseAdmin.from("fsrs_cards").insert(
        cards.map((c: any) => ({
          user_id: user.id,
          deck_id: deck.id,
          front: c.front,
          back: c.back,
          explanation: c.explanation,
          topic: topic,
          discipline: discipline || "Geral",
          difficulty: c.difficulty || 3,
          due: new Date().toISOString(),
          stability: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          card_type: 'flashcard',
          card_ref_id: crypto.randomUUID() // Temporary until we decide on ref strategy
        }))
      ).select();

      if (insertError) throw insertError;

      // Also insert into old flashcards table for compatibility if needed
      await supabaseAdmin.from("flashcards").insert(
        cards.map((c: any) => ({
          user_id: user.id,
          question: c.front,
          answer: c.back,
          explanation: c.explanation,
          topic: topic,
          is_global: false
        }))
      );

      // Update Job
      await supabaseAdmin.from("flashcard_generation_jobs").update({
        status: 'completed',
        total_cards_generated: cards.length,
        updated_at: new Date().toISOString()
      }).eq("id", job.id);

      // Format as text for AgentChat compatibility
      const messageContent = cards.map((c: any, i: number) => 
        `**FLASHCARD ${i+1}**\nCASO CLÍNICO: ${c.front}\nRESPOSTA: ${c.back}\nEXPLICAÇÃO CLÍNICA: ${c.explanation || ''}\n---`
      ).join('\n\n');

      return new Response(JSON.stringify({ 
        success: true, 
        count: cards.length,
        jobId: job.id,
        cards: insertedCards,
        message: messageContent, // For AgentChat
        content: messageContent  // For useTutorStream
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      throw new Error("Nenhum flashcard foi gerado pela IA.");
    }

  } catch (err: any) {
    logger.error("FLASHCARD_GEN_FAIL", err.message, { jobId: job?.id });
    if (job) {
      await supabaseAdmin.from("flashcard_generation_jobs").update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString()
      }).eq("id", job.id);
    }
    return new Response(JSON.stringify({ error: err.message, success: false }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}));
