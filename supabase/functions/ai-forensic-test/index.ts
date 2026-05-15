import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { test_type = "basic" } = await req.json().catch(() => ({}));
    
    console.log(`[AI_FORENSIC_TEST] Running test type: ${test_type}`);

    if (test_type === "basic") {
      const resp = await aiFetch({
        model: ALLOWED_MODELS.generation,
        messages: [{ role: "user", content: "Responda apenas: BOOT_OK" }]
      });
      
      const data = await resp.json();
      return new Response(JSON.stringify({ 
        success: true, 
        model_used: ALLOWED_MODELS.generation,
        ai_response: data.choices?.[0]?.message?.content 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (test_type === "invalid_model") {
      const resp = await aiFetch({
        model: "openai/gpt-5-mini", // Should be normalized to gpt-4o-mini
        messages: [{ role: "user", content: "Responda apenas: NORMALIZED_OK" }]
      });
      
      const data = await resp.json();
      return new Response(JSON.stringify({ 
        success: true, 
        original_model: "openai/gpt-5-mini",
        ai_response: data.choices?.[0]?.message?.content 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown test type" }), { status: 400, headers: corsHeaders });

  } catch (err: any) {
    console.error("[AI_FORENSIC_TEST] Error:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
