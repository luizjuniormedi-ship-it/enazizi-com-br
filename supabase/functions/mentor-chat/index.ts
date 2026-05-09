import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage, getCachedContent, setCachedContent } from "../_shared/ai-cache.ts";
import { searchPubMed, formatPubMedForPrompt, extractSearchTopic } from "../_shared/pubmed-search.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Simple hash for prompt caching */
async function hashPrompt(text: string) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await extractUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { messages, userContext, session_memory, targetExam, skipCache = false } = body;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Campo 'messages' é obrigatório e deve ser um array." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Semantic/Exact Cache Check
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const promptHash = await hashPrompt(lastUserMessage);
    
    if (!skipCache) {
      const cached = await getCachedContent(promptHash, "tutor_response");
      if (cached) {
        return new Response(JSON.stringify({ content: cached, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let systemPrompt = ENAZIZI_PROMPT;

    // Inject banca adaptation
    if (targetExam) {
      const bancaProfile = getBancaProfile(targetExam);
      systemPrompt += buildBancaBlock(bancaProfile);
    }

    if (userContext) {
      systemPrompt += `\n\n--- MATERIAL DE ESTUDO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    // Search PubMed for relevant articles
    const topic = extractSearchTopic(messages || []);
    if (topic.length >= 3) {
      try {
        const articles = await searchPubMed(topic, 3);
        const pubmedBlock = formatPubMedForPrompt(articles);
        if (pubmedBlock) {
          systemPrompt += pubmedBlock;
        }
      } catch (e) {
        console.error("PubMed enrichment failed:", e);
      }
    }

    const startMs = Date.now();
    // 2. IA ORCHESTRATOR: Try Primary (GPT-5/4o), Fallback to secondary if needed
    let response;
    try {
      response = await aiFetch({
        model: "openai/gpt-4o", // Ensuring a valid standard model
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        maxTokens: 4096,
        timeoutMs: 30000,
        maxRetries: 1,
      });
    } catch (err) {
      console.warn("Primary AI failed, triggering fallback...", err);
      // Fallback Orchestration
      response = await aiFetch({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        maxTokens: 4096,
        timeoutMs: 15000,
      });
    }

    const elapsed = Date.now() - startMs;

    // Performance & Incident Logging
    if (elapsed > 10000) {
      // Log slow response incident asynchronously
      console.warn(`Slow response detected: ${elapsed}ms`);
    }

    logAiUsage({
      userId,
      functionName: "mentor-chat",
      modelUsed: response.ok ? "gpt-4o" : "fallback",
      success: response.ok,
      responseTimeMs: elapsed,
    }).catch(() => {});

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Serviço temporariamente instável. Tentando recuperação." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mentor-chat critical error:", e);
    return new Response(JSON.stringify({ error: "Erro crítico no orquestrador" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
