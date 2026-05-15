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
    const { fileId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: file, error: fileError } = await supabase
      .from('official_exam_files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError || !file) throw new Error('File not found')

    console.log(`Downloading real PDF: ${file.file_url}`)

    // Use a robust fetch with better error handling
    const response = await fetch(file.file_url, { 
      headers: { "User-Agent": "Mozilla/5.0" } 
    }).catch(err => {
      console.error("Fetch error:", err);
      return null;
    });
    
    if (!response || !response.ok) {
      throw new Error(`Falha ao baixar PDF (${response?.status || 'network error'}). Verifique se o site tem bloqueios de SSL ou IP.`);
    }

    const blob = await response.blob();
    const storagePath = `exams/${file.year || 'unknown'}/${file.institution.replace(/[^a-zA-Z0-9]/g, '_')}/${file.file_name.replace(/[^a-zA-Z0-9.]/g, '_')}`

    const { error: uploadError } = await supabase.storage
      .from('official-exams')
      .upload(storagePath, blob, {
        upsert: true,
        contentType: 'application/pdf'
      })

    if (uploadError) throw uploadError

    await supabase
      .from('official_exam_files')
      .update({ 
        storage_path: storagePath,
        status: 'downloaded',
        updated_at: new Date().toISOString()
      })
      .eq('id', file.id)

    await supabase
      .from('official_exam_processing_queue')
      .insert({
        item_type: 'extraction',
        item_id: file.id,
        priority: 5
      })

    return new Response(
      JSON.stringify({ success: true, storagePath }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`[Download Error] ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})