import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";

Deno.serve(enterpriseEdgeHandler("ai-benchmark-pipeline", async ({ req, logger, ai, supabaseAdmin }) => {
  await requireAdmin(req);
  
  const modelsToTest = [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro"
  ];

  const testSuites = [
    {
      name: "Medical Reasoning",
      taskType: "reasoning",
      prompt: "Um paciente de 45 anos apresenta febre, tosse produtiva e dispneia. RX de tórax mostra consolidado em lobo inferior direito. Qual o tratamento empírico inicial e a justificativa fisiopatológica?"
    },
    {
      name: "JSON Stability",
      taskType: "parsing",
      prompt: "Extraia os dados deste paciente em formato JSON: João Silva, 30 anos, hipertenso, em uso de Losartana 50mg/dia. Histórico de asma na infância."
    }
  ];

  const results = [];

  for (const model of modelsToTest) {
    for (const suite of testSuites) {
      try {
        const startTime = Date.now();
        const response = await ai({
          model,
          taskType: suite.taskType as any,
          messages: [{ role: "user", content: suite.prompt }],
          max_tokens: 1000
        }, { skipQualityLock: true }); // We want raw results for benchmarking

        const latency = Date.now() - startTime;
        const content = response.choices?.[0]?.message?.content || "";
        
        // Basic quality estimation for the benchmark
        const jsonStability = suite.name === "JSON Stability" ? (content.includes("{") ? 100 : 0) : 100;

        const benchmarkData = {
          model_name: model,
          test_suite: suite.name,
          latency_ms: latency,
          ttfb_ms: 0, // Placeholder as we use non-streaming fetch
          tokens_per_second: (response.usage?.total_tokens || 0) / (latency / 1000),
          hallucination_score: 100, // Placeholder
          medical_accuracy_score: 90, // Placeholder
          json_stability_score: jsonStability,
          cost_estimate_usd: 0, // Router logs cost to governance table
          raw_response: response
        };

        await supabaseAdmin.from("ai_model_benchmarks").insert(benchmarkData);
        results.push({ model, suite: suite.name, status: "success", latency });

      } catch (err) {
        logger.error("BENCHMARK_ERROR", `Failed test for ${model} on ${suite.name}`, { error: err.message });
        results.push({ model, suite: suite.name, status: "failed", error: err.message });
      }
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    results,
    timestamp: new Date().toISOString()
  }), { headers: { "Content-Type": "application/json" } });
}));
