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
    const { message, sessionId, currentBlock: bodyBlock, newTopic } = body;

    // LAZY CONFIG
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET USER FROM AUTH
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = user?.id;

    // FETCH SESSION (LAZY)
    let session = null;
    let sessionTopic = null;
    if (sessionId) {
      try {
        const { data } = await supabase.from("tutor_sessions").select("current_block, topic").eq("id", sessionId).maybeSingle();
        session = data;
        sessionTopic = data?.topic;
      } catch (err) {
        console.error("[TUTOR_V3] Error fetching session:", err);
      }
    }

    // PHASE 4: currentBlock standard
    let currentBlock = session?.current_block ?? bodyBlock ?? "BLOCO_1_MISSAO_CLINICA";
    
    // HANDLE TOPIC CHANGE
    if (newTopic) {
      console.log(`[TUTOR_V3] Changing topic to: ${newTopic}`);
      sessionTopic = newTopic;
      currentBlock = "BLOCO_1_MISSAO_CLINICA";
      
      if (sessionId) {
        await supabase.from("tutor_sessions").update({
          topic: newTopic,
          current_block: currentBlock,
          updated_at: new Date().toISOString()
        }).eq("id", sessionId);
      }
    }

    // LONGITUDINAL MEMORY FETCH
    let memoryContext = "";
    if (userId && sessionTopic) {
      try {
        const { data: memoryData } = await supabase
          .from("tutor_learning_memory")
          .select("*")
          .eq("user_id", userId)
          .eq("topic", sessionTopic)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (memoryData) {
          memoryContext = `
[MEMÓRIA LONGITUDINAL DO ALUNO]
- Tema já estudado antes: SIM
- Nível de domínio anterior: ${memoryData.mastery_level || 'Não registrado'}
- Principais erros prévios (Misconceptions): ${memoryData.misconceptions_detected?.join(", ") || 'Nenhum'}
- Analogias que funcionaram: ${memoryData.effective_analogies?.join(", ") || 'Nenhuma'}
- Ponto onde o aluno costuma travar: ${memoryData.explanation_summary || 'Não identificado'}
- Último bloco atingido anteriormente: ${memoryData.block_title || 'Não registrado'}
`;
          console.log(`[TUTOR_V3] Memory hydrated for topic: ${sessionTopic}`);
        } else {
          memoryContext = `
[MEMÓRIA LONGITUDINAL DO ALUNO]
- Tema já estudado antes: NÃO
`;
        }
      } catch (err) {
        console.error("[TUTOR_V3] Memory fetch error:", err);
      }
    }

    // LAYER 5: IA Call
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\nASSUNTO: ${sessionTopic || "Assunto Geral"}\nBLOCO ATUAL: ${currentBlock}\n${memoryContext}` },
          { role: "user", content: newTopic ? `Olá preceptor, quero mudar de assunto para: ${newTopic}. Vamos começar do Bloco 1 com um novo caso clínico.` : message }
        ],
        temperature: 0.7,
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Ocorreu um erro ao gerar a resposta da IA.";

    // Simple advancement logic (gating)
    let nextBlock = currentBlock;
    const blocks = ["BLOCO_1_MISSAO_CLINICA", "BLOCO_2_ROADMAP", "BLOCO_3_FISIOPATOLOGIA", "BLOCO_4_CONDUTA", "BLOCO_5_INFLEXAO", "BLOCO_6_FECHAMENTO"];
    
    // Check for explicit continuation
    const userWantsNext = !newTopic && (
                          message?.toLowerCase().includes("continuar") || 
                          message?.toLowerCase().includes("próximo") || 
                          message?.toLowerCase().includes("proximo"));

    if (userWantsNext) {
      const currentIndex = blocks.indexOf(currentBlock);
      if (currentIndex !== -1 && currentIndex < blocks.length - 1) {
        nextBlock = blocks[currentIndex + 1];
      }
    }

    // MEMORY UPDATE (PERSISTENCE) - LAZY
    if (userId && sessionTopic) {
      // In a real scenario, we would parse AI content to find new misconceptions or milestones.
      // For now, let's update basic metadata to ensure the memory exists.
      supabase.from("tutor_learning_memory").upsert({
        user_id: userId,
        topic: sessionTopic,
        block_title: nextBlock,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,topic' }).then(({error}) => {
        if (error) console.error("[TUTOR_V3] Memory update error:", error);
      });
    }

    // UPDATE SESSION (LAZY)
    if (sessionId && nextBlock !== currentBlock) {
      try {
        await supabase.from("tutor_sessions").update({
          current_block: nextBlock,
          updated_at: new Date().toISOString()
        }).eq("id", sessionId);
      } catch (err) {
        console.error("[TUTOR_V3] Error updating session:", err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      content,
      currentBlock: nextBlock,
      topic: sessionTopic,
      shouldWaitForStudent: true,
      correlation_id: correlationId,
      request_id: requestId,
      debug_stage: "stable_v3_ready",
      memory_active: !!memoryContext
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[TUTOR_V3_ERROR] ${requestId}:`, error);
    return new Response(JSON.stringify({
      success: true,
      content: "Preceptor ENAZIZI: Tive um pequeno problema técnico, mas estou aqui. Poderia repetir sua última dúvida?",
      currentBlock: "ERROR_RECOVERED",
      shouldWaitForStudent: true,
      debug_stage: "error_fallback"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
