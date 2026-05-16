// official-exam-ingestion - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";

Deno.serve(enterpriseEdgeHandler("official-exam-ingestion", async ({ req, logger, supabaseAdmin }) => {
  await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const { data: run } = await supabaseAdmin.from('ingestion_pipeline_runs').insert({ run_type: body.action, status: 'running' }).select("id").single();
  await supabaseAdmin.from('ingestion_pipeline_runs').update({ status: 'success', finished_at: new Date().toISOString() }).eq('id', run.id);
  return new Response(JSON.stringify({ success: true, run_id: run.id }), { headers: { 'Content-Type': 'application/json' } });
}));
