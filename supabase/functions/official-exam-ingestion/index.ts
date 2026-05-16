// official-exam-ingestion - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Robust automated medical exam ingestion and cognitive parsing.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";

export default enterpriseEdgeHandler("official-exam-ingestion", async ({ req, logger, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH & ADMIN
  const { user } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  // 2. PARSE
  const body = await req.json().catch(() => ({}));
  const { action, source_id } = body;

  logger.info("INGESTION_START", `Action: ${action}`, { source_id });

  // 3. LOG RUN
  const { data: run, error: runError } = await supabaseAdmin
    .from('ingestion_pipeline_runs')
    .insert({
      source_id: source_id || null,
      run_type: action,
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (runError) throw runError;

  // 4. MOCK PIPELINE LOGIC
  let result = {};
  if (action === 'discover') {
    result = { files_found_count: 4 };
  } else {
    result = { questions_extracted: 1, status: 'mocked' };
  }

  // 5. FINALIZE
  await supabaseAdmin
    .from('ingestion_pipeline_runs')
    .update({ 
      status: 'success', 
      stats: result, 
      finished_at: new Date().toISOString() 
    })
    .eq('id', run.id);

  logger.info("INGESTION_COMPLETED", "Pipeline run finished successfully");

  return new Response(JSON.stringify({ success: true, result, run_id: run.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
