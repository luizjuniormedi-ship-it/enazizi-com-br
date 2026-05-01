
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get active workers health
    const { data: workers, error: workerError } = await supabaseClient
      .from('cme_gpu_workers')
      .select('*')
      .gt('last_heartbeat', new Date(Date.now() - 60000).toISOString()) // Active in last minute

    if (workerError) throw workerError

    // Get active jobs status
    const { data: activeJobs, error: jobError } = await supabaseClient
      .from('cme_render_jobs')
      .select('status, render_stage, project_id')
      .in('status', ['queued', 'processing', 'rendering'])

    if (jobError) throw jobError

    const health = {
      workers_online: workers?.length || 0,
      total_vram_mb: workers?.reduce((acc, w) => acc + (w.vram_total_mb || 0), 0) || 0,
      used_vram_mb: workers?.reduce((acc, w) => acc + (w.vram_used_mb || 0), 0) || 0,
      avg_load: workers?.length ? (workers.reduce((acc, w) => acc + (w.current_load || 0), 0) / workers.length) : 0,
      avg_temp: workers?.length ? (workers.reduce((acc, w) => acc + (w.temperature_c || 0), 0) / workers.length) : 0,
      status: workers?.length ? 'healthy' : 'degraded',
      active_jobs_count: activeJobs?.length || 0
    }

    return new Response(
      JSON.stringify({ 
        health,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
