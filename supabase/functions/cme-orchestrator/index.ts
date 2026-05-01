
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, projectId, payload } = await req.json()

    if (action === 'start_render') {
      // 1. Validate Scene Graph exists
      const { data: sceneGraph, error: sgError } = await supabaseClient
        .from('cme_scene_graphs')
        .select('id')
        .eq('project_id', projectId)
        .single()

      if (sgError || !sceneGraph) {
        throw new Error("Scene Graph not found. Persistence failed.")
      }

      // 2. Create Render Job
      const { data: job, error: jobError } = await supabaseClient
        .from('cme_render_jobs')
        .insert({
          project_id: projectId,
          status: 'queued',
          render_stage: 'gpu_rendering',
          priority: 1,
          config: payload
        })
        .select()
        .single()

      if (jobError) throw jobError

      // 3. Log event
      await supabaseClient.from('cme_pipeline_events').insert({
        project_id: projectId,
        stage: 'rendering',
        status: 'in_progress',
        progress: 50,
        message: 'Job enfileirado no Orchestrator'
      })

      return new Response(JSON.stringify({ success: true, jobId: job.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
