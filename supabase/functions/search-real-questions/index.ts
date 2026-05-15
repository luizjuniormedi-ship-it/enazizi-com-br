import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { aiFetch } from "../_shared/ai-fetch.ts"
import { validateAIOutput } from "../_shared/ai-validation.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const val = validateAIOutput({ statement: "Test", options: ["A", "B", "C", "D"], correct_index: 0 }, {}, "question");
    return new Response(JSON.stringify({
      success: true,
      function: "search-real-questions",
      stage: "IMPORT_AI_VALIDATION_OK",
      valid: val.valid,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      function: "search-real-questions",
      stage: "IMPORT_AI_VALIDATION_CATCH",
      error: String(err),
      stack: err instanceof Error ? err.stack : null
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  }
})
