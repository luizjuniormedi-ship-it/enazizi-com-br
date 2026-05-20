import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { topic, uploadId, discipline } = body;

    let contextText = "";
    if (uploadId) {
      const { data: upload } = await supabaseAdmin.from("uploads").select("extracted_text").eq("id", uploadId).single();
      contextText = upload?.extracted_text || "";
    }

    const aiResponse = await aiFetch({
      model: "google/gemini-2.0-flash",
      messages: [
        { role: "system", content: FLASHCARD_MOTOR_PREMIUM },
        { role: "user", content: `Gere 5-10 flashcards sobre o tema: ${topic || 'Medicina'}. ${contextText ? `Use este contexto: ${contextText.slice(0, 10000)}` : ''}
        Retorne JSON array: [{"front": "...", "back": "...", "explanation": "...", "difficulty": 1-5}]` }
      ]
    });

    const result = await aiResponse.json();
    const cards = parseAiJson(result.choices?.[0]?.message?.content || "[]");

    if (cards.length > 0) {
      const { data: deck } = await supabaseAdmin.from("flashcard_decks")
        .upsert({ user_id: user.id, name: topic || "Novo Deck", topic: topic, discipline: discipline || "Geral" })
        .select().single();

      await supabaseAdmin.from("fsrs_cards").insert(
        cards.map((c: any) => ({
          user_id: user.id,
          deck_id: deck.id,
          front: c.front,
          back: c.back,
          explanation: c.explanation,
          topic: topic,
          discipline: discipline || "Geral",
          difficulty: c.difficulty || 3,
          due_at: new Date().toISOString()
        }))
      );
    }

    return new Response(JSON.stringify({ success: true, count: cards.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
