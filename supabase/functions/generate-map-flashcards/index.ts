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

    // Check if flashcards already exist for this map
    const { count: existingCount } = await supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("source_map_id", map_id)
      .eq("user_id", user.id);

    if (existingCount && existingCount > 0) {
      return new Response(JSON.stringify({ error: "Flashcards já gerados para este mapa", count: existingCount }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentJson = map.content_json;
    if (!contentJson?.nodes || !Array.isArray(contentJson.nodes)) {
      return new Response(JSON.stringify({ error: "Mapa sem conteúdo válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract relevant nodes for flashcard generation
    const priorityCategories = [
      "Diagnóstico", "Tratamento", "Complicações", "Diagnósticos Diferenciais",
      "Pontos de Prova", "Fisiopatologia", "Quadro Clínico", "Definição",
      "Epidemiologia", "Prognóstico"
    ];

    const nodesForFlashcards: { category: string; name: string; details: string }[] = [];

    for (const node of contentJson.nodes) {
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child.details && child.details.length >= 20) {
            nodesForFlashcards.push({
              category: node.name,
              name: child.name,
              details: child.details,
            });
          }
        }
      }
      // Also add parent node if it has details
      if (node.details && node.details.length >= 20) {
        nodesForFlashcards.push({
          category: node.name,
          name: node.name,
          details: node.details,
        });
      }
    }

    if (nodesForFlashcards.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum conteúdo suficiente para gerar flashcards" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to generate high-quality flashcards
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const nodesText = nodesForFlashcards.map((n, i) =>
      `${i + 1}. [${n.category}] ${n.name}: ${n.details}`
    ).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Você é um professor de medicina que cria flashcards para residência médica.

REGRAS:
- Responda APENAS com JSON válido, sem markdown.
- Gere flashcards objetivos e clinicamente precisos.
- Cada flashcard deve ter pergunta e resposta.
- Linguagem: português brasileiro médico.
- Foco: informações que caem em prova de residência.
- Evite perguntas genéricas. Priorize: diagnóstico, tratamento, complicações, diferenciais.
- Gere entre 8 e 20 flashcards, priorizando qualidade.

FORMATO JSON:
{
  "flashcards": [
    { "question": "Pergunta clínica objetiva?", "answer": "Resposta clara e completa." }
  ]
}`
          },
          {
            role: "user",
            content: `Tema: "${contentJson.title}"\n\nConteúdo do mapa mental:\n${nodesText}\n\nGere flashcards de alta qualidade para estudo de residência médica.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let flashcardsData;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      flashcardsData = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Parse error:", rawContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "Erro ao processar flashcards da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards)) {
      return new Response(JSON.stringify({ error: "Formato inválido de flashcards" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert flashcards
    const rows = flashcardsData.flashcards
      .filter((f: any) => f.question && f.answer)
      .map((f: any) => ({
        user_id: user.id,
        question: f.question,
        answer: f.answer,
        topic: contentJson.title,
        is_global: false,
        source_map_id: map_id,
      }));

    const { data: inserted, error: insertErr } = await supabase
      .from("flashcards")
      .insert(rows)
      .select("id");

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar flashcards" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create FSRS cards for spaced repetition
    const now = new Date();
    const fsrsRows = (inserted || []).map((fc: any) => ({
      user_id: user.id,
      card_type: "flashcard",
      card_ref_id: fc.id,
      stability: 1.0,
      difficulty: 5.0,
      elapsed_days: 0,
      scheduled_days: 1,
      reps: 0,
      lapses: 0,
      state: 0,
      due: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      last_review: null,
    }));

    if (fsrsRows.length > 0) {
      await supabase.from("fsrs_cards").insert(fsrsRows);
    }

    // Update counter on map
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await svc.from("mental_maps")
      .update({ flashcards_count: rows.length })
      .eq("id", map_id);

    return new Response(JSON.stringify({
      success: true,
      count: rows.length,
      message: `${rows.length} flashcards gerados com revisão espaçada ativada`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-map-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
