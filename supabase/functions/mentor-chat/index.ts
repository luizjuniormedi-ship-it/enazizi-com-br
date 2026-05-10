import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { aiFetch, getAiErrorMessage } from "../_shared/ai-fetch.ts";
import { logAIUsage, buildPromptHash, getCachedAIResponse, saveAIResponseToCache } from "../_shared/ai-cache.ts";
import { searchPubMed, formatPubMedForPrompt, extractSearchTopic } from "../_shared/pubmed-search.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createEmbedding } from "../_shared/ai-embeddings.ts";

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
  const startTime = Date.now();
  console.log(`[mentor-chat] REQUEST_RECEIVED id=${requestId}`);

  const fallbackMessage = "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.";

  try {
    // 1. Authentication
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
      return json({ ok: false, error: "invalid_json", message: "Corpo da requisição inválido.", requestId }, 400);
    }

    const { 
      messages, 
      userContext, 
      targetExam, 
      skipCache = false, 
      conversationId, 
      topic: userTopic, 
      specialty: userSpecialty,
      bypassRAG = false,
      debugOnlyRAG = false,
      jsonResponse = false
    } = body;

    console.log(`[mentor-chat] BODY_VALIDATED id=${requestId} conv=${conversationId} bypassRAG=${bypassRAG} debugOnlyRAG=${debugOnlyRAG}`);

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ ok: false, error: "missing_messages", message: "Histórico de mensagens é obrigatório.", requestId }, 400);
    }

    // 3. Environment & Config
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[mentor-chat] CONFIG_ERROR id=${requestId}`);
      return json({ ok: false, error: "config_error", message: "Erro de configuração no servidor.", requestId }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Cache Management (Skip if debugging/bypass)
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    if (!skipCache && !bypassRAG && !debugOnlyRAG) {
      const semanticHash = await buildPromptHash({ lastUserMessage, userContext, targetExam, specialty: userSpecialty });
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

        const elapsedMs = Date.now() - startTime;
        console.log(`[mentor-chat] RESPONSE_SENT id=${requestId} elapsed=${elapsedMs}ms source=cache`);
        return json({ 
          ok: true,
          content: cacheResult.content.text, 
          message: cacheResult.content.text,
          cached: true, 
          requestId,
          elapsedMs
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

    // 6. RAG / Knowledge Base Retrieval
    let ragContext = "";
    let ragSources = [];
    
    if (!bypassRAG) {
      try {
        console.log(`[mentor-chat] RETRIEVAL_STARTED (RAG) id=${requestId}`);
        const retrievalStart = Date.now();
        
        // Timeout for RAG (8s as requested)
        const retrievalPromise = (async () => {
          const queryEmbedding = await createEmbedding(lastUserMessage);
          const { data: chunks, error: rpcError } = await supabase.rpc("match_rag_chunks", {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 5
          });
          if (rpcError) throw rpcError;
          return chunks;
        })();

        const chunks = await Promise.race([
          retrievalPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("RETRIEVAL_TIMEOUT")), 8000))
        ]) as any[];
        
        if (chunks && chunks.length > 0) {
          ragContext = chunks.map((c: any) => c.content).join("\n\n");
          ragSources = chunks.map((c: any) => ({ 
            id: c.id, 
            document_id: c.document_id, 
            similarity: c.similarity 
          }));
          
          systemPrompt += `\n\n--- BASE DE CONHECIMENTO (RAG) ---\n${ragContext}\n--- FIM DA BASE ---`;
        }
        
        const retrievalElapsed = Date.now() - retrievalStart;
        console.log(`[mentor-chat] RETRIEVAL_FINISHED (RAG) id=${requestId} chunksFound=${chunks?.length || 0} elapsed=${retrievalElapsed}ms`);
        
        if (debugOnlyRAG) {
          return json({ 
            ok: true, 
            debug: true,
            chunksFound: chunks?.length || 0, 
            sources: ragSources, 
            requestId,
            elapsedMs: Date.now() - startTime
          });
        }
      } catch (e) {
        console.warn(`[mentor-chat] RAG_RETRIEVAL_FAILED id=${requestId} error=${e.message}`);
        if (debugOnlyRAG) {
          return json({ ok: false, error: "rag_failed", message: e.message, requestId }, 500);
        }
        // Continue without RAG
      }
    }

    // PubMed enrichment (Secondary, safe-failure)
    if (!bypassRAG && !debugOnlyRAG) {
      const searchTopic = extractSearchTopic(messages);
      if (searchTopic && searchTopic.length >= 3) {
        try {
          console.log(`[mentor-chat] RETRIEVAL_STARTED (PubMed) id=${requestId}`);
          const articles = await Promise.race([
            searchPubMed(searchTopic, 3),
            new Promise((_, reject) => setTimeout(() => reject(new Error("RETRIEVAL_TIMEOUT")), 5000))
          ]) as any;
          const pubmedBlock = formatPubMedForPrompt(articles);
          if (pubmedBlock) systemPrompt += pubmedBlock;
          console.log(`[mentor-chat] RETRIEVAL_FINISHED (PubMed) id=${requestId}`);
        } catch (e) {
          console.warn(`[mentor-chat] PubMed enrichment failed id=${requestId}:`, e.message);
        }
      }
    }

    // 7. Persistence: User Message
    if (conversationId && !debugOnlyRAG) {
      supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: lastUserMessage,
        user_id: userId
      }).catch(err => console.error(`[mentor-chat] PERSIST_USER_FAILED id=${requestId}:`, err));
    }

    // 8. IA Orchestration
    const startMs = Date.now();
    let response;
    let modelUsed = "openai/gpt-4o";

    // If jsonResponse is true, we override stream to false
    const stream = !jsonResponse;

    try {
      console.log(`[mentor-chat] PROVIDER_REQUEST_STARTED id=${requestId} model=${modelUsed} stream=${stream}`);
      response = await aiFetch({
        model: modelUsed,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream,
        maxTokens: 4096,
        timeoutMs: 30000, 
        userId
      });
      console.log(`[mentor-chat] PROVIDER_RESPONSE_RECEIVED id=${requestId}`);
    } catch (err) {
      console.warn(`[mentor-chat] PRIMARY_AI_FAILED id=${requestId}`, err);
      modelUsed = "openai/gpt-4o-mini";
      try {
        console.log(`[mentor-chat] PROVIDER_REQUEST_STARTED (fallback) id=${requestId} model=${modelUsed} stream=${stream}`);
        response = await aiFetch({
          model: modelUsed,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream,
          maxTokens: 4096,
          timeoutMs: 15000,
          userId
        });
        console.log(`[mentor-chat] PROVIDER_RESPONSE_RECEIVED id=${requestId}`);
      } catch (fallbackErr) {
        console.error(`[mentor-chat] FATAL_CAUGHT id=${requestId}`, fallbackErr);
        await logAIUsage({
          userId, module: "mentor-chat", model: modelUsed, success: false,
          errorMessage: getAiErrorMessage(fallbackErr), requestId
        });
        
        return json({ 
          ok: false, error: "ai_failed", message: fallbackMessage,
          requestId, fallbackUsed: true, elapsedMs: Date.now() - startTime
        }, 503);
      }
    }

    const elapsed = Date.now() - startMs;
    console.log(`[mentor-chat] RESPONSE_SENT id=${requestId} model=${modelUsed} elapsed=${elapsed}ms`);

    if (jsonResponse) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return json({
        ok: true,
        content,
        message: content,
        modelUsed,
        requestId,
        chunksFound: ragSources.length,
        sources: ragSources,
        elapsedMs: Date.now() - startTime
      });
    }

    // Transformation: Prepend sources and wrap the stream
    const encoder = new TextEncoder();
    const transformStream = new TransformStream({
      async start(controller) {
        if (ragSources.length > 0) {
          const sourcesChunk = {
            choices: [{ delta: { content: "" } }],
            sources: ragSources,
            requestId
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(sourcesChunk)}\n\n`));
        }
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error(`[mentor-chat] FATAL_CAUGHT id=${requestId}`, error);
    return json({ 
      ok: false, error: "internal_error", message: fallbackMessage,
      requestId, fallbackUsed: true, elapsedMs: Date.now() - startTime
    }, 500);
  }
});
