import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
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

    const { sessionId, message, context = {} } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get Session Info
    const { data: session } = await supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error("Session not found");

    // 2. Build Context
    const specialty = session.specialty || "Clínica Médica";
    const topic = session.topic || "Medicina";
    
    // 3. Save User Message
    await supabase.from("tutor_messages").insert({
      tutor_session_id: sessionId,
      user_id: userId,
      role: "user",
      content: message
    });

    // 4. Call AI (Clean V2 Implementation)
    const systemPrompt = `Você é o Tutor IA V2 do ENAZIZI, um assistente médico pedagógico avançado.
Sua missão é ajudar o aluno a dominar o tema: ${topic} (${specialty}).

DIRETRIZES:
1. Seja socrático: faça perguntas que levem ao raciocínio clínico.
2. Seja técnico mas didático.
3. Use a bibliografia oficial (Harrison, Nelson, etc).
4. Identifique lacunas de conhecimento.
5. Sugira flashcards ou mnemônicos quando apropriado.

CONTEXTO ADAPTATIVO:
- Especialidade: ${specialty}
- Tema: ${topic}
- Subtema: ${session.subtopic || 'Geral'}`;

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
    const assistantMessage = aiResult.choices?.[0]?.message?.content;

    // 5. Save Assistant Message
    await supabase.from("tutor_messages").insert({
      tutor_session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
      metadata: {
        model: "gpt-4o",
        tokens: aiResult.usage?.total_tokens
      }
    });

    // 6. Log Observability Event
    await supabase.from("tutor_v2_events").insert({
      user_id: userId,
      session_id: sessionId,
      event_type: "message_sent",
      model: "gpt-4o",
      tokens: aiResult.usage?.total_tokens,
      success: true
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      content: assistantMessage 
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
