
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

Deno.serve(enterpriseEdgeHandler("ai-pipeline-test", async ({ logger, supabaseAdmin }) => {
  logger.info("SMOKE_TEST_START", "Initiating pipeline diagnostics");

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: AI Generation (Primary)
  try {
    const aiResp = await callAi({
      model: ALLOWED_MODELS.generation,
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 5
    }, logger, supabaseAdmin);
    
    results.tests.push({ 
      name: "AI_Generation_Primary", 
      ok: !!aiResp, 
      status: "healthy",
      model: ALLOWED_MODELS.generation
    });
  } catch (err: any) {
    results.tests.push({ name: "AI_Generation_Primary", ok: false, error: err.message });
  }

  // Test 2: AI Reasoning (Advanced)
  try {
    const aiResp = await callAi({
      model: ALLOWED_MODELS.reasoning,
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 5
    }, logger, supabaseAdmin);
    
    results.tests.push({ 
      name: "AI_Reasoning_HighPerf", 
      ok: !!aiResp, 
      status: "healthy",
      model: ALLOWED_MODELS.reasoning
    });
  } catch (err: any) {
    results.tests.push({ name: "AI_Reasoning_HighPerf", ok: false, error: err.message });
  }

  // Test 3: Database
  try {
    const { count, error } = await supabaseAdmin.from("questions_bank").select("id", { count: "exact", head: true }).limit(1);
    results.tests.push({ name: "Database_Connectivity", ok: !error, count, status: error ? "degraded" : "healthy" });
  } catch (err: any) {
    results.tests.push({ name: "Database_Connectivity", ok: false, error: err.message });
  }

  const allOk = results.tests.every((t: any) => t.ok);
  logger.info("SMOKE_TEST_FINISHED", allOk ? "System healthy" : "Anomalies detected", { results });

  return new Response(JSON.stringify(results), {
    status: allOk ? 200 : 500,
    headers: { "Content-Type": "application/json" }
  });
}));
