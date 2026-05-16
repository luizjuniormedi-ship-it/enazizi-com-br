// ai-pipeline-test - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: End-to-end smoke testing for AI and Database infrastructure.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

export default enterpriseEdgeHandler("ai-pipeline-test", async ({ logger, supabaseAdmin }: EnterpriseContext) => {
  logger.info("SMOKE_TEST_START", "Initiating pipeline diagnostics");

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: AI Generation
  try {
    const aiResp = await callAi({
      model: ALLOWED_MODELS.generation,
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 10
    }, logger, supabaseAdmin);
    
    results.tests.push({ name: "AI_Generation", ok: !!aiResp, status: "healthy" });
  } catch (err) {
    results.tests.push({ name: "AI_Generation", ok: false, error: err.message });
  }

  // Test 2: Database
  try {
    const { count, error } = await supabaseAdmin.from("questions_bank").select("id", { count: "exact", head: true }).limit(1);
    results.tests.push({ name: "Database_Connectivity", ok: !error, count, status: error ? "degraded" : "healthy" });
  } catch (err) {
    results.tests.push({ name: "Database_Connectivity", ok: false, error: err.message });
  }

  const allOk = results.tests.every((t: any) => t.ok);
  logger.info("SMOKE_TEST_FINISHED", allOk ? "System healthy" : "Anomalies detected", { results });

  return new Response(JSON.stringify(results), {
    status: allOk ? 200 : 500,
    headers: { "Content-Type": "application/json" }
  });
});
