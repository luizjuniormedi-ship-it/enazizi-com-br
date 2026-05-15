import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { searchPubMed, formatPubMedForPrompt, extractSearchTopic } from "../_shared/pubmed-search.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUMMARIZER_PREFIX = `Você é o Resumidor de Conteúdo do sistema ENAZIZI, especializado em Residência Médica no Brasil.

Seu objetivo é gerar RESUMOS ESTRUTURADOS seguindo exatamente a mesma organização visual e pedagógica do Tutor ENAZIZI.

⛔ RESTRIÇÃO ABSOLUTA DE ESCOPO:
Você SOMENTE pode resumir conteúdo relacionado a MEDICINA, SAÚDE e CIÊNCIAS BIOMÉDICAS.
Se o usuário solicitar resumos sobre áreas NÃO MÉDICAS:
- RECUSE educadamente
- Explique que esta plataforma é exclusiva para preparação em Residência Médica
- Sugira um tema médico relevante como alternativa

📐 PADRONIZAÇÃO DE RESPOSTAS (OBRIGATÓRIO):
O resumo deve seguir o núcleo teórico padrão: mesma estrutura, profundidade e referências para todos os usuários.
NÃO use histórico pessoal para alterar a essência do resumo.

🎯 FOCO DO RESUMIDOR:
Ao gerar resumos, inclua obrigatoriamente:
- 🎯 Explicação leiga (versão acessível e intuitiva)
- 🔬 Fisiopatologia (base clássica: Guyton, Robbins, Harrison)
- 🏥 Aplicação clínica (sinais, sintomas, exames, tratamento)
- 🔄 Diagnósticos diferenciais (tabela comparativa)
- ⚠️ Pegadinhas de prova (armadilhas comuns em residência)
- 📌 Pontos de alta incidência em provas
- 💊 Condutas e tratamentos cobrados
- 🧠 Mnemônicos para memorização
- 📝 Resumo rápido final (5-7 linhas com o essencial)

IMPORTANTE: Quando o aluno fornecer material, use-o como base para criar resumos personalizados.
Cite diretrizes, protocolos (MS, SBP, FEBRASGO, ATLS, ACLS) e referências.
SEMPRE em português brasileiro.

Agora siga TODAS as regras de formatação visual, espaçamento e organização do Protocolo ENAZIZI abaixo:

${ENAZIZI_PROMPT}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userContext } = await req.json();

    let systemPrompt = SUMMARIZER_PREFIX;

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
          systemPrompt += `\n\nINSTRUÇÃO OBRIGATÓRIA: Ao final do resumo, inclua uma seção:
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

    const startMs = Date.now();
    const response = await aiFetch({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });
    const elapsed = Date.now() - startMs;

    logAiUsage({
      userId: "system-summarizer",
      functionName: "content-summarizer",
      modelUsed: "openai/gpt-4o-mini",
      success: response.ok,
      responseTimeMs: elapsed,
      cacheHit: false,
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
    console.error("content-summarizer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
