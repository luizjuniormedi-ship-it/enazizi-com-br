
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

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', ''))
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { action, projectId, payload } = await req.json()

    if (action === 'start_render') {
      // 1. Validate Scene Graph
      const { data: sceneGraph, error: sgError } = await supabaseClient
        .from('cme_scene_graphs')
        .select('id, aggregation_id')
        .eq('project_id', projectId)
        .maybeSingle()

      if (sgError || !sceneGraph) {
        return new Response(JSON.stringify({ 
          error: "SCENE_GRAPH_PERSISTENCE_FAILED",
          message: "Não foi possível persistir o grafo de cena antes da renderização.",
          stage: "scene_graph",
          can_open_builder: false
        }), { status: 422, headers: corsHeaders })
      }

      // 2. Check for active workers
      const { data: workers } = await supabaseClient
        .from('cme_worker_nodes')
        .select('id')
        .eq('status', 'online')

      const workerAvailable = workers && workers.length > 0

      // 3. Create Render Job
      const { data: job, error: jobError } = await supabaseClient
        .from('cme_render_jobs')
        .insert({
          project_id: projectId,
          generation_id: sceneGraph.aggregation_id, // Link to aggregation
          status: 'queued',
          render_stage: 'gpu_rendering',
          priority: 1,
          user_id: user.id,
          config: payload
        })
        .select()
        .single()

      if (jobError) throw jobError

      // 4. Log event
      await supabaseClient.from('cme_pipeline_events').insert({
        project_id: projectId,
        aggregation_id: sceneGraph.aggregation_id,
        stage: 'render_queued',
        status: 'queued',
        progress: 55,
        message: workerAvailable ? 'Job enviado para fila de renderização' : 'Renderização aguardando Worker/GPU disponível',
        user_id: user.id
      })

      if (!workerAvailable) {
        return new Response(JSON.stringify({ 
          status: "waiting_hardware",
          message: "Scene graph criado com sucesso. Renderização aguardando Worker/GPU.",
          scene_graph_id: sceneGraph.id,
          job_id: job.id,
          can_open_builder: true
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

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
