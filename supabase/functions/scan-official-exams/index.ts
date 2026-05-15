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
      
      // Historical logic integrated
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5];
      
      for (const year of years) {
        // Search simulation for each year
        const mockDiscovery = {
          source_id: source.id,
          file_name: `${source.name}_Prova_${year}.pdf`,
          file_url: `${source.url}/provas/${year}/prova.pdf`,
          institution: source.name,
          detected_year: year,
          detected_category: 'prova',
          status: 'discovered'
        }

        const { data: file, error: fileError } = await supabase
          .from('official_exam_files')
          .upsert(mockDiscovery, { onConflict: 'file_url' })
          .select()
          .single()

        if (!fileError && file) {
          await supabase
            .from('official_exam_processing_queue')
            .insert({
              item_type: 'file',
              item_id: file.id,
              priority: year === currentYear ? 10 : 5
            })
          
          results.push({ source: source.name, year, status: 'discovered', file: file.file_name })
        }
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
