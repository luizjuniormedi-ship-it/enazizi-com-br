import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { sessionId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get Session & Messages
    const { data: session } = await supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    const { data: messages } = await supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("tutor_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!session) throw new Error("Session not found");

    const history = messages?.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    // 2. Generate Lesson Content
    const systemPrompt = `Você é um Gerador de Aulas Médicas do ENAZIZI.
Gere uma aula textual estruturada baseada na conversa do aluno.
A aula deve seguir este esquema JSON exato:
{
  "title": "...",
  "objectives": ["...", "..."],
  "intro_layman": "...",
  "technical_explanation": "...",
  "physiopathology": "...",
  "clinical_application": "...",
  "exam_points": ["...", "..."],
  "fixation_questions": [
    { "question": "...", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "..." }
  ],
  "summary": "...",
  "next_mission": "..."
}`;

    const aiResponse = await aiFetch({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere uma aula sobre ${session.topic}. Histórico:\n${history}` }
      ],
      model: "openai/gpt-4o",
      response_format: { type: "json_object" }
    });

    if (!aiResponse.ok) throw new Error("AI provider error");

    const aiResult = await aiResponse.json();
    const lessonContent = JSON.parse(aiResult.choices[0].message.content);

    // 3. Save Lesson
    const { data: lesson, error: lessonError } = await supabase
      .from("tutor_lessons")
      .insert({
        user_id: userId,
        session_id: sessionId,
        title: lessonContent.title,
        content: lessonContent,
        source_message_count: messages?.length || 0,
        lesson_type: "aula_completa"
      })
      .select()
      .single();

    if (lessonError) throw lessonError;

    // 4. Log Observability Event
    await supabase.from("tutor_v2_events").insert({
      user_id: userId,
      session_id: sessionId,
      event_type: "lesson_generated",
      model: "gpt-4o",
      success: true
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      lesson 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[GENERATE-TUTOR-V2-LESSON] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
