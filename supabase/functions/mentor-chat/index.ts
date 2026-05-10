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
  console.log(`[mentor-chat] REQUEST_RECEIVED id=${requestId}`);

  try {
    // 1. Authentication Hardening
    const auth = await requireAuth(req);
    if (!auth.ok) {
      console.warn(`[mentor-chat] AUTH_FAILED id=${requestId}`);
      return auth.response;
    }
    const { userId } = auth;
    console.log(`[mentor-chat] AUTH_OK id=${requestId} user=${userId}`);

    // 2. Input Validation
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[mentor-chat] BODY_INVALID id=${requestId}`, e);
      return json({ error: "invalid_json", message: "Corpo da requisição inválido.", requestId }, 400);
    }

    const { messages, userContext, targetExam, skipCache = false, conversationId, topic: userTopic, specialty: userSpecialty } = body;
    console.log(`[mentor-chat] BODY_VALIDATED id=${requestId} conv=${conversationId}`);

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "missing_messages", message: "Histórico de mensagens é obrigatório.", requestId }, 400);
    }

    // 3. Environment & Config Audit
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[mentor-chat] CONFIG_ERROR id=${requestId}`);
      return json({ error: "config_error", message: "Erro de configuração no servidor.", requestId }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Cache Management
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
        console.log(`[mentor-chat] CACHE_HIT id=${requestId}`);
        await logAIUsage({
          userId,
          module: "mentor-chat",
          model: cacheResult.modelUsed || "cache",
          cacheStatus: "hit",
          success: true,
          requestId
        });

        return json({ 
          ok: true,
          content: cacheResult.content.text, 
          message: cacheResult.content.text,
          cached: true, 
          requestId 
        });
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
        console.log(`[mentor-chat] RETRIEVAL_STARTED (PubMed) id=${requestId}`);
        const articles = await searchPubMed(searchTopic, 3);
        const pubmedBlock = formatPubMedForPrompt(articles);
        if (pubmedBlock) systemPrompt += pubmedBlock;
        console.log(`[mentor-chat] RETRIEVAL_FINISHED (PubMed) id=${requestId}`);
      } catch (e) {
        console.warn(`[mentor-chat] PubMed enrichment failed id=${requestId}:`, e);
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
        if (error) console.error(`[mentor-chat] PERSIST_USER_FAILED id=${requestId}: ${error.message}`);
      });
    }

    // 7. IA Orchestrator with Fallback
    const startMs = Date.now();
    let response;
    let modelUsed = "openai/gpt-4o";

    const fallbackMessage = "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.";

    try {
      console.log(`[mentor-chat] PROVIDER_REQUEST_STARTED id=${requestId} model=${modelUsed}`);
      response = await aiFetch({
        model: modelUsed,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        maxTokens: 4096,
        timeoutMs: 25000, // 25s timeout for primary
        userId
      });
      console.log(`[mentor-chat] PROVIDER_RESPONSE_RECEIVED id=${requestId}`);
    } catch (err) {
      console.warn(`[mentor-chat] PRIMARY_AI_FAILED id=${requestId}`, err);
      modelUsed = "openai/gpt-4o-mini";
      try {
        console.log(`[mentor-chat] PROVIDER_REQUEST_STARTED (fallback) id=${requestId} model=${modelUsed}`);
        response = await aiFetch({
          model: modelUsed,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
          maxTokens: 4096,
          timeoutMs: 15000,
          userId
        });
        console.log(`[mentor-chat] PROVIDER_RESPONSE_RECEIVED id=${requestId}`);
      } catch (fallbackErr) {
        console.error(`[mentor-chat] FATAL_CAUGHT id=${requestId}`, fallbackErr);
        await logAIUsage({
          userId,
          module: "mentor-chat",
          model: modelUsed,
          success: false,
          errorMessage: getAiErrorMessage(fallbackErr),
          requestId
        });
        
        return json({ 
          ok: false,
          error: "ai_failed", 
          message: fallbackMessage,
          requestId,
          fallbackUsed: true
        }, 200); // Return 200 with OK=false to handle gracefully in frontend
      }
    }

    const elapsed = Date.now() - startMs;
    console.log(`[mentor-chat] RESPONSE_NORMALIZED id=${requestId} model=${modelUsed} elapsed=${elapsed}ms`);

    // 8. Stream Management & Logging
    logAIUsage({
      userId,
      module: "mentor-chat",
      model: modelUsed,
      cacheStatus: "miss",
      success: true,
      latencyMs: elapsed,
      requestId
    }).catch(e => console.error(`[mentor-chat] LOG_USAGE_FAILED id=${requestId}`, e));

    console.log(`[mentor-chat] RESPONSE_SENT id=${requestId}`);
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error(`[mentor-chat] FATAL_CAUGHT id=${requestId}`, error);
    return json({ 
      ok: false,
      error: "internal_error", 
      message: "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.",
      requestId,
      fallbackUsed: true
    }, 500);
  }
});
