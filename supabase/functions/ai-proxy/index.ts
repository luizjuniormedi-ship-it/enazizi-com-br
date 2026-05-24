import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, model, systemPrompt, temperature, responseFormat } = await req.json();
    
    // Default to generation model if no model provided
    const targetModel = model || ALLOWED_MODELS.generation;
    
    const messages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ];

    const response = await aiFetch({
      model: targetModel,
      messages,
      response_format: responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    if (!response.ok) {
      const err = await response.text();
      return corsResponse({ error: err }, response.status);
    }

    const data = await response.json();
    return corsResponse(data, 200);
  } catch (e) {
    return corsResponse({ 
      error: e instanceof Error ? e.message : String(e),
      log: "[EDGE_SAFE_FAIL]"
    }, 500);
  }
});
