import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get active sources
    const { data: sources, error: sourcesError } = await supabase
      .from('official_exam_sources')
      .select('*')
      .eq('is_active', true)

    if (sourcesError) throw sourcesError

    const results = []

    for (const source of sources) {
      console.log(`Scanning source: ${source.name} at ${source.url}`)
      
      // In a real scenario, we would use a library like linkedom or cheerio to parse the HTML
      // and look for PDF links. For this demo/implementation, we simulate the discovery.
      
      // Simulate discovering a new PDF
      const mockDiscovery = {
        source_id: source.id,
        file_name: `${source.name}_Prova_2025.pdf`,
        file_url: `${source.url}/provas/2025/prova.pdf`,
        institution: source.name,
        year: 2025,
        status: 'discovered'
      }

      const { data: file, error: fileError } = await supabase
        .from('official_exam_files')
        .upsert(mockDiscovery, { onConflict: 'file_url' })
        .select()
        .single()

      if (!fileError && file) {
        // Add to download queue
        await supabase
          .from('official_exam_processing_queue')
          .insert({
            item_type: 'file',
            item_id: file.id,
            priority: 10
          })
        
        results.push({ source: source.name, status: 'discovered', file: file.file_name })
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
