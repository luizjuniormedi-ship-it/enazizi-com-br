import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { extractUserId } from "../_shared/ai-phase2-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard ──
  const userId = await extractUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, userContext, enazizi_progress, error_bank, session_memory, mission_context } = await req.json();

    let instructions = ENAZIZI_PROMPT;

    // ── MISSION MODE: override system prompt for strategic, concise responses ──
    if (mission_context && mission_context.mode === "mission") {
      const mc = mission_context;
      const phaseLabels: Record<string, string> = {
        critico: "Crítico", atencao: "Atenção", competitivo: "Competitivo", pronto: "Pronto",
      };
      const phaseLabel = phaseLabels[mc.phase || ""] || mc.phase || "desconhecida";

      instructions += `\n\n===== MODO MISSÃO ATIVO =====
VOCÊ ESTÁ NO MODO MISSÃO. Seu comportamento muda:
- Seja um MENTOR ESTRATÉGICO, não um professor
- Respostas CURTAS e DIRETAS (máximo 300 palavras)
- Foco total em CORREÇÃO DE ERROS e PERFORMANCE NA PROVA
- NÃO dê aula completa — vá direto ao ponto
- NÃO faça introduções longas
- SEMPRE conecte com o que cai na prova

CONTEXTO DO ALUNO:
- Tema: ${mc.topic || "não definido"}
- Erro principal: ${mc.error || "não identificado"}
- Fase atual: ${phaseLabel}
- Objetivo do dia: ${mc.objective || "evoluir"}
- Revisões pendentes: ${mc.pendingReviews ?? "?"}
- Acurácia: ${mc.accuracy ?? "?"}%
- Banca alvo: ${mc.examFocus || "geral"}

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (nesta ordem):

1. **🎯 Contexto do erro** (1-2 frases identificando o que o aluno está errando)
2. **✅ Correção direta** (explicação objetiva do ponto crítico — máx 4 frases)
3. **⚠️ Pegadinha de prova** (1 frase sobre o erro mais comum nesse tema)
4. **💡 Regra de ouro** (1 frase-resumo que o aluno deve memorizar)
5. **🏥 Aplicação rápida** (mini cenário clínico de 3 linhas OU pergunta direta)

REGRAS DO MODO MISSÃO:
${(mc.accuracy ?? 100) < 40 ? "- SIMPLIFIQUE a explicação (acurácia muito baixa)" : ""}
${(mc.pendingReviews ?? 0) >= 20 ? "- Foque em PADRÃO DE PROVA (muitas revisões pendentes)" : ""}
${mc.phase === "critico" ? "- REDUZA complexidade ao essencial" : ""}
${mc.heavyRecovery ? "- RECUPERAÇÃO PESADA ativa — apenas o essencial" : ""}
- Linguagem: mentor direto, sem enrolação
- Tom: confiante, estratégico, focado em aprovação
===== FIM DO MODO MISSÃO =====`;
    }

    if (userContext) {
      instructions += `\n\n--- MATERIAL DE ESTUDO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    if (enazizi_progress) {
      const stepNames: Record<number, string> = {
        0: "Painel de desempenho",
        1: "Escolha do tema",
        2: "Bloco técnico 1 (conceito/definição/visão geral)",
        3: "Active Recall do bloco 1",
        4: "Bloco técnico 2 (fisiopatologia profunda)",
        5: "Active Recall do bloco 2",
        6: "Bloco técnico 3 (clínica, diagnóstico, tratamento, conduta)",
        7: "Questão objetiva (caso clínico + A-E)",
        8: "Discussão da questão",
        9: "Caso clínico discursivo",
        10: "Correção discursiva (nota 0-5)",
        11: "Atualização de desempenho",
        12: "Bloco de consolidação (5 questões sequenciais)",
      };
      const step = enazizi_progress.estado_atual || 0;
      const stepName = stepNames[step] || "Desconhecido";
      instructions += `\n\n--- ESTADO ATUAL DO ALUNO ---
Etapa atual: STATE ${step}/12 — ${stepName}
Tema: ${enazizi_progress.tema_atual || "não definido"}
Questões respondidas: ${enazizi_progress.questoes_respondidas || 0}
Taxa de acerto: ${enazizi_progress.taxa_acerto || 0}%
Pontuação discursiva: ${enazizi_progress.pontuacao_discursiva ?? "não avaliado"}
Temas fracos: ${(enazizi_progress.temas_fracos || []).join(", ") || "nenhum"}

IMPORTANTE: Você está no STATE ${step} (${stepName}). Continue EXATAMENTE a partir deste estado.
NÃO repita estados anteriores. NÃO pule para estados futuros. Avance apenas UM estado por interação.
--- FIM DO ESTADO ---`;
    }

    if (error_bank && Array.isArray(error_bank) && error_bank.length > 0) {
      instructions += `\n\n--- BANCO DE ERROS DO ALUNO ---\n`;
      const grouped = new Map<string, { subtemas: string[]; total: number; categorias: string[] }>();
      for (const e of error_bank) {
        if (!grouped.has(e.tema)) grouped.set(e.tema, { subtemas: [], total: 0, categorias: [] });
        const g = grouped.get(e.tema)!;
        g.total += e.vezes_errado || 1;
        if (e.subtema && !g.subtemas.includes(e.subtema)) g.subtemas.push(e.subtema);
        if (e.categoria_erro && !g.categorias.includes(e.categoria_erro)) g.categorias.push(e.categoria_erro);
      }
      for (const [tema, info] of grouped) {
        instructions += `\n🔴 ${tema} (${info.total}x erros)`;
        if (info.subtemas.length) instructions += `\n   Subtemas: ${info.subtemas.join(", ")}`;
        if (info.categorias.length) instructions += `\n   Tipos de erro: ${info.categorias.join(", ")}`;
      }
      instructions += `\nUSE esses dados para reforçar temas fracos, priorizar revisão e gerar questões focadas nos pontos de erro.`;
      instructions += `\n--- FIM DO BANCO DE ERROS ---`;
    }

    if (session_memory) {
      instructions += `\n\n--- MEMÓRIA DE SESSÃO ---
Último tema: ${session_memory.ultimo_tema || "nenhum"}
Última pergunta: ${session_memory.ultima_pergunta || "nenhuma"}
Último erro: ${session_memory.ultimo_erro || "nenhum"}
Erros consecutivos no tema atual: ${session_memory.erros_consecutivos || 0}
Profundidade recomendada: ${session_memory.profundidade_resposta || "aprofundado"}
Total erros na sessão: ${session_memory.total_erros_sessao || 0}
Total acertos na sessão: ${session_memory.total_acertos_sessao || 0}
${session_memory.erros_consecutivos >= 3 ? "\n⚠️ ALERTA DE TRAVAMENTO: O aluno errou 3+ vezes consecutivas neste tema. SIMPLIFIQUE a explicação." : ""}
--- FIM DA MEMÓRIA DE SESSÃO ---`;
    }

    // In mission mode, use lighter model and fewer tokens for speed
    const isMissionMode = mission_context?.mode === "mission";
    const maxTokens = isMissionMode ? 4096 : 16384;
    const allMessages = [{ role: "system", content: instructions }, ...messages];
    const body = JSON.stringify({ model: "google/gemini-2.5-flash", messages: allMessages, stream: true, max_tokens: maxTokens });
    const startMs = Date.now();

    // 1) Try OpenAI first
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY) {
      const response = await fetch(OPENAI_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body,
      });

      if (response.ok) {
        logAiUsage({ userId, functionName: "chatgpt-agent", modelUsed: "google/gemini-2.5-flash", success: true, responseTimeMs: Date.now() - startMs, cacheHit: false, modelTier: "standard" }).catch(() => {});
        return new Response(response.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      console.log(`OpenAI returned ${response.status}, falling back to Lovable AI...`);
      // Only fallback on rate/credit issues
      if (response.status !== 429 && response.status !== 402) {
        const t = await response.text();
        console.error("OpenAI error:", response.status, t);
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Fallback to Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fallbackBody = JSON.stringify({ model: "google/gemini-2.5-flash", messages: allMessages, stream: true, max_tokens: 16384 });
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: fallbackBody,
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Lovable AI error:", response.status, t);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logAiUsage({ userId, functionName: "chatgpt-agent", modelUsed: "google/gemini-2.5-flash", success: true, responseTimeMs: Date.now() - startMs, cacheHit: false, modelTier: "pro" }).catch(() => {});
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chatgpt-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
