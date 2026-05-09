import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { topic, specialty, difficulty } = await req.json();
    if (!topic || topic.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Tema obrigatório (mín. 3 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um professor de medicina especialista em criar mapas mentais acadêmicos estruturados.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON válido, sem markdown, sem texto extra.
- Idioma: português brasileiro (pt-BR). Sem termos em inglês.
- Referências bibliográficas reais (Harrison, Cecil, Sabiston, UpToDate, diretrizes brasileiras).
- Cada node deve ter explicação clínica detalhada com no mínimo 50 caracteres.

ESTRUTURA OBRIGATÓRIA DO MAPA:
O mapa deve conter TODOS estes nodes principais (categorias acadêmicas):
1. Definição (cor: blue)
2. Epidemiologia (cor: sky)
3. Fisiopatologia (cor: purple)
4. Quadro Clínico (cor: amber)
5. Diagnóstico (cor: yellow)
6. Tratamento (cor: green)
7. Complicações (cor: red)
8. Prognóstico (cor: gray)
9. Diagnósticos Diferenciais (cor: orange)
10. Pontos de Prova (cor: pink)

Cada categoria deve ter 2-5 subcategorias (children) relevantes.

FORMATO JSON EXATO:
{
  "title": "Nome da Doença/Tema",
  "nodes": [
    {
      "name": "Definição",
      "color": "blue",
      "details": "Explicação resumida da categoria",
      "children": [
        {
          "name": "Subtópico",
          "color": "blue",
          "details": "Explicação clínica detalhada com >= 50 caracteres"
        }
      ]
    }
  ],
  "references": ["Harrison 21ª ed.", "Diretriz SBC 2023"],
  "clinical_pearls": ["Dica clínica 1", "Dica clínica 2"],
  "traps": ["Armadilha de prova 1"]
}`;

    const userPrompt = `Gere um mapa mental acadêmico completo sobre: "${topic}"${specialty ? ` (Especialidade: ${specialty})` : ""}${difficulty ? ` (Nível: ${difficulty})` : ""}.

Siga RIGOROSAMENTE a estrutura com as 10 categorias obrigatórias. Cada child deve ter explicação clínica de qualidade.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let mapData;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      mapData = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate minimum structure
    if (!mapData.title || !Array.isArray(mapData.nodes) || mapData.nodes.length < 5) {
      return new Response(JSON.stringify({ error: "Mapa gerado com estrutura insuficiente. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to DB
    const { data: saved, error: dbErr } = await supabase.from("mental_maps").insert({
      user_id: user.id,
      title: mapData.title,
      content_json: mapData,
      source_topic: topic,
      specialty: specialty || null,
      difficulty: difficulty || "medium",
      source_type: "manual",
      tags: [topic.toLowerCase(), ...(specialty ? [specialty.toLowerCase()] : [])],
    }).select().single();

    if (dbErr) {
      console.error("DB save error:", dbErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar mapa." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ map: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-mind-map error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
