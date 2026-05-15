import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { buildCacheKey, getCachedContent, setCachedContent, logAiUsage } from "../_shared/ai-cache.ts";
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
    const { specialty, topic, depth } = await req.json();

    if (!specialty) {
      return new Response(JSON.stringify({ error: "Especialidade obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MODEL = "openai/gpt-4o-mini";
    const cacheKey = buildCacheKey({ specialty, topic, extra: `study-guide-${depth || "completo"}` });

    // 1. Try cache
    try {
      const cached = await getCachedContent(cacheKey, "study-guide");
      if (cached) {
        logAiUsage({ userId, functionName: "generate-study-guide", modelUsed: MODEL, success: true, responseTimeMs: 0, cacheHit: true, modelTier: "standard" }).catch(() => {});
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* proceed */ }

    const depthInstructions: Record<string, string> = {
      resumo: "Crie um RESUMO CONCISO (2-3 páginas) focado nos pontos mais cobrados em prova. Use bullet points e tabelas comparativas.",
      completo: "Crie uma APOSTILA COMPLETA (5-8 páginas) cobrindo fisiopatologia, diagnóstico, tratamento, complicações e pontos de prova. Use tabelas, fluxogramas textuais e mnemonicos.",
      revisao: "Crie um ROTEIRO DE REVISÃO RÁPIDA (1-2 páginas) com os 20 conceitos mais importantes, formato pergunta-resposta, ideal para revisão de véspera de prova.",
    };

    const prompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal.

Você é um professor de medicina especialista em preparação para Residência Médica (ENARE, USP, UNIFESP, Revalida).

TAREFA: Gere material de estudo estruturado sobre ${topic ? `"${topic}" dentro de` : ""} ${specialty}.

${depthInstructions[depth] || depthInstructions.completo}

ESTRUTURA OBRIGATÓRIA:
1. **TÍTULO** — Nome do tema
2. **VISÃO GERAL** — Definição, epidemiologia, importância clínica (3-5 linhas)
3. **FISIOPATOLOGIA** — Mecanismos essenciais com linguagem clara
4. **QUADRO CLÍNICO** — Sinais e sintomas clássicos + apresentações atípicas
5. **DIAGNÓSTICO** — Critérios diagnósticos, exames laboratoriais e de imagem (com valores de referência)
6. **DIAGNÓSTICO DIFERENCIAL** — Tabela comparativa das principais condições
7. **TRATAMENTO** — Conduta atualizada com medicações (nome, dose, via, posologia), guidelines 2024-2026
8. **COMPLICAÇÕES** — Principais complicações e como preveni-las
9. **PONTOS DE PROVA** — 10 conceitos mais cobrados em provas de residência
10. **REFERÊNCIAS** — Harrison, Sabiston, Nelson, diretrizes brasileiras

REGRAS:
- Português brasileiro
- Formatação em Markdown
- Tabelas comparativas quando pertinente
- Mnemonicos quando existirem
- Valores laboratoriais com unidades
- Foco em conteúdo cobrado em provas ENARE/USP/UNIFESP/Revalida
- NÃO inclua conteúdo sobre conflitos de interesse ou declarações financeiras`;

    const startMs = Date.now();
    const response = await aiFetch({
      model: MODEL,
      messages: [
        { role: "system", content: "Você é um professor de medicina especialista em criar material didático de alta qualidade para residência médica. Responda sempre em Markdown bem formatado." },
        { role: "user", content: prompt },
      ],
    });
    const elapsed = Date.now() - startMs;

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      logAiUsage({ userId, functionName: "generate-study-guide", modelUsed: MODEL, success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "standard", errorMessage: `status ${response.status}` }).catch(() => {});
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const result = { content, specialty, topic };

    // Log + cache
    logAiUsage({ userId, functionName: "generate-study-guide", modelUsed: MODEL, success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "standard" }).catch(() => {});
    setCachedContent(cacheKey, "study-guide", result, MODEL, 30).catch(() => {});

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-study-guide error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
