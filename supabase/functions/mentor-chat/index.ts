import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { searchPubMed, formatPubMedForPrompt, extractSearchTopic } from "../_shared/pubmed-search.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { extractUserId } from "../_shared/ai-phase2-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { messages, userContext, session_memory, targetExam } = body;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Campo 'messages' é obrigatório e deve ser um array." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Search PubMed for relevant articles based on user's question
    const topic = extractSearchTopic(messages || []);
    if (topic.length >= 3) {
      try {
        const articles = await searchPubMed(topic, 3);
        const pubmedBlock = formatPubMedForPrompt(articles);
        if (pubmedBlock) {
          systemPrompt += pubmedBlock;
          systemPrompt += `\n\nINSTRUÇÃO OBRIGATÓRIA: Ao final da resposta, inclua uma seção:
"📚 REFERÊNCIAS CIENTÍFICAS — Biblioteca Nacional de Medicina (NLM) | NIH"
Para cada artigo acima, cite:
- Título completo entre aspas
- Autores, Periódico, Ano
- Link CLICÁVEL no formato markdown: [Acessar no PubMed](URL_COMPLETA)
- Breve resumo do artigo (1-2 frases) baseado no abstract fornecido
Estes são artigos REAIS indexados no PubMed. NÃO invente artigos.`;
        }
      } catch (e) {
        console.error("PubMed enrichment failed (non-blocking):", e);
      }
    }

    if (session_memory) {
      systemPrompt += `\n\n--- MEMÓRIA DE SESSÃO ---
Último tema: ${session_memory.ultimo_tema || "nenhum"}
Erros consecutivos: ${session_memory.erros_consecutivos || 0}
Profundidade: ${session_memory.profundidade_resposta || "aprofundado"}
--- FIM DA MEMÓRIA DE SESSÃO ---`;
    }

    const startMs = Date.now();
    const response = await aiFetch({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });
    const elapsed = Date.now() - startMs;

    logAiUsage({
      userId,
      functionName: "mentor-chat",
      modelUsed: "openai/gpt-5",
      success: response.ok,
      responseTimeMs: elapsed,
      modelTier: "standard",
      errorMessage: response.ok ? undefined : `status ${response.status}`,
    }).catch(() => {});

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mentor-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
