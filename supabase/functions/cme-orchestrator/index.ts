
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

    // Alias: 'start_render' is invoked after Scene Graph persistence (useTutorCME)
    // Behaves like 'start_pipeline' but assumes the project already exists.
    if (action === 'start_pipeline' || action === 'start_render') {
      // 1. Get Aggregation context
      const { data: project, error: pError } = await supabaseClient
        .from('cme_video_projects')
        .select('*, aggregation:cme_session_aggregations(*)')
        .eq('id', projectId)
        .single();
      
      if (pError || !project) throw new Error("PROJECT_NOT_FOUND");

      // 2. Initialize Lineage Node
      const { data: lineageNode } = await supabaseClient
        .from('cme_lineage_nodes')
        .insert({
          type: 'tutor_session',
          entity_id: project.aggregation.session_id || projectId,
          metadata: { project_id: projectId, action: 'start_pipeline' }
        })
        .select()
        .single();

      // 3. Create Render Job with Priority and Queue
      const { data: queue } = await supabaseClient
        .from('cme_render_queues')
        .select('id')
        .eq('name', 'Standard')
        .maybeSingle();

      const { data: job, error: jobError } = await supabaseClient
        .from('cme_render_jobs')
        .insert({
          project_id: projectId,
          generation_id: project.aggregation_id,
          status: 'queued',
          queue_id: queue?.id,
          user_id: user.id,
          config: payload,
          idempotency_key: `${projectId}-${Date.now()}`
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // 4. Initialize Multi-Stage Execution
      const { data: stages } = await supabaseClient
        .from('cme_pipeline_stages')
        .select('*')
        .order('display_order');

      if (stages) {
        const stageExecs = stages.map(s => ({
          render_job_id: job.id,
          stage_id: s.id,
          status: s.display_order === 1 ? 'running' : 'queued',
          started_at: s.display_order === 1 ? new Date().toISOString() : null
        }));

        await supabaseClient.from('cme_stage_executions').insert(stageExecs);
      }

      // 5. Worker Selection Logic (Simplified Orchestration)
      const { data: workers } = await supabaseClient
        .from('cme_worker_nodes')
        .select('*')
        .eq('status', 'online')
        .eq('is_draining', false)
        .eq('maintenance_mode', false);

      let selectedWorker = null;
      if (workers && workers.length > 0) {
        // Score: (Free VRAM * 0.6) + (100 - Temperature * 0.2) + (100 - Utilization * 0.2)
        const scoredWorkers = workers.map(w => {
          const vramScore = ((w.vram_total_mb - w.vram_used_mb) / w.vram_total_mb) * 100;
          const tempScore = Math.max(0, 100 - (w.temperature_c || 40));
          const utilScore = 100 - (w.gpu_utilization_pct || 0);
          const score = (vramScore * 0.6) + (tempScore * 0.2) + (utilScore * 0.2);
          return { ...w, total_score: score };
        });

        scoredWorkers.sort((a, b) => b.total_score - a.total_score);
        selectedWorker = scoredWorkers[0];

        // Assign job to worker
        await supabaseClient
          .from('cme_render_jobs')
          .update({ 
            worker_id: selectedWorker.id,
            worker_selection_score: { 
              score: selectedWorker.total_score,
              factors: { vram: selectedWorker.vram_total_mb - selectedWorker.vram_used_mb, temp: selectedWorker.temperature_c }
            }
          })
          .eq('id', job.id);
      }

      // 6. Log Initial Event
      await supabaseClient.from('cme_pipeline_events').insert({
        project_id: projectId,
        aggregation_id: project.aggregation_id,
        stage: 'ingestion',
        status: 'running',
        progress: 5,
        message: selectedWorker ? `Pipeline iniciado no worker ${selectedWorker.hostname}` : 'Pipeline iniciado. Aguardando worker disponível.',
        user_id: user.id
      });

      return new Response(JSON.stringify({ 
        success: true, 
        jobId: job.id,
        workerAssigned: !!selectedWorker,
        workerName: selectedWorker?.hostname 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'stage_completed') {
      const { jobId, stageName, outputData, metrics } = payload;
      
      const { data: stage } = await supabaseClient
        .from('cme_pipeline_stages')
        .select('id, display_order')
        .eq('name', stageName)
        .single();

      if (!stage) throw new Error("STAGE_NOT_FOUND");

      // Update current stage
      await supabaseClient
        .from('cme_stage_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output_data: outputData,
          metrics: metrics
        })
        .eq('render_job_id', jobId)
        .eq('stage_id', stage.id);

      // Start next stage
      const { data: nextStage } = await supabaseClient
        .from('cme_pipeline_stages')
        .select('id, name')
        .eq('display_order', stage.display_order + 1)
        .maybeSingle();

      if (nextStage) {
        await supabaseClient
          .from('cme_stage_executions')
          .update({
            status: 'running',
            started_at: new Date().toISOString()
          })
          .eq('render_job_id', jobId)
          .eq('stage_id', nextStage.id);
        
        // Log event
        await supabaseClient.from('cme_pipeline_events').insert({
          render_job_id: jobId,
          stage: nextStage.name,
          status: 'running',
          message: `Iniciando etapa: ${nextStage.name}`,
          user_id: user.id
        });
      } else {
        // Pipeline Finished
        await supabaseClient
          .from('cme_render_jobs')
          .update({ status: 'completed' })
          .eq('id', jobId);
          
        await supabaseClient.from('cme_pipeline_events').insert({
          render_job_id: jobId,
          stage: 'analytics_registration',
          status: 'completed',
          message: 'Pipeline CME concluído com sucesso.',
          user_id: user.id
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });

  } catch (error) {
    console.error("[CME Orchestrator Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})
