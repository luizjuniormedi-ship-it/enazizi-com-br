import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { logPipelineAlert } from "../_shared/pipeline-logger.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    return new Response(JSON.stringify({
      success: true,
      function: "search-real-questions",
      stage: "IMPORT_PIPELINE_LOGGER_OK",
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
      stage: "IMPORT_PIPELINE_LOGGER_CATCH",
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
