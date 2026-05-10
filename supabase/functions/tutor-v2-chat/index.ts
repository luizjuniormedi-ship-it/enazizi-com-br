import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

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

    // 1. Get Session & History
    const { data: session } = await supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error("Session not found");

    const { data: history } = await supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("tutor_session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10);

    // Get medical context
    const { data: contextData } = await supabase.functions.invoke("tutor-v2-context-builder");
    const context = contextData?.context || {};

    // 2. Build AI Prompt with OFFICIAL PEDAGOGICAL NUCLEUS
    const systemPrompt = `${PROMPT_COMPLETO}

CONTEXTO DA SESSÃO ATUAL:
Tema: ${session.topic}
Especialidade: ${session.specialty || 'Geral'}

CONTEXTO DO ALUNO:
- Missão Ativa: ${context.mission?.title || 'Exploração Livre'}
- Lacunas detectadas (erros): ${context.errors?.map((e: any) => e.topic).join(', ') || 'Nenhuma detectada'}
- Status FSRS: ${context.fsrs?.pending_reviews || 0} revisões pendentes.

INSTRUÇÃO OPERACIONAL:
Use bibliografia oficial. Seja socrático. Adote o modo de resposta obrigatório do Protocolo ENAZIZI.
Sempre que detectar um conceito chave, adicione FLASHCARD_SUGGESTION: {"front": "...", "back": "..."} ao final (opcional).`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    const aiResponse = await aiFetch({
      messages,
      model: "openai/gpt-4o",
      temperature: 0.7
    });

    if (!aiResponse.ok) throw new Error("AI provider error");

    const aiResult = await aiResponse.json();
    let assistantMessage = aiResult.choices?.[0]?.message?.content;

    // Extract flashcard suggestion if present
    let flashcardSuggestion = null;
    if (assistantMessage.includes("FLASHCARD_SUGGESTION:")) {
      const parts = assistantMessage.split("FLASHCARD_SUGGESTION:");
      assistantMessage = parts[0].trim();
      try {
        flashcardSuggestion = JSON.parse(parts[1].trim());
      } catch (e) {
        console.error("Error parsing flashcard suggestion:", e);
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
        model: "gpt-4o",
        context_version: "v2.1"
      }
    });

    // 4. Log Event
    await supabase.from("tutor_events").insert({
      user_id: userId,
      session_id: sessionId,
      event_type: "message_sent",
      topic: session.topic,
      payload: { model: "gpt-4o" }
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