import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiFetch, getAiErrorMessage } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { term } = await req.json();
    if (!term || typeof term !== "string") {
      return new Response(JSON.stringify({ error: "term is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedTerm = term.trim().toLowerCase();

    // Check cache
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cached } = await supabaseAdmin
      .from("medical_terms")
      .select("definition_json, specialty")
      .eq("term", normalizedTerm)
      .maybeSingle();

    if (cached?.definition_json) {
      return new Response(JSON.stringify({ term: normalizedTerm, ...cached.definition_json, specialty: cached.specialty }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate with AI
    const systemPrompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA responda em inglês. Inglês permitido APENAS em nomes de artigos/guidelines.\n\nVocê é um professor de medicina especialista. Gere uma explicação estruturada sobre o termo médico solicitado, voltada para estudantes de residência médica no Brasil. Use referências de Harrison, Sabiston, diretrizes SBC, MS e FEBRASGO quando aplicável.`;

    const response = await aiFetch({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Explique o termo médico: "${term}"` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "medical_term_definition",
            description: "Retorna a definição estruturada de um termo médico",
            parameters: {
              type: "object",
              properties: {
                definicao: { type: "string", description: "Definição concisa do termo (2-3 frases)" },
                fisiopatologia: { type: "string", description: "Fisiopatologia resumida (3-5 frases)" },
                diagnostico: { type: "string", description: "Critérios diagnósticos e exames relevantes (3-5 frases)" },
                tratamento: { type: "string", description: "Tratamento de primeira linha e manejo (3-5 frases)" },
                specialty: { type: "string", description: "Especialidade médica principal (ex: Cardiologia, Pneumologia)" },
                fontes: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-4 referências bibliográficas relevantes"
                },
              },
              required: ["definicao", "fisiopatologia", "diagnostico", "tratamento", "specialty", "fontes"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "medical_term_definition" } },
      timeoutMs: 30000,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText.slice(0, 300));
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar definição" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let definition;
    if (toolCall?.function?.arguments) {
      definition = typeof toolCall.function.arguments === "string" 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments;
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      definition = {
        definicao: content.slice(0, 500),
        fisiopatologia: "",
        diagnostico: "",
        tratamento: "",
        specialty: "Geral",
        fontes: [],
      };
    }

    const { specialty, ...defWithoutSpecialty } = definition;

    // Cache in DB
    await supabaseAdmin.from("medical_terms").upsert({
      term: normalizedTerm,
      specialty: specialty || "Geral",
      definition_json: defWithoutSpecialty,
    }, { onConflict: "term" });

    return new Response(JSON.stringify({ term: normalizedTerm, ...defWithoutSpecialty, specialty }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("medical-term-lookup error:", err);
    const msg = getAiErrorMessage(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
