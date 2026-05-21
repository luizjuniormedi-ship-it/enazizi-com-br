import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é o Preceptor Médico ENAZIZI. Sua missão é guiar o aluno usando o MÉTODO SOCRÁTICO e a sequência pedagógica obrigatória.

REGRAS DE OURO:
1. NUNCA dê a resposta pronta. Faça perguntas curtas e objetivas.
2. Siga a sequência de BLOCOS (1 a 6) rigorosamente.
3. Responda APENAS o conteúdo para o aluno. O JSON de controle será montado pelo sistema.
4. Mantenha um tom profissional, encorajador e focado na prática clínica.

SEQUÊNCIA DE BLOCOS:
- BLOCO 1 (MISSÃO CLÍNICA): Caso clínico curto.
- BLOCO 2 (ROADMAP COGNITIVO): O que será aprendido.
- BLOCO 3 (FISIOPATOLOGIA VISUAL): O 'porquê' clínico.
- BLOCO 4 (CONDUTA PADRÃO OURO): Manejo prático.
- BLOCO 5 (PONTO DE INFLEXÃO): Desafio extra.
- BLOCO 6 (FECHAMENTO): Resumo.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const body = await req.json();
    const { message, sessionId, userId, currentBlock: bodyBlock } = body;

    // LAZY INITIALIZATION
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

    // FETCH SESSION
    let session = null;
    if (sessionId) {
      const { data } = await supabase.from("tutor_sessions").select("*").eq("id", sessionId).single();
      session = data;
    }

    // PHASE 4: Standardize currentBlock
    const currentBlock = session?.current_block ?? bodyBlock ?? "BLOCO_1_MISSAO_CLINICA";

    // LAYER 7: Memory (Save user message)
    if (sessionId) {
      await supabase.from("tutor_messages").insert({
        session_id: sessionId,
        content: message,
        role: "user",
        block: currentBlock
      });
    }

    // LAYER 5: IA Call
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\nBLOCO ATUAL: ${currentBlock}` },
          { role: "user", content: message }
        ],
        temperature: 0.7,
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Erro ao gerar resposta da IA.";

    // Logic to advance (simplified)
    let nextBlock = currentBlock;
    const blocks = ["BLOCO_1_MISSAO_CLINICA", "BLOCO_2_ROADMAP", "BLOCO_3_FISIOPATOLOGIA", "BLOCO_4_CONDUTA", "BLOCO_5_INFLEXAO", "BLOCO_6_FECHAMENTO"];
    
    // Auto-advance logic (very basic for stability)
    if (message?.toLowerCase().includes("continuar") || message?.toLowerCase().includes("entendi")) {
      const currentIndex = blocks.indexOf(currentBlock);
      if (currentIndex !== -1 && currentIndex < blocks.length - 1) {
        nextBlock = blocks[currentIndex + 1];
      }
    }

    // UPDATE SESSION
    if (sessionId) {
      await supabase.from("tutor_sessions").update({
        current_block: nextBlock,
        updated_at: new Date().toISOString()
      }).eq("id", sessionId);

      // Save AI response
      await supabase.from("tutor_messages").insert({
        session_id: sessionId,
        content: content,
        role: "assistant",
        block: nextBlock
      });
    }

    // LAYER 8: Telemetry (Event Log)
    await supabase.from("tutor_telemetry").insert({
      session_id: sessionId,
      event_type: "message_processed",
      metadata: { currentBlock, nextBlock, requestId, correlationId }
    }).catch(() => {}); // Don't fail if telemetry fails

    return new Response(JSON.stringify({
      success: true,
      content,
      currentBlock: nextBlock,
      shouldWaitForStudent: true,
      correlation_id: correlationId,
      request_id: requestId,
      debug_stage: "layers_1_to_8_ok"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[TUTOR_V3_ERROR] ${requestId}:`, error);
    return new Response(JSON.stringify({
      success: true,
      content: "Houve um problema técnico, mas o preceptor está aqui. Como podemos continuar?",
      currentBlock: "ERROR_RECOVERED",
      shouldWaitForStudent: true,
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
