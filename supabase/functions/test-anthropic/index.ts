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
  
  // Create a character map to see exactly what's in the string
  const charCodes = Array.from(apiKey).map(c => ({
    char: c === '\n' ? '\\n' : c === '\r' ? '\\r' : c,
    code: c.charCodeAt(0)
  })).slice(0, 20)

  return new Response(
    JSON.stringify({ 
      length: apiKey.length,
      prefix: apiKey.substring(0, 15),
      charCodes
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
