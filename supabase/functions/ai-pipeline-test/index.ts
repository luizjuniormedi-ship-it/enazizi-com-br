import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { AI_MODELS } from "../_shared/ai-models.ts";
import { logPipelineAlert } from "../_shared/pipeline-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log("[AI_PIPELINE_TEST] Starting smoke test...");
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    // Test 1: Simple Generation
    const genStart = Date.now();
    const genResp = await aiFetch({
      model: AI_MODELS.generation,
      messages: [
        { role: "system", content: "Gere uma única questão médica simples sobre Hipertensão no formato JSON." },
        { role: "user", content: "Gere 1 questão." }
      ],
      response_format: { type: "json_object" }
    });
    
    const genLatency = Date.now() - genStart;
    let genOk = false;
    let questionsFound = 0;

    if (genResp.ok) {
      const data = await genResp.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = parseAiJson(content);
      questionsFound = (parsed.questions || []).length || (parsed.statement || parsed.question ? 1 : 0);
      genOk = questionsFound > 0;
    }

    results.tests.push({
      name: "Generation Smoke Test",
      ok: genOk,
      latency: genLatency,
      questions_found: questionsFound,
      status: genResp.status
    });

    if (!genOk) {
      await logPipelineAlert({
        source: "ai-pipeline-test",
        message: "Generation Smoke Test Failed",
        severity: "critical",
        model_used: AI_MODELS.generation,
        http_status: genResp.status,
        metadata: { results }
      });
    }

    // Test 2: Database Connectivity
    const { count, error: dbErr } = await supabase.from("questions_bank").select("id", { count: "exact", head: true }).limit(1);
    results.tests.push({
      name: "Database Smoke Test",
      ok: !dbErr,
      count: count || 0,
      error: dbErr?.message
    });

    return new Response(JSON.stringify(results), {
      status: results.tests.every((t: any) => t.ok) ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[AI_PIPELINE_TEST] Fatal error:", err);
    await logPipelineAlert({
      source: "ai-pipeline-test",
      message: "Fatal error in smoke test",
      error_stack: err.stack,
      severity: "critical"
    });
    return new Response(JSON.stringify({ error: err.message, results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
