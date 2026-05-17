import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildCacheKey, getCachedContent, setCachedContent } from "../_shared/ai-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR).

Você é um gerador de simulações práticas OSCE para estudantes de Medicina.

A partir de uma crônica médica narrativa, você deve extrair a estrutura clínica e gerar uma simulação prática com decisões clínicas realistas.

## SAÍDA OBRIGATÓRIA (JSON via tool calling)

Gere um objeto com:

1. **structured_data**: dados clínicos extraídos da crônica
2. **osce_stages**: array de 4 etapas de decisão clínica

### structured_data
- specialty: especialidade
- topic: tema principal
- difficulty: nível
- diagnosis: diagnóstico principal
- keyFindings: array de achados-chave (5-8 itens)
- criticalPoints: array de pontos críticos (3-5 itens)
- commonErrors: array de erros comuns (3-5 itens)

### osce_stages (array de 4 objetos)
Cada etapa:
- stage_type: "diagnostico" | "exame" | "conduta" | "priorizacao"
- title: título da decisão (ex: "Qual o diagnóstico mais provável?")
- clinical_context: breve contexto clínico para a decisão (2-3 frases)
- options: array de 4 alternativas, cada uma com { text: string, is_correct: boolean }
- explanation: explicação detalhada da resposta correta e por que as outras estão erradas
- time_limit_seconds: tempo para decidir (30-90)
- critical_action: boolean - se a decisão é crítica (erro = desfecho grave)

### REGRAS
- Alternativas devem ser REALISTAS e plausíveis (não óbvias)
- Cada etapa deve ter exatamente 1 alternativa correta
- A explicação deve citar diretrizes e referências
- Os erros comuns devem refletir armadilhas de prova de residência
- Tempo menor = decisão mais urgente
- Pelo menos 2 das 4 etapas devem ser critical_action = true`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chronicle_content, specialty, topic, difficulty } = await req.json();

    if (!chronicle_content || chronicle_content.length < 100) {
      return new Response(JSON.stringify({ error: "Conteúdo da crônica insuficiente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try cache first for OSCE structures
    const cacheKey = buildCacheKey({ specialty, topic, difficulty, objective: "osce" });
    const cached = await getCachedContent(cacheKey, "osce");
    if (cached) {
      console.log(`[generate-chronicle-osce] Cache HIT for ${cacheKey}`);
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analise esta crônica médica e gere a simulação OSCE:\n\n**Especialidade:** ${specialty || "Clínica Médica"}\n**Tema:** ${topic || "Geral"}\n**Dificuldade:** ${difficulty || "avancado"}\n\n---\n\n${chronicle_content.slice(0, 8000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_osce",
            description: "Gera simulação OSCE a partir de crônica médica",
            parameters: {
              type: "object",
              properties: {
                structured_data: {
                  type: "object",
                  properties: {
                    specialty: { type: "string" },
                    topic: { type: "string" },
                    difficulty: { type: "string" },
                    diagnosis: { type: "string" },
                    keyFindings: { type: "array", items: { type: "string" } },
                    criticalPoints: { type: "array", items: { type: "string" } },
                    commonErrors: { type: "array", items: { type: "string" } },
                  },
                  required: ["specialty", "topic", "difficulty", "diagnosis", "keyFindings", "criticalPoints", "commonErrors"],
                },
                osce_stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      stage_type: { type: "string", enum: ["diagnostico", "exame", "conduta", "priorizacao"] },
                      title: { type: "string" },
                      clinical_context: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            text: { type: "string" },
                            is_correct: { type: "boolean" },
                          },
                          required: ["text", "is_correct"],
                        },
                      },
                      explanation: { type: "string" },
                      time_limit_seconds: { type: "number" },
                      critical_action: { type: "boolean" },
                    },
                    required: ["stage_type", "title", "clinical_context", "options", "explanation", "time_limit_seconds", "critical_action"],
                  },
                },
              },
              required: ["structured_data", "osce_stages"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_osce" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Falha na geração do OSCE" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let osceData;
    try {
      osceData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      console.error("Failed to parse tool arguments:", toolCall.function.arguments);
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate structure
    if (!osceData.osce_stages || !Array.isArray(osceData.osce_stages) || osceData.osce_stages.length < 3) {
      console.error("Invalid OSCE stages:", JSON.stringify(osceData));
      return new Response(JSON.stringify({ error: "Estrutura OSCE incompleta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache the result for future reuse (fire-and-forget)
    setCachedContent(cacheKey, "osce", osceData, "google/gemini-2.5-flash", 30).catch(() => {});

    return new Response(JSON.stringify(osceData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-chronicle-osce error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
