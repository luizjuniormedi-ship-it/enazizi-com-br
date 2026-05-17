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
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const user = { id: auth.userId };
    const authHeader = req.headers.get("Authorization") ?? `Bearer ${auth.token}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { map_id } = await req.json();
    if (!map_id) {
      return new Response(JSON.stringify({ error: "map_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch map
    const { data: map, error: mapErr } = await supabase
      .from("mental_maps")
      .select("*")
      .eq("id", map_id)
      .eq("user_id", user.id)
      .single();

    if (mapErr || !map) {
      return new Response(JSON.stringify({ error: "Mapa não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing
    const { count: existingCount } = await supabase
      .from("questions_bank")
      .select("id", { count: "exact", head: true })
      .eq("source_map_id", map_id)
      .eq("user_id", user.id);

    if (existingCount && existingCount > 0) {
      return new Response(JSON.stringify({ error: "Questões já geradas para este mapa", count: existingCount }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentJson = map.content_json;
    if (!contentJson?.nodes || !Array.isArray(contentJson.nodes)) {
      return new Response(JSON.stringify({ error: "Mapa sem conteúdo válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from nodes
    const nodesText = contentJson.nodes.map((node: any) => {
      let text = `[${node.name}]: ${node.details || ""}`;
      if (node.children) {
        for (const child of node.children) {
          text += `\n  - ${child.name}: ${child.details || ""}`;
        }
      }
      return text;
    }).join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um professor de medicina que cria questões de múltipla escolha para residência médica.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON válido, sem markdown.
- Gere entre 5 e 10 questões de alta qualidade.
- Cada questão deve ter: enunciado clínico, 5 alternativas, índice correto (0-4), explicação, dificuldade (1-5), tema e subtema.
- Priorize questões de: diagnóstico, tratamento, diferenciais, complicações, pontos de prova.
- Linguagem: português brasileiro médico. Sem inglês.
- Alternativas devem ser plausíveis e desafiadoras.
- Explicação deve justificar a correta E explicar por que as outras estão erradas.

FORMATO JSON:
{
  "questions": [
    {
      "statement": "Enunciado clínico completo...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
      "correct_index": 0,
      "explanation": "Explicação detalhada...",
      "difficulty": 3,
      "topic": "Tema principal",
      "subtopic": "Subtema específico"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Tema: "${contentJson.title}"${map.specialty ? ` (${map.specialty})` : ""}\n\nConteúdo do mapa mental:\n${nodesText}\n\nGere questões clínicas de múltipla escolha para prova de residência.`
          }
        ],
        temperature: 0.35,
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let questionsData;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      questionsData = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Parse error:", rawContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "Erro ao processar questões da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
      return new Response(JSON.stringify({ error: "Formato inválido de questões" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert questions
    const rows = questionsData.questions
      .filter((q: any) => q.statement && q.options?.length === 5 && typeof q.correct_index === "number")
      .map((q: any) => ({
        user_id: user.id,
        statement: q.statement,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation || "",
        difficulty: q.difficulty || 3,
        topic: q.topic || contentJson.title,
        subtopic: q.subtopic || null,
        source: "mind_map",
        source_type: "ai_generated",
        is_global: false,
        source_map_id: map_id,
        quality_tier: "standard",
      }));

    const { error: insertErr } = await supabase
      .from("questions_bank")
      .insert(rows);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar questões" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update counter
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await svc.from("mental_maps")
      .update({ questions_count: rows.length })
      .eq("id", map_id);

    return new Response(JSON.stringify({
      success: true,
      count: rows.length,
      message: `${rows.length} questões geradas com sucesso`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-map-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
