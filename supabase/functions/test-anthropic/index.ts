import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
  
  // Debug validation: Check for invisible characters
  const hasInvisibles = /[^\x20-\x7E]/.test(apiKey)
  const length = apiKey.length
  const prefix = apiKey.substring(0, 7)

  return new Response(
    JSON.stringify({ 
      ok: false, 
      debug: {
        length,
        prefix,
        hasInvisibles,
        message: "Check logs for character codes"
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
