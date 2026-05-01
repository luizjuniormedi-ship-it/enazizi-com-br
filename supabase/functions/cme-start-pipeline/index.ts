import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { tutorSessionId, mode } = await req.json()
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // 1. Fetch entire Tutor Session
    const { data: session } = await supabaseClient
      .from('tutor_sessions')
      .select('*')
      .eq('id', tutorSessionId)
      .single()

    const { data: messages } = await supabaseClient
      .from('tutor_messages')
      .select('*')
      .eq('tutor_session_id', tutorSessionId)
      .order('created_at', { ascending: true })

    if (!messages || messages.length === 0) throw new Error('No content found in session')

    // 2. Aggregate Content
    const fullText = messages.map(m => m.content).join("\n\n---\n\n")
    
    // 3. Create Session Aggregation
    const { data: aggregation, error: aggError } = await supabaseClient
      .from('cme_session_aggregations')
      .insert({
        tutor_session_id: tutorSessionId,
        user_id: user.id,
        title: session?.title || 'Sessão Médica Agregada',
        aggregated_content: fullText,
        aggregation_status: 'aggregating',
        cognitive_density: 0.85,
        estimated_duration: Math.ceil(fullText.length / 1000) * 2
      })
      .select()
      .single()

    if (aggError) throw aggError

    // 4. Generate Blocks (Pedagogical Chapters)
    const blocks = []
    const sections = fullText.split("\n#").filter(s => s.trim())
    
    for (let i = 0; i < Math.min(sections.length, 10); i++) {
      const section = sections[i]
      const title = section.split("\n")[0].replace(/^#+\s*/, "").trim() || `Capítulo ${i+1}`
      blocks.push({
        aggregation_id: aggregation.id,
        block_type: i === 0 ? 'introduction' : (i === sections.length - 1 ? 'summary' : 'physiology'),
        title,
        content: section,
        order_index: i,
        estimated_minutes: 2,
        cognitive_density: 0.8
      })
    }

    if (blocks.length === 0) {
      blocks.push({
        aggregation_id: aggregation.id,
        block_type: 'introduction',
        title: 'Introdução ao Tema',
        content: fullText.substring(0, 1000),
        order_index: 0,
        estimated_minutes: 5,
        cognitive_density: 0.7
      })
    }

    await supabaseClient.from('cme_lesson_blocks').insert(blocks)

    // 5. Create Render Job
    const { data: renderJob } = await supabaseClient
      .from('cme_render_jobs')
      .insert({
        aggregation_id: aggregation.id,
        status: 'queued',
        render_stage: 'planning',
        progress: 0
      })
      .select()
      .single()

    // 6. Log Initial Event
    await supabaseClient.from('cme_pipeline_events').insert({
      aggregation_id: aggregation.id,
      render_job_id: renderJob?.id,
      stage: 'aggregation',
      status: 'completed',
      progress: 10,
      message: 'Sessão médica agregada e capítulos detectados.'
    })

    // 7. Update Aggregation Status
    await supabaseClient.from('cme_session_aggregations')
      .update({ aggregation_status: 'blocks_generated' })
      .eq('id', aggregation.id)

    return new Response(
      JSON.stringify({ success: true, aggregationId: aggregation.id, renderJobId: renderJob?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
