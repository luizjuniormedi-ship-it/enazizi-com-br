
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', ''))

    if (!user) throw new Error('Unauthorized')

    const { tutorSessionId, mode } = await req.json()

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

    // 2. Create Aggregation
    const fullText = messages.map(m => m.content).join("\n\n---\n\n")
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

    // 3. Create Project
    const { data: project } = await supabaseClient
      .from('cme_video_projects')
      .insert({
        aggregation_id: aggregation.id,
        user_id: user.id,
        title: aggregation.title,
        status: 'draft',
        config: { mode: mode || 'standard' }
      })
      .select()
      .single()

    // 4. Start Enterprise Orchestrator
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cme-orchestrator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authHeader?.replace('Bearer ', '')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'start_pipeline',
        projectId: project.id,
        payload: { source: 'tutor_ia', session_id: tutorSessionId }
      })
    })

    const orchestratorResult = await response.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        aggregationId: aggregation.id, 
        projectId: project.id,
        jobId: orchestratorResult.jobId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("[CME Start Pipeline Error]", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
