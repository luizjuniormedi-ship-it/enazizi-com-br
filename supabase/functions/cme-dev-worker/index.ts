// CME DEV WORKER — Simulador de GPU worker para ambientes sem hardware real.
// NUNCA habilitar em produção sem variável CME_DEV_WORKER_ENABLED=true.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEV_WORKER_HOSTNAME = 'dev-simulator-01'
const DEV_GPU_NAME = 'NVIDIA RTX 4090 (DEV SIMULATOR)'
const DEV_VRAM_TOTAL = 24576

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function ensureDevWorker(supabase: any, userId: string) {
  const { data: existing } = await supabase
    .from('cme_worker_nodes')
    .select('id')
    .eq('hostname', DEV_WORKER_HOSTNAME)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('cme_worker_nodes')
      .update({
        status: 'online',
        is_draining: false,
        drain_mode: false,
        maintenance_mode: false,
        last_heartbeat: new Date().toISOString(),
        vram_total_mb: DEV_VRAM_TOTAL,
        vram_used_mb: Math.floor(Math.random() * 4000),
        gpu_utilization_pct: Math.floor(Math.random() * 60),
        temperature_c: 50 + Math.floor(Math.random() * 15),
      })
      .eq('id', existing.id)
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('cme_worker_nodes')
    .insert({
      hostname: DEV_WORKER_HOSTNAME,
      gpu_name: DEV_GPU_NAME,
      gpu_memory_mb: DEV_VRAM_TOTAL,
      vram_total_mb: DEV_VRAM_TOTAL,
      vram_used_mb: 1024,
      worker_version: 'dev-1.0.0',
      status: 'online',
      is_draining: false,
      drain_mode: false,
      maintenance_mode: false,
      last_heartbeat: new Date().toISOString(),
      user_id: userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(`DEV_WORKER_INSERT_FAILED: ${error.message}`)
  return created.id
}

async function emitEvent(supabase: any, jobRow: any, stage: string, status: string, progress: number, message: string, workerId: string) {
  await supabase.from('cme_pipeline_events').insert({
    project_id: jobRow.project_id,
    aggregation_id: jobRow.aggregation_id,
    render_job_id: jobRow.id,
    stage,
    status,
    progress,
    message,
    worker_id: String(workerId),
    metadata: { simulated: true, dev_worker: true },
  }).then(() => {}, () => {})
}

async function processJob(supabase: any, workerId: string, jobRow: any) {
  await supabase
    .from('cme_render_jobs')
    .update({
      gpu_worker_id: workerId,
      status: 'rendering',
      progress: 80,
      started_rendering_at: new Date().toISOString(),
      pipeline_last_error: null,
    })
    .eq('id', jobRow.id)

  await emitEvent(supabase, jobRow, 'gpu_rendering', 'running', 80, 'GPU DEV iniciou renderização', workerId)
  await new Promise((r) => setTimeout(r, 1500))

  await emitEvent(supabase, jobRow, 'segment_packaging', 'running', 88, 'Empacotando segmentos HLS', workerId)
  await new Promise((r) => setTimeout(r, 1200))

  await emitEvent(supabase, jobRow, 'hls_cdn_sync', 'running', 95, 'Sincronizando com CDN', workerId)
  await new Promise((r) => setTimeout(r, 800))

  const fakeUrl = `https://cdn.dev.enazizi.local/cme/${jobRow.id}/master.m3u8`
  await supabase
    .from('cme_render_jobs')
    .update({
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
      output_url: fakeUrl,
      render_duration_ms: 3500,
    })
    .eq('id', jobRow.id)

  await emitEvent(supabase, jobRow, 'completed', 'completed', 100, 'Render DEV concluído', workerId)
  return fakeUrl
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const enabled = (Deno.env.get('CME_DEV_WORKER_ENABLED') ?? 'true').toLowerCase() === 'true'
    if (!enabled) {
      return jsonResponse({
        success: false,
        code: 'DEV_WORKER_DISABLED',
        message: 'DEV worker desabilitado neste ambiente.',
      }, 403)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    if (authError || !user) {
      return jsonResponse({ success: false, code: 'UNAUTHORIZED', message: 'Não autorizado.' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action ?? 'heartbeat'

    const workerId = await ensureDevWorker(supabase, user.id)

    if (action === 'heartbeat') {
      return jsonResponse({ success: true, workerId, status: 'online' })
    }

    if (action === 'pickup_and_run') {
      const targetProjectId = body?.projectId as string | undefined
      const targetAggregationId = body?.aggregationId as string | undefined

      // Build query — prefer matching the user's current project if provided
      let query = supabase
        .from('cme_render_jobs')
        .select('id, project_id, aggregation_id, status, gpu_worker_id, queued_at, updated_at')
        .in('status', ['queued', 'waiting_hardware', 'rendering', 'failed', 'stalled'])

      if (targetProjectId) query = query.eq('project_id', targetProjectId)

      const { data: jobs, error: jobsErr } = await query
        .order('updated_at', { ascending: false })
        .limit(10)

      console.log('[cme-dev-worker] pickup query', {
        targetProjectId,
        targetAggregationId,
        found: jobs?.length ?? 0,
        error: jobsErr?.message,
      })

      const target = (jobs ?? []).find((j: any) => j.status !== 'completed')
      if (!target) {
        // Return diagnostics so the UI can show what's available
        const { data: recent } = await supabase
          .from('cme_render_jobs')
          .select('id, project_id, status, progress, updated_at')
          .order('updated_at', { ascending: false })
          .limit(5)
        return jsonResponse({
          success: false,
          code: 'NO_PENDING_JOB',
          workerId,
          message: 'Nenhum job pendente encontrado.',
          recent_jobs: recent ?? [],
          searched_project_id: targetProjectId,
        }, 404)
      }

      console.log('[cme-dev-worker] processing', { jobId: target.id, status: target.status })
      const outputUrl = await processJob(supabase, workerId, target)
      return jsonResponse({
        success: true,
        workerId,
        jobId: target.id,
        previousStatus: target.status,
        outputUrl,
        aggregationId: target.aggregation_id,
        projectId: target.project_id,
      })
    }

    return jsonResponse({ success: false, code: 'INVALID_ACTION', message: 'Ação inválida.' }, 400)
  } catch (error: any) {
    console.error('[cme-dev-worker] FATAL', { name: error?.name, message: error?.message })
    return jsonResponse({
      success: false,
      code: 'DEV_WORKER_RUNTIME_ERROR',
      message: 'Falha no DEV worker.',
      technical_reason: error?.message,
    }, 500)
  }
})
