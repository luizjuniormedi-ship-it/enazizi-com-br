import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { aiFetch, getAiErrorMessage } from "../_shared/ai-fetch.ts";
import { logAIUsage, buildPromptHash, getCachedAIResponse, saveAIResponseToCache } from "../_shared/ai-cache.ts";
import { searchPubMed, formatPubMedForPrompt, extractSearchTopic } from "../_shared/pubmed-search.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Standard JSON response helper */
const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  console.debug(`[mentor-chat] request_start id=${requestId}`);

  try {
    // 1. Authentication Hardening
    const auth = await requireAuth(req);
    if (!auth.ok) {
      console.warn(`[mentor-chat] unauthorized id=${requestId}`);
      return auth.response;
    }
    const { userId } = auth;

    // 2. Input Validation
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json", message: "Corpo da requisição inválido." }, 400);
    }

    const { messages, userContext, targetExam, skipCache = false, conversationId, topic: userTopic, specialty: userSpecialty } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "missing_messages", message: "Histórico de mensagens é obrigatório." }, 400);
    }

    console.debug(`[mentor-chat] processing id=${requestId} user=${userId} conv=${conversationId} msgs=${messages.length}`);

    // 3. Environment & Config Audit
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[mentor-chat] Missing environment variables");
      return json({ error: "config_error", message: "Erro de configuração no servidor." }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Cache Management (v2 - Loop 4A)
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const semanticHash = await buildPromptHash({ lastUserMessage, userContext, targetExam, specialty: userSpecialty });
    
    if (!skipCache) {
      const cacheResult = await getCachedAIResponse({
        module: "mentor-chat",
        scope: userContext ? "user" : "global",
        userId: userContext ? userId : null,
        semanticHash,
        contentType: "tutor_response"
      });

      if (cacheResult.hit && cacheResult.content?.text) {
        console.debug(`[mentor-chat] cache_hit id=${requestId}`);
        await logAIUsage({
          userId,
          module: "mentor-chat",
          model: cacheResult.modelUsed || "cache",
          cacheStatus: "hit",
          success: true,
          requestId
        });

        return json({ content: cacheResult.content.text, cached: true });
      }
    }

    // 5. Prompt Construction
    let systemPrompt = ENAZIZI_PROMPT;
    if (targetExam) {
      const bancaProfile = getBancaProfile(targetExam);
      systemPrompt += buildBancaBlock(bancaProfile);
    }
    if (userContext) {
      systemPrompt += `\n\n--- MATERIAL DE ESTUDO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    if (userTopic || userSpecialty) {
      systemPrompt += `\n\n--- CONTEXTO ATUAL DA SESSÃO ---\nTópico: ${userTopic || "Não especificado"}\nEspecialidade: ${userSpecialty || "Geral"}\n--- FIM DO CONTEXTO ---`;
    }

    // PubMed enrichment (safe-failure)
    const searchTopic = extractSearchTopic(messages);
    if (searchTopic && searchTopic.length >= 3) {
      try {
        const articles = await searchPubMed(searchTopic, 3);
        const pubmedBlock = formatPubMedForPrompt(articles);
        if (pubmedBlock) systemPrompt += pubmedBlock;
      } catch (e) {
        console.warn("[mentor-chat] PubMed enrichment failed (non-critical):", e);
      }
    }

    // 6. Persistence: User Message (Safe dual-write)
    if (conversationId) {
      supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: lastUserMessage,
        user_id: userId
      }).then(({ error }) => {
        if (error) console.error(`[mentor-chat] failed to persist user message: ${error.message}`);
      });
    }

    // 7. IA Orchestrator with Fallback
    const startMs = Date.now();
    let response;
    let modelUsed = "openai/gpt-4o";

    try {
      response = await aiFetch({
        model: modelUsed,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        maxTokens: 4096,
        timeoutMs: 30000,
        userId
      });
    } catch (err) {
      console.warn(`[mentor-chat] primary_ai_failed id=${requestId}`, err);
      modelUsed = "openai/gpt-4o-mini";
      try {
        response = await aiFetch({
          model: modelUsed,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
          maxTokens: 4096,
          timeoutMs: 15000,
          userId
        });
      } catch (fallbackErr) {
        console.error(`[mentor-chat] fallback_ai_failed id=${requestId}`, fallbackErr);
        await logAIUsage({
          userId,
          module: "mentor-chat",
          model: modelUsed,
          success: false,
          errorMessage: getAiErrorMessage(fallbackErr),
          requestId
        });
        return json({ 
          error: "ai_failed", 
          message: "O Tutor IA está temporariamente indisponível. Tente novamente em instantes." 
        }, 503);
      }
    }

    const elapsed = Date.now() - startMs;
    console.debug(`[mentor-chat] streaming_start id=${requestId} model=${modelUsed} elapsed=${elapsed}ms`);

    // 8. Stream Management & Logging
    // We return the response body directly for streaming, 
    // but we spawn an async task to log usage once the stream is likely finished.
    // Note: In a production environment, you might use a TransformStream to capture tokens and log exactly.
    // For now, we log the start of the successful stream.
    logAIUsage({
      userId,
      module: "mentor-chat",
      model: modelUsed,
      cacheStatus: "miss",
      success: true,
      latencyMs: elapsed,
      requestId
    }).catch(e => console.error("[mentor-chat] usage log failed", e));

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error(`[mentor-chat] fatal id=${requestId}`, error);
    return json({ 
      error: "internal_error", 
      message: "Ocorreu um erro inesperado no Tutor IA. Nossa equipe foi notificada." 
    }, 500);
  }
});
