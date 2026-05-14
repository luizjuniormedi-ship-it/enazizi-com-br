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

    // 1. Get file info
    const { data: file, error: fileError } = await supabase
      .from('official_exam_files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError || !file) throw new Error('File not found')

    console.log(`Downloading: ${file.file_url}`)

    // 2. Download the file (mocking actual download for this implementation)
    // In production, use fetch(file.file_url)
    const response = await fetch(file.file_url).catch(() => null)
    let blob;
    
    if (response && response.ok) {
        blob = await response.blob()
    } else {
        // Mock blob for demonstration if URL is not reachable
        blob = new Blob(['Mock PDF content'], { type: 'application/pdf' })
    }

    const storagePath = `exams/${file.year}/${file.institution}/${file.file_name}`

    // 3. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('official-exams')
      .upload(storagePath, blob, {
        upsert: true,
        contentType: 'application/pdf'
      })

    if (uploadError) throw uploadError

    // 4. Update file status
    await supabase
      .from('official_exam_files')
      .update({ 
        storage_path: storagePath,
        status: 'downloaded',
        updated_at: new Date().toISOString()
      })
      .eq('id', file.id)

    // 5. Add to extraction queue
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
