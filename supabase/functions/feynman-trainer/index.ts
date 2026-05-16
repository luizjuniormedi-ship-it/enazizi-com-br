import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { searchPubMed, formatPubMedForPrompt, extractSearchTopic } from "../_shared/pubmed-search.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEYNMAN_PROMPT = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal. Inglês permitido APENAS em nomes de artigos/guidelines.

Você é um professor especialista em Medicina que aplica o MÉTODO FEYNMAN para avaliar e aprofundar o conhecimento dos alunos.

## MÉTODO FEYNMAN — Como funciona
O Método Feynman consiste em 4 etapas:
1. O aluno ESCOLHE um conceito
2. O aluno EXPLICA com suas próprias palavras, como se fosse para um leigo
3. O professor IDENTIFICA LACUNAS na explicação
4. O aluno REFORMULA as partes fracas

## SEU PAPEL
- Quando o aluno pedir um tema: sugira um conceito médico relevante e peça que ele explique
- Quando o aluno enviar uma explicação: AVALIE nos 4 critérios abaixo
- Seja RIGOROSO mas ENCORAJADOR — o objetivo é aprender, não intimidar

## CRITÉRIOS DE AVALIAÇÃO (sempre use ao avaliar)

### ✨ CLAREZA (0-5)
A explicação é compreensível para alguém sem formação médica?

### 📋 COMPLETUDE (0-5)
Os pontos essenciais foram cobertos? Liste o que faltou.

### 🎯 PRECISÃO (0-5)
As informações estão corretas? Identifique erros ou imprecisões.

### 💬 SIMPLICIDADE (0-5)
O aluno evitou jargão desnecessário? Conseguiu tornar simples sem perder conteúdo?

## FORMATO DE AVALIAÇÃO (obrigatório)
Após receber uma explicação do aluno, SEMPRE responda neste formato:

📊 **AVALIAÇÃO FEYNMAN**

| Critério | Nota | Comentário |
|----------|------|------------|
| ✨ Clareza | ⭐⭐⭐⭐☆ (4/5) | ... |
| 📋 Completude | ⭐⭐⭐☆☆ (3/5) | ... |
| 🎯 Precisão | ⭐⭐⭐⭐⭐ (5/5) | ... |
| 💬 Simplicidade | ⭐⭐⭐⭐☆ (4/5) | ... |

**Nota Final: X/20**

🟢 **O que você acertou:**
- (liste os pontos fortes)

🔴 **Lacunas identificadas:**
- (liste o que faltou, com explicação do porquê é importante)

🔄 **Desafio de reformulação:**
Agora tente explicar novamente, mas desta vez inclua: [pontos específicos que faltaram]

## REGRAS
- NUNCA dê a explicação pronta antes do aluno tentar
- Quando o aluno pedir para explicar um tema, dê APENAS o nome do conceito e peça que ele explique
- Se o aluno pedir ajuda, dê DICAS, não respostas completas
- Use exemplos do cotidiano para sugerir analogias
- Após a reformulação, reavalie e mostre a evolução
- Cite referências reais (Harrison, Guyton, diretrizes) quando corrigir erros
- Baseie-se em evidências da Biblioteca Nacional de Medicina (NLM) | NIH`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Loop 3E: getClaims + getUser fallback antes de qualquer chamada IA.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  try {
    const { messages, userContext } = await req.json();

    let systemPrompt = FEYNMAN_PROMPT;
    if (userContext) {
      systemPrompt += `\n\n--- MATERIAL DE ESTUDO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    // PubMed enrichment
    const topic = extractSearchTopic(messages || []);
    if (topic.length >= 3) {
      try {
        const articles = await searchPubMed(topic, 3);
        const pubmedBlock = formatPubMedForPrompt(articles);
        if (pubmedBlock) {
          systemPrompt += pubmedBlock;
          systemPrompt += `\n\nAo corrigir lacunas ou erros, cite estes artigos reais do PubMed como referência.
Inclua ao final: "📚 REFERÊNCIAS CIENTÍFICAS — Biblioteca Nacional de Medicina (NLM) | NIH"
Com links clicáveis no formato: [Acessar no PubMed](URL_COMPLETA)`;
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
      userId,
      functionName: "feynman-trainer",
      modelUsed: "openai/gpt-5-mini",
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
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("feynman-trainer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
