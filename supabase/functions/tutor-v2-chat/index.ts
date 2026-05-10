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
    const startTime = Date.now();
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

    // [PHASE_0_CONTEXT] 
    const { data: contextData } = await supabase.functions.invoke("tutor-v2-context-builder");
    const context = contextData?.context || {};
    console.log("[PHASE_0_CONTEXT]", JSON.stringify(context));

    // 2. Build AI Prompt
    const systemPrompt = `${PROMPT_COMPLETO}

ESTADO COGNITIVO DO ALUNO (FASE 0):
- Tema: ${session.topic}
- Especialidade: ${session.specialty || 'Geral'}
- Missão Ativa: ${context.mission?.title || 'Exploração Livre'}
- Erros Recorrentes (Lacunas): ${context.detected_gaps?.join(', ') || 'Nenhuma detectada'}
- Status FSRS: ${context.fsrs?.pending_reviews || 0} revisões pendentes.
- Carga Cognitiva Atual: ${context.cognitive_load || 'Normal'}

INSTRUÇÃO OPERACIONAL ADAPTATIVA:
1. Aplique o Método Feynman para simplificar conceitos complexos. Use analogias.
2. Percorra as Fases Cognitivas (Leiga → Técnica → Mecanismo → Clínica → Prova → Recall → Consolidação).
3. Use bibliografia oficial (Harrison, Robbins, etc.).
4. Adote o modo de resposta obrigatório do Protocolo de 15 Blocos ENAZIZI.
5. Sempre que detectar um conceito chave, adicione FLASHCARD_SUGGESTION: {"front": "...", "back": "..."} ao final.`;

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
    const latency = Date.now() - startTime;

    // --- PEDAGOGICAL AUDIT LAYER ---
    
    // [FEYNMAN_LAYER] Detection
    const feynmanKeywords = ["analogia", "imagine", "simples", "como se fosse", "trocando em miúdos"];
    const hasAnalogies = feynmanKeywords.some(k => assistantMessage.toLowerCase().includes(k));
    const hasRecall = assistantMessage.toLowerCase().includes("active recall") || assistantMessage.includes("?");
    const feynmanScore = (hasAnalogies ? 50 : 0) + (hasRecall ? 50 : 0);
    console.log("[FEYNMAN_LAYER]", { analogy_used: hasAnalogies, recall_generated: hasRecall });

    // [PEDAGOGICAL_BLOCK_VALIDATION]
    const mandatoryBlocks = [
      "Introdução", "Explicação leiga", "Técnica", "Fisiologia", "Fisiopatologia", 
      "Clínica", "Sintomas", "Exame físico", "Diferencial", "Exames", 
      "Tratamento", "Pegadinhas", "Resumo", "Active recall", "Próxima ação"
    ];
    const foundBlocks = mandatoryBlocks.filter(b => assistantMessage.includes(b));
    const missingBlocks = mandatoryBlocks.filter(b => !assistantMessage.includes(b));
    const pedagogicalScore = Math.round((foundBlocks.length / mandatoryBlocks.length) * 100);
    console.log("[PEDAGOGICAL_BLOCK_VALIDATION]", { found: foundBlocks.length, missing: missingBlocks.length });

    // [MEDICAL_SAFETY_CHECK]
    const safetyKeywords = ["cuidado", "emergência", "urgência", "alerta", "contraindicação"];
    const hasSafetyInfo = safetyKeywords.some(k => assistantMessage.toLowerCase().includes(k));
    const hallucinationWarning = assistantMessage.length < 50; // Simple heuristic for now

    // Extract flashcard suggestion
    let flashcardSuggestion = null;
    if (assistantMessage.includes("FLASHCARD_SUGGESTION:")) {
      const parts = assistantMessage.split("FLASHCARD_SUGGESTION:");
      assistantMessage = parts[0].trim();
      try {
        flashcardSuggestion = JSON.parse(parts[1].trim());
        console.log("[FSRS_AUTOGEN]", { cards_generated: 1 });
      } catch (e) {
        console.error("Error parsing flashcard suggestion:", e);
      }
    }

    // 3. Save Assistant Message
    const { data: savedMsg } = await supabase.from("tutor_messages").insert({
      tutor_session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
      metadata: {
        flashcard_suggestion: flashcardSuggestion,
        model: "gpt-4o",
        pedagogical_audit: {
          feynman_score: feynmanScore,
          pedagogical_score,
          missing_blocks: missingBlocks
        }
      }
    }).select().single();

    // 4. Record Audit
    if (savedMsg) {
      await supabase.from("tutor_v2_audits").insert({
        user_id: userId,
        session_id: sessionId,
        message_id: savedMsg.id,
        phase_0_context: context,
        pedagogical_score,
        feynman_score,
        blocks_found: foundBlocks,
        blocks_missing: missingBlocks,
        hallucination_warning: hallucinationWarning,
        cognitive_load: context.cognitive_load || 0.0,
        detected_gaps: context.detected_gaps || [],
        planner_signals: [{ type: "adaptive_replan", priority: pedagogicalScore > 80 ? "low" : "high" }],
        error_signals: missingBlocks.length > 5 ? [{ type: "pedagogical_gap", blocks: missingBlocks }] : [],
        latency_ms: latency,
        model_used: "gpt-4o"
      });
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      content: assistantMessage,
      flashcardSuggestion,
      audit: { pedagogicalScore, feynmanScore }
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