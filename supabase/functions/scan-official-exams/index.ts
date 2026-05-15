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
      
      // 2. Real Discovery via Scrape
      try {
        const resp = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!resp.ok) {
          console.warn(`Failed to fetch source URL: ${source.url}`);
          continue;
        }
        const html = await resp.text();
        
        // Extract all .pdf links
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
          const detectedYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

          // Basic filtering to ensure it looks like an exam/gabarito
          const isExam = /prova|gabarito|objetiva|caderno|exame/i.test(fileName);
          if (!isExam) continue;

          const { data: file, error: fileError } = await supabase
            .from('official_exam_files')
            .upsert({
              source_id: source.id,
              file_name: fileName,
              file_url: fileUrl,
              institution: source.name,
              detected_year: detectedYear,
              detected_category: fileName.toLowerCase().includes('gabarito') ? 'gabarito' : 'prova',
              status: 'discovered'
            }, { onConflict: 'file_url' })
            .select()
            .single()

          if (!fileError && file) {
            await supabase
              .from('official_exam_processing_queue')
              .insert({
                item_type: 'file',
                item_id: file.id,
                priority: detectedYear === new Date().getFullYear() ? 10 : 5
              })
            
            results.push({ source: source.name, year: detectedYear, status: 'discovered', file: file.file_name })
          }
        }
      } catch (scrapeError) {
        console.error(`Error scraping ${source.name}: ${scrapeError.message}`);
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
