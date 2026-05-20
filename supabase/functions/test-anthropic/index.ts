import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing ANTHROPIC_API_KEY secret" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Clean the API key from any potential non-ByteString characters (like newlines or trailing spaces)
  apiKey = apiKey.trim().replace(/[\r\n]/g, '')

  try {
    console.log("Testing Anthropic API with model claude-3-5-haiku-20241022...")
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Diga oi em portugues' }
        ],
      }),
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON response from Anthropic", raw: text }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!response.ok) {
      console.error("Anthropic API Error:", data)
      return new Response(
        JSON.stringify({ 
          ok: false, 
          status: response.status, 
          error: data.error?.message || "Unknown error",
          raw: data 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        response: data.content[0].text 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Runtime Error:", error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
