import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Autonomous Medical Graph: Discovers semantic relationships between medical concepts.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { concepts } = await req.json(); // e.g., ["Insuficiência Cardíaca", "IECA", "Hipercalemia"]

    if (!concepts || !Array.isArray(concepts)) throw new Error("concepts array is required");

    // 1. Discover Relationships via AI
    const response = await aiFetch({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um Arquiteto de Ontologia Médica. Identifique as relações semânticas e clínicas entre os conceitos fornecidos.
          
          Responda em JSON:
          {
            "relations": [
              {"source": "...", "type": "causa|tratamento|efeito_colateral|diagnóstico", "target": "...", "strength": 0-1}
            ]
          }`
        },
        {
          role: "user",
          content: `Conceitos: ${concepts.join(", ")}`
        }
      ]
    });

    if (!response.ok) throw new Error("AI failed to discover relations");

    const aiResult = await response.json();
    const { relations } = JSON.parse(aiResult.choices[0].message.content);

    // 2. Persist in Knowledge Graph
    for (const rel of relations) {
      await supabase.from("medical_knowledge_graph").upsert({
        source_entity: rel.source,
        relation_type: rel.type,
        target_entity: rel.target,
        strength: rel.strength,
        metadata: { discovered_by: "autonomous_graph_engine", discovered_at: new Date().toISOString() }
      }, { onConflict: "source_entity,relation_type,target_entity" });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      relations_found: relations.length 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
