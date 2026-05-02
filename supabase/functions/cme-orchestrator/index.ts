
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildConfig, lineageProjection, validateRenderConfig } from "../_shared/cme-render-config.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WORKER_HEARTBEAT_TTL_MS = 5 * 60 * 1000;

const hasFreshHeartbeat = (lastHeartbeat?: string | null) => {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() <= WORKER_HEARTBEAT_TTL_MS;
};

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

      const renderConfig = buildConfig(payload);
      const validation = validateRenderConfig(renderConfig);
      if (validation.warnings.length > 0) {
        await supabaseClient.from('cme_pipeline_events').insert({
          aggregation_id: project.aggregation_id,
          stage: 'config',
          status: 'warning',
          message: `Config sanitized with warnings: ${validation.warnings.join(', ')}`,
          metadata: { warnings: validation.warnings, projection: lineageProjection(renderConfig) },
          progress: 0,
        }).then(() => {}, () => {});
      }

      const { data: lineageNode } = await supabaseClient
        .from('cme_lineage_nodes')
        .insert({
          type: 'tutor_session',
          entity_id: project.aggregation?.session_id || projectId,
          metadata: {
            project_id: projectId,
            action: 'start_pipeline',
            user_id: user.id,
            render_config: lineageProjection(renderConfig),
          }
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
          aggregation_id: project.aggregation_id,
          render_type: renderConfig.render_mode || 'cinematic',
          status: 'queued',
          queue_id: queue?.id,
          user_id: user.id,
          config: renderConfig,
          idempotency_key: `${projectId}-${Date.now()}`
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Emit pipeline event: render job created (60%)
      await supabaseClient.from('cme_pipeline_events').insert({
        project_id: projectId,
        aggregation_id: project.aggregation_id,
        render_job_id: job.id,
        stage: 'render_job_creation',
        status: 'completed',
        progress: 60,
        message: 'Render job criado e enfileirado',
      }).then(() => {}, () => {});

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

      const availableWorkers = (workers ?? []).filter((worker) => hasFreshHeartbeat(worker.last_heartbeat));

      let selectedWorker = null;
      if (availableWorkers.length > 0) {
        const scoredWorkers = availableWorkers.map(w => {
          const total = (w.vram_total_mb ?? 1) || 1;
          const used = w.vram_used_mb ?? 0;
          const vramScore = ((total - used) / total) * 100;
          return { ...w, total_score: vramScore };
        }).sort((a, b) => b.total_score - a.total_score);
        selectedWorker = scoredWorkers[0];

        const { error: assignError } = await supabaseClient
          .from('cme_render_jobs')
          .update({ gpu_worker_id: selectedWorker.id, status: 'rendering', progress: 80, started_rendering_at: new Date().toISOString() })
          .eq('id', job.id);

        if (assignError) {
          await supabaseClient.from('cme_pipeline_events').insert({
            project_id: projectId,
            aggregation_id: project.aggregation_id,
            render_job_id: job.id,
            stage: 'worker_selection',
            status: 'failed',
            progress: 65,
            message: `Falha ao atribuir worker GPU: ${assignError.message}`,
            metadata: { code: assignError.code, details: assignError.details, hint: assignError.hint },
          }).then(() => {}, () => {});
          throw assignError;
        }

        await supabaseClient.from('cme_pipeline_events').insert([
          {
            project_id: projectId,
            aggregation_id: project.aggregation_id,
            render_job_id: job.id,
            stage: 'worker_selection',
            status: 'completed',
            progress: 70,
            message: `Worker selecionado: ${selectedWorker.id}`,
            worker_id: selectedWorker.id,
          },
          {
            project_id: projectId,
            aggregation_id: project.aggregation_id,
            render_job_id: job.id,
            stage: 'gpu_rendering',
            status: 'running',
            progress: 80,
            message: 'GPU iniciou renderização',
            worker_id: selectedWorker.id,
          },
        ]).then(() => {}, () => {});

        return new Response(JSON.stringify({ success: true, jobId: job.id, status: 'rendering' }), { headers: corsHeaders });
      }

      // No online worker available — surface explicitly
      await supabaseClient
        .from('cme_render_jobs')
        .update({
          status: 'waiting_hardware',
          progress: 65,
          pipeline_last_error: 'Nenhum worker GPU com heartbeat recente — aguardando hardware',
        })
        .eq('id', job.id)
        .then(() => {}, () => {});

      await supabaseClient.from('cme_pipeline_events').insert({
        project_id: projectId,
        aggregation_id: project.aggregation_id,
        render_job_id: job.id,
        stage: 'worker_selection',
        status: 'waiting_hardware',
        progress: 65,
        message: 'Nenhum worker GPU com heartbeat recente — aguardando hardware',
        metadata: { workers_seen: workers?.length ?? 0, heartbeat_ttl_ms: WORKER_HEARTBEAT_TTL_MS },
      }).then(() => {}, () => {});

      return new Response(JSON.stringify({ success: true, jobId: job.id, status: 'waiting_hardware', message: 'Aguardando worker GPU com heartbeat recente' }), { headers: corsHeaders });
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

    if (action === 'retry_render') {
      const { jobId } = payload || {};
      if (!jobId) throw new Error('jobId required for retry_render');

      // CRITICAL: reuse the original persisted config — do NOT rebuild from payload.
      const { data: original, error: oErr } = await supabaseClient
        .from('cme_render_jobs')
        .select('id, project_id, generation_id, queue_id, config, user_id, render_type')
        .eq('id', jobId)
        .single();
      if (oErr || !original) throw new Error('ORIGINAL_JOB_NOT_FOUND');

      const reuseValidation = validateRenderConfig(original.config);
      if (!reuseValidation.valid) {
        await supabaseClient.from('cme_system_incidents').insert({
          component: 'cme-orchestrator',
          severity: 'high',
          error_message: 'Retry attempted with invalid persisted config',
          stack_trace: JSON.stringify(reuseValidation.errors),
          user_id: user.id,
        }).then(() => {}, () => {});
      }

      const { data: retryJob, error: rErr } = await supabaseClient
        .from('cme_render_jobs')
        .insert({
          project_id: original.project_id,
          generation_id: original.generation_id,
          queue_id: original.queue_id,
          render_type: original.render_type || (original.config as any)?.render_mode || 'cinematic',
          status: 'queued',
          user_id: original.user_id,
          config: original.config, // reuse, do not overwrite
          idempotency_key: `${original.project_id}-retry-${Date.now()}`,
        })
        .select()
        .single();
      if (rErr) throw rErr;

      return new Response(JSON.stringify({ success: true, jobId: retryJob.id, reused_config: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
