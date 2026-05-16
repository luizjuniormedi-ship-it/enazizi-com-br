
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const MODELS_TO_TEST = [
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.0-flash"
];

serve(async (req) => {
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    const start = Date.now();
    try {
      const response = await fetch("https://api.lovable.dev/v1/ai/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 10
        }),
      });
      
      const duration = Date.now() - start;
      const data = await response.text();
      
      results.push({
        model,
        status: response.status,
        duration,
        response: data.substring(0, 150)
      });
    } catch (e) {
      results.push({
        model,
        error: e.message
      });
    }
  }
  
  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
});
