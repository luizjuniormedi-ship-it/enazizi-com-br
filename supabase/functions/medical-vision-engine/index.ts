import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, asset_url, modality } = await req.json();

    if (!asset_url) throw new Error("asset_url is required");

    // 1. Vision AI Request
    const response = await aiFetch({
      model: "gpt-4o", // High performance multimodal model
      messages: [
        {
          role: "system",
          content: `Você é um radiologista e especialista em diagnóstico por imagem. Analise este ${modality} e forneça uma interpretação técnica estruturada em PT-BR.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Interprete este exame médico (${modality}).` },
            { type: "image_url", image_url: { url: asset_url } }
          ]
        }
      ]
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI error: ${errorText}`);
    }

    const aiResult = await response.json();
    const interpretation = aiResult.choices[0].message.content;

    // 2. Store Analysis
    const { data: analysis } = await supabase.from("medical_vision_analysis").insert({
      user_id,
      modality,
      ai_interpretation: { raw_text: interpretation },
      confidence: 0.92, // Mocked for now
      clinical_relevance_score: 5
    }).select().single();

    return new Response(JSON.stringify({ 
      success: true, 
      analysis 
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
