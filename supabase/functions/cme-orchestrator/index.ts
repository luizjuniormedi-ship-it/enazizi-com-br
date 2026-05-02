
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

    if (action === 'start_pipeline' || action === 'start_render') {
      const { data: project, error: pError } = await supabaseClient
        .from('cme_video_projects')
        .select('*, aggregation:cme_session_aggregations(*)')
        .eq('id', projectId)
        .single();
      
      if (pError || !project) throw new Error("PROJECT_NOT_FOUND");

      const { data: lineageNode } = await supabaseClient
        .from('cme_lineage_nodes')
        .insert({
          type: 'tutor_session',
          entity_id: project.aggregation?.session_id || projectId,
          metadata: { project_id: projectId, action: 'start_pipeline', user_id: user.id }
        })
        .select()
        .single();

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

      const { data: workers } = await supabaseClient
        .from('cme_worker_nodes')
        .select('*')
        .eq('status', 'online')
        .eq('is_draining', false);

      let selectedWorker = null;
      if (workers && workers.length > 0) {
        const scoredWorkers = workers.map(w => {
          const vramScore = ((w.vram_total_mb - w.vram_used_mb) / w.vram_total_mb) * 100;
          return { ...w, total_score: vramScore };
        }).sort((a, b) => b.total_score - a.total_score);
        selectedWorker = scoredWorkers[0];

        await supabaseClient
          .from('cme_render_jobs')
          .update({ worker_id: selectedWorker.id })
          .eq('id', job.id);
      }

      return new Response(JSON.stringify({ success: true, jobId: job.id }), { headers: corsHeaders });
    }

    if (action === 'publish_enaflix') {
      const { jobId, videoUrl } = payload;
      
      // Simulate ENAFLIX Publication Logic
      // 5% chance of failure to test recovery
      if (Math.random() < 0.05) {
        await supabaseClient.from('cme_system_incidents').insert({
          category: 'ENAFLIX_PUBLISH',
          message: `Failed to publish job ${jobId}`,
          metadata: { jobId, error: 'TIMEOUT_ON_ASSET_PUBLISH' }
        });
        throw new Error("ENAFLIX_PUBLISH_FAILED");
      }

      await supabaseClient.from('cme_video_assets').insert({
        video_project_id: projectId,
        url: videoUrl,
        status: 'published',
        metadata: { jobId }
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
