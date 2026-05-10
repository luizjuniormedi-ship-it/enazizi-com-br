import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { sessionId, message } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get Session & Context
    const { data: session } = await supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error("Session not found");

    // Get medical context
    const { data: contextData } = await supabase.functions.invoke("tutor-v2-context-builder");
    const context = contextData?.context || {};

    // 2. Build AI Prompt with Medical Quality Map
    const systemPrompt = `Você é o Tutor IA V2 do ENAZIZI.
Tema: ${session.topic} (${session.specialty})

DIRETRIZES MÉDICAS:
- Use bibliografia oficial.
- Se for Cardio, foque em Braunwald/SBC.
- Se for GO, foque em Williams/Febrasgo.
- Seja socrático.

CONTEXTO DO ALUNO:
- Missão: ${context.mission?.title || 'Exploração Livre'}
- Erros recentes: ${context.errors?.map((e: any) => e.topic).join(', ') || 'Nenhum'}

INSTRUÇÃO ESPECIAL:
Sempre que detectar um conceito chave, adicione ao final da resposta (separado por ---) uma sugestão de flashcard no formato:
FLASHCARD_SUGGESTION: {"front": "...", "back": "..."}`;

    const aiResponse = await aiFetch({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      model: "openai/gpt-4o",
      temperature: 0.7
    });

    if (!aiResponse.ok) throw new Error("AI provider error");

    const aiResult = await aiResponse.json();
    let assistantMessage = aiResult.choices?.[0]?.message?.content;

    // Extract flashcard suggestion if present
    let flashcardSuggestion = null;
    if (assistantMessage.includes("FLASHCARD_SUGGESTION:")) {
      const parts = assistantMessage.split("---");
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes("FLASHCARD_SUGGESTION:")) {
        try {
          const jsonStr = lastPart.split("FLASHCARD_SUGGESTION:")[1].trim();
          flashcardSuggestion = JSON.parse(jsonStr);
          assistantMessage = assistantMessage.replace(/---.*FLASHCARD_SUGGESTION:.*$/s, "").trim();
        } catch (e) {
          console.error("Error parsing flashcard suggestion:", e);
        }
      }
    }

    // 3. Save Assistant Message
    await supabase.from("tutor_messages").insert({
      tutor_session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
      metadata: {
        flashcard_suggestion: flashcardSuggestion,
        model: "gpt-4o"
      }
    });

    // 4. Log Event
    await supabase.from("tutor_v2_events").insert({
      user_id: userId,
      session_id: sessionId,
      event_type: "message_sent",
      success: true
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      content: assistantMessage,
      flashcardSuggestion
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[TUTOR-V2-CHAT] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
