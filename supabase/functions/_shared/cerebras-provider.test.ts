import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { 
  isCerebrasCircuitOpen, 
  recordCerebrasFailure, 
  recordCerebrasSuccess, 
  resetCerebrasBreaker,
  buildCerebrasRuntimeLog
} from "./cerebras-provider.ts";

Deno.test("Cerebras Circuit Breaker - Logic", () => {
  const model = "test-model";
  resetCerebrasBreaker();
  
  assertEquals(isCerebrasCircuitOpen(model), false, "Should be closed initially");
  
  recordCerebrasFailure(model);
  recordCerebrasFailure(model);
  assertEquals(isCerebrasCircuitOpen(model), false, "Should be closed after 2 failures");
  
  recordCerebrasFailure(model);
  assertEquals(isCerebrasCircuitOpen(model), true, "Should be open after 3 failures");
  
  recordCerebrasSuccess(model);
  assertEquals(isCerebrasCircuitOpen(model), false, "Should be closed after success");
});

Deno.test("Cerebras Telemetry - Payload structure", () => {
  const log = buildCerebrasRuntimeLog({
    taskType: "test",
    model: "llama-test",
    success: true,
    latencyMs: 500,
    inputTokens: 10,
    outputTokens: 20
  });
  
  assertEquals(log.provider, "cerebras");
  assertEquals(log.model, "llama-test");
  assertEquals(log.latency_ms, 500);
  assertEquals(log.input_tokens, 10);
  assertEquals(log.metadata.activation_stage, "shadow");
});
