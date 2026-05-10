
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildConfig, lineageProjection, validateRenderConfig } from "../_shared/cme-render-config.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const WORKER_HEARTBEAT_TTL_MS = 5 * 60 * 1000;

const hasFreshHeartbeat = (lastHeartbeat?: string | null) => {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() <= WORKER_HEARTBEAT_TTL_MS;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRequest(req: Request) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const authHeader = req.headers.get('Authorization')
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')

  if (authError || !user) {
    return jsonResponse({ success: false, code: 'UNAUTHORIZED', message: 'Não autorizado.' }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, code: 'INVALID_BODY', message: 'Body inválido.' }, 400);
  }

  const { action, projectId, payload } = body || {};
  const safePayload = payload && typeof payload === 'object' ? payload : {};

  if (action === 'start_pipeline' || action === 'start_render') {
    if (!projectId) {
      return jsonResponse({ success: false, code: 'PROJECT_ID_REQUIRED', message: 'projectId é obrigatório.' }, 400);
    }

    const { data: project, error: pError } = await supabaseClient
      .from('cme_video_projects')
      .select('*, aggregation:cme_session_aggregations(*)')
      .eq('id', projectId)
      .maybeSingle();

    if (pError || !project) {
      return jsonResponse({
        success: false,
        code: 'PROJECT_NOT_FOUND',
        message: 'Projeto CME não encontrado.',
        technical_reason: pError?.message,
      }, 404);
    }

    const aggregationId =
      project?.aggregation_id ??
      (project as any)?.aggregation?.id ??
      safePayload?.aggregation_id ??
      null;

    const sessionId =
      (project as any)?.aggregation?.session_id ??
      safePayload?.session_id ??
      null;

    let renderConfig: any;
    try {
      renderConfig = buildConfig(safePayload);
    } catch (e) {
      return jsonResponse({
        success: false,
        code: 'CONFIG_BUILD_FAILED',
        message: 'Falha ao construir configuração de render.',
        technical_reason: (e as Error)?.message,
        fallback_available: true,
      }, 422);
    }

    const validation = validateRenderConfig(renderConfig);
    if (validation.warnings.length > 0) {
      await supabaseClient.from('cme_pipeline_events').insert({
        aggregation_id: aggregationId,
        stage: 'config',
        status: 'warning',
        message: `Config sanitized with warnings: ${validation.warnings.join(', ')}`,
        metadata: { warnings: validation.warnings, projection: lineageProjection(renderConfig) },
        progress: 0,
      }).then(() => {}, () => {});
    }

    await supabaseClient
      .from('cme_lineage_nodes')
      .insert({
        type: 'tutor_session',
        entity_id: sessionId || projectId,
        metadata: {
          project_id: projectId,
          action: 'start_pipeline',
          user_id: user.id,
          render_config: lineageProjection(renderConfig),
        }
      })
      .then(() => {}, () => {});

    const { data: queue } = await supabaseClient
      .from('cme_render_queues')
      .select('id')
      .eq('name', 'Standard')
      .maybeSingle();

    const { data: job, error: jobError } = await supabaseClient
      .from('cme_render_jobs')
      .insert({
        project_id: projectId,
        generation_id: aggregationId,
        aggregation_id: aggregationId,
        render_type: renderConfig.render_mode || 'cinematic',
        status: 'queued',
        queue_id: queue?.id,
        user_id: user.id,
        config: renderConfig,
        idempotency_key: `${projectId}-${Date.now()}`
      })
      .select()
      .single();

    if (jobError || !job) {
      return jsonResponse({
        success: false,
        code: 'RENDER_JOB_INSERT_FAILED',
        message: 'Falha ao criar render job.',
        technical_reason: jobError?.message,
        details: jobError?.details,
        hint: jobError?.hint,
        fallback_available: true,
      }, 500);
    }

    await supabaseClient.from('cme_pipeline_events').insert({
      project_id: projectId,
      aggregation_id: aggregationId,
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

    if (stages && stages.length > 0) {
      const stageExecs = stages.map((s: any) => ({
        render_job_id: job.id,
        stage_id: s.id,
        status: s.display_order === 1 ? 'running' : 'queued',
        started_at: s.display_order === 1 ? new Date().toISOString() : null
      }));
      await supabaseClient.from('cme_stage_executions').insert(stageExecs).then(() => {}, () => {});
    }

    const { data: workers } = await supabaseClient
      .from('cme_worker_nodes')
      .select('*')
      .eq('status', 'online')
      .eq('is_draining', false);

    const availableWorkers = (workers ?? []).filter((w: any) => hasFreshHeartbeat(w.last_heartbeat));

    if (availableWorkers.length > 0) {
      const scoredWorkers = availableWorkers.map((w: any) => {
        const total = (w.vram_total_mb ?? 1) || 1;
        const used = w.vram_used_mb ?? 0;
        const vramScore = ((total - used) / total) * 100;
        return { ...w, total_score: vramScore };
      }).sort((a: any, b: any) => b.total_score - a.total_score);
      const selectedWorker = scoredWorkers[0];

      const { error: assignError } = await supabaseClient
        .from('cme_render_jobs')
        .update({
          gpu_worker_id: selectedWorker.id,
          status: 'rendering',
          progress: 80,
          started_rendering_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (assignError) {
        await supabaseClient.from('cme_pipeline_events').insert({
          project_id: projectId,
          aggregation_id: aggregationId,
          render_job_id: job.id,
          stage: 'worker_selection',
          status: 'failed',
          progress: 65,
          message: `Falha ao atribuir worker GPU: ${assignError.message}`,
          metadata: { code: assignError.code, details: assignError.details, hint: assignError.hint, gpu_worker_id: selectedWorker.id },
        }).then(() => {}, () => {});

        return jsonResponse({
          success: false,
          code: 'WORKER_ASSIGN_FAILED',
          message: 'Falha ao atribuir worker GPU.',
          technical_reason: assignError.message,
          jobId: job.id,
          fallback_available: true,
        }, 500);
      }

      await supabaseClient.from('cme_pipeline_events').insert([
        {
          project_id: projectId,
          aggregation_id: aggregationId,
          render_job_id: job.id,
          stage: 'worker_selection',
          status: 'completed',
          progress: 70,
          message: `Worker selecionado: ${selectedWorker.id}`,
          worker_id: String(selectedWorker.id),
          metadata: { gpu_worker_id: selectedWorker.id },
        },
        {
          project_id: projectId,
          aggregation_id: aggregationId,
          render_job_id: job.id,
          stage: 'gpu_rendering',
          status: 'running',
          progress: 80,
          message: 'GPU iniciou renderização',
          worker_id: String(selectedWorker.id),
          metadata: { gpu_worker_id: selectedWorker.id },
        },
      ]).then(() => {}, () => {});

      return jsonResponse({ success: true, jobId: job.id, status: 'rendering' });
    }

    // No fresh worker available
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
      aggregation_id: aggregationId,
      render_job_id: job.id,
      stage: 'worker_selection',
      status: 'waiting_hardware',
      progress: 65,
      message: 'Nenhum worker GPU com heartbeat recente — aguardando hardware',
      metadata: { workers_seen: workers?.length ?? 0, heartbeat_ttl_ms: WORKER_HEARTBEAT_TTL_MS },
    }).then(() => {}, () => {});

    return jsonResponse({
      success: true,
      jobId: job.id,
      status: 'waiting_hardware',
      message: 'Aguardando worker GPU com heartbeat recente',
    });
  }

  if (action === 'publish_enaflix') {
    const { jobId, videoUrl } = safePayload;

    /* Random failure removed for production stability
    if (Math.random() < 0.05) {
      await supabaseClient.from('cme_system_incidents').insert({
        component: 'ENAFLIX_PUBLISH',
        severity: 'high',
        error_message: `Failed to publish job ${jobId}`,
        metadata: { jobId, error: 'TIMEOUT_ON_ASSET_PUBLISH' }
      }).then(() => {}, () => {});
      return jsonResponse({
        success: false,
        code: 'ENAFLIX_PUBLISH_FAILED',
        message: 'Falha ao publicar no ENAFLIX.',
        fallback_available: true,
      }, 500);
    }
    */

    await supabaseClient.from('cme_video_assets').insert({
      video_project_id: projectId,
      url: videoUrl,
      status: 'published',
      metadata: { jobId }
    }).then(() => {}, () => {});

    return jsonResponse({ success: true });
  }

  if (action === 'retry_render') {
    const { jobId } = safePayload;
    if (!jobId) {
      return jsonResponse({ success: false, code: 'JOB_ID_REQUIRED', message: 'jobId é obrigatório.' }, 400);
    }

    const { data: original, error: oErr } = await supabaseClient
      .from('cme_render_jobs')
      .select('id, project_id, generation_id, queue_id, config, user_id, render_type')
      .eq('id', jobId)
      .maybeSingle();
    if (oErr || !original) {
      return jsonResponse({
        success: false,
        code: 'ORIGINAL_JOB_NOT_FOUND',
        message: 'Job original não encontrado para retry.',
      }, 404);
    }

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
        config: original.config,
        idempotency_key: `${original.project_id}-retry-${Date.now()}`,
      })
      .select()
      .single();
    if (rErr || !retryJob) {
      return jsonResponse({
        success: false,
        code: 'RETRY_INSERT_FAILED',
        message: 'Falha ao criar retry job.',
        technical_reason: rErr?.message,
      }, 500);
    }

    return jsonResponse({ success: true, jobId: retryJob.id, reused_config: true });
  }

  return jsonResponse({
    success: false,
    code: 'INVALID_ACTION',
    message: 'Ação inválida para cme-orchestrator.',
  }, 400);
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    return await handleRequest(req);
  } catch (error: any) {
    console.error('[cme-orchestrator] FATAL', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return jsonResponse({
      success: false,
      stage: 'orchestrator_runtime',
      code: 'CME_ORCHESTRATOR_RUNTIME_ERROR',
      message: 'Falha interna no orquestrador CME.',
      technical_reason: error?.message ?? String(error),
      fallback_available: true,
      can_open_builder: true,
    }, 500);
  }
})
