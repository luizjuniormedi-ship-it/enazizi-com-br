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

    const { mode = 'incremental', sourceId = null } = await req.json().catch(() => ({}))
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - 5

    // 1. Get active sources
    let query = supabase.from('official_exam_sources').select('*').eq('is_active', true)
    if (sourceId) query = query.eq('id', sourceId)
    
    const { data: sources, error: sourcesError } = await query
    if (sourcesError) throw sourcesError

    const results = []

    for (const source of sources) {
      console.log(`Scanning historical data for: ${source.name} (${startYear}-${currentYear})`)
      
      // Define years to scan
      const yearsToScan = []
      for (let y = currentYear; y >= startYear; y--) {
        yearsToScan.push(y)
      }

      for (const year of yearsToScan) {
        // Logic to simulate finding historical PDFs based on URL patterns and search terms
        // In a real implementation, this would trigger a crawler per year/term
        const searchTerms = source.search_terms || ['prova', 'gabarito']
        
        for (const term of searchTerms) {
          // Mocking discovery of files matching the term and year
          const fileName = `${source.name}_${term.replace(/\s+/g, '_')}_${year}.pdf`
          const fileUrl = `${source.url}/archive/${year}/${fileName}`
          
          const { data: file, error: fileError } = await supabase
            .from('official_exam_files')
            .upsert({
              source_id: source.id,
              file_name: fileName,
              file_url: fileUrl,
              institution: source.name,
              detected_year: year,
              detected_category: term.toLowerCase().includes('gabarito') ? 'gabarito' : (term.toLowerCase().includes('edital') ? 'edital' : 'prova'),
              status: 'discovered',
              metadata: { term, scanned_at: new Date().toISOString() }
            }, { onConflict: 'file_url' })
            .select()
            .single()

          if (!fileError && file) {
            // Queue for download
            await supabase
              .from('official_exam_processing_queue')
              .insert({
                item_type: 'file',
                item_id: file.id,
                priority: year === currentYear ? 10 : 5 // Priority for current year
              })
            
            results.push({ source: source.name, year, file: file.file_name })
          }
        }
      }
      
      // Update last scan
      await supabase
        .from('official_exam_sources')
        .update({ last_historical_scan: new Date().toISOString() })
        .eq('id', source.id)
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length, message: `Discovered ${results.length} historical files.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
