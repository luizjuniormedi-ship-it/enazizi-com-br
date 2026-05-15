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
      
      // 2. Real Scrape for historical links
      try {
        const resp = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!resp.ok) continue;
        const html = await resp.text();
        
        const pdfRegex = /href=["']([^"']+\.pdf)["']/gi;
        const matches = [...html.matchAll(pdfRegex)];
        
        for (const match of matches) {
          let fileUrl = match[1];
          if (!fileUrl.startsWith('http')) {
            const baseUrl = new URL(source.url);
            fileUrl = new URL(fileUrl, baseUrl.origin + baseUrl.pathname).href;
          }

          const fileName = decodeURIComponent(fileUrl.split('/').pop() || "prova.pdf").replace(/[_-]/g, " ");
          const yearMatch = fileName.match(/(20\d{2})/);
          const year = yearMatch ? parseInt(yearMatch[1]) : null;

          if (year && year >= startYear && year <= currentYear) {
            const isExam = /prova|gabarito|objetiva|caderno|exame|edital/i.test(fileName);
            if (!isExam) continue;

            const category = fileName.toLowerCase().includes('gabarito') ? 'gabarito' : (fileName.toLowerCase().includes('edital') ? 'edital' : 'prova');

            const { data: file, error: fileError } = await supabase
              .from('official_exam_files')
              .upsert({
                source_id: source.id,
                file_name: fileName,
                file_url: fileUrl,
                institution: source.name,
                detected_year: year,
                year: year,
                detected_category: category,
                status: 'discovered',
                metadata: { scanned_at: new Date().toISOString() }
              }, { onConflict: 'file_url' })
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
              results.push({ source: source.name, year, file: file.file_name })
            }
          }
        }
      } catch (err) {
        console.error(`Error crawling ${source.name}: ${err.message}`);
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
