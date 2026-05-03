import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  criterios: "critérios diagnósticos",
  causas: "causas / etiologias",
  sinais_classicos: "sinais clássicos",
  classificacao: "classificação",
  efeitos_adversos: "efeitos adversos",
  fatores_de_risco: "fatores de risco",
  lista: "lista geral de itens",
  componentes: "componentes / elementos",
  diagnostico_diferencial_curto: "diagnósticos diferenciais",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, contentType } = await req.json();

    if (!topic || typeof topic !== "string" || topic.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Tema inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeLabel = CONTENT_TYPE_LABELS[contentType] || contentType || "itens principais";

    const prompt = `Você é um professor de medicina especialista em residência médica brasileira.

Dado o tema médico: "${topic.trim()}"
Tipo de conteúdo: "${typeLabel}"

Liste entre 3 e 7 itens que são os mais importantes e cobrados em provas de residência para este tema e tipo de conteúdo.

REGRAS:
- Cada item deve ser curto (1-4 palavras)
- Apenas itens clinicamente corretos e relevantes
- Ordem de importância/frequência em provas
- NÃO inclua dosagens, protocolos de emergência ou conteúdo controverso
- Se o tema não for médico ou não fizer sentido, retorne lista vazia

Responda APENAS com um JSON no formato:
{"items": ["Item 1", "Item 2", "Item 3", ...], "explanation": "Breve explicação do porquê esses itens são importantes"}

Se o tema não for válido para mnemônico médico, responda:
{"items": [], "explanation": "Motivo da rejeição"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Falha ao consultar IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "";

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ items: [], explanation: "Não foi possível gerar sugestões." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return new Response(JSON.stringify({ items: [], explanation: "Erro ao processar resposta." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((i: unknown) => typeof i === "string" && i.trim().length > 0).slice(0, 7)
      : [];

    return new Response(
      JSON.stringify({ items, explanation: parsed.explanation || "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
