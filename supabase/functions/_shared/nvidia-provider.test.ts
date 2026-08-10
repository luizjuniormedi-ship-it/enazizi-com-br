import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildNvidiaRuntimeLog,
  callNvidia,
  getNvidiaBaseUrl,
  isNvidiaCircuitOpen,
  isNvidiaEnabled,
  NVIDIA_BREAKER_THRESHOLD,
  NVIDIA_DEFAULT_BASE_URL,
  NvidiaProviderError,
  recordNvidiaFailure,
  recordNvidiaSuccess,
  resetNvidiaBreaker,
} from "./nvidia-provider.ts";

Deno.test("baseUrl default e normalização", () => {
  assertEquals(getNvidiaBaseUrl(), NVIDIA_DEFAULT_BASE_URL);
  assertEquals(getNvidiaBaseUrl("https://x.dev/v1/"), "https://x.dev/v1");
});

Deno.test("provider desabilitado sem secret", () => {
  assertEquals(isNvidiaEnabled(), Deno.env.get("NVIDIA_API_KEY") ? true : false);
  assertEquals(isNvidiaEnabled("   "), false);
  assertEquals(isNvidiaEnabled("sk-test"), true);
});

Deno.test("callNvidia falha com not_configured quando secret ausente", async () => {
  if (Deno.env.get("NVIDIA_API_KEY")) return;
  try {
    await callNvidia({ model: "m", messages: [{ role: "user", content: "x" }] });
    assert(false, "deveria lançar");
  } catch (err) {
    assertEquals((err as NvidiaProviderError).code, "not_configured");
  }
});

Deno.test("circuit breaker abre em 3 falhas e é isolado por modelo", () => {
  resetNvidiaBreaker();
  const m = "meta/llama-3.1-8b-instruct";
  for (let i = 0; i < NVIDIA_BREAKER_THRESHOLD - 1; i++) recordNvidiaFailure(m);
  assertEquals(isNvidiaCircuitOpen(m), false);
  recordNvidiaFailure(m);
  assertEquals(isNvidiaCircuitOpen(m), true);
  assertEquals(isNvidiaCircuitOpen("outro/modelo"), false);
  resetNvidiaBreaker();
});

Deno.test("circuit breaker fecha após cooldown de 5 min", () => {
  resetNvidiaBreaker();
  const m = "meta/llama-3.3-70b-instruct";
  const t0 = 1_000_000;
  for (let i = 0; i < NVIDIA_BREAKER_THRESHOLD; i++) recordNvidiaFailure(m, t0);
  assertEquals(isNvidiaCircuitOpen(m, t0 + 1000), true);
  assertEquals(isNvidiaCircuitOpen(m, t0 + 5 * 60 * 1000 + 1), false);
  resetNvidiaBreaker();
});

Deno.test("sucesso reseta contador de falhas", () => {
  resetNvidiaBreaker();
  const m = "x/y";
  recordNvidiaFailure(m);
  recordNvidiaFailure(m);
  recordNvidiaSuccess(m);
  recordNvidiaFailure(m);
  assertEquals(isNvidiaCircuitOpen(m), false);
  resetNvidiaBreaker();
});

Deno.test("telemetria compatível com ai_runtime_logs", () => {
  const row = buildNvidiaRuntimeLog({
    taskType: "healthcheck",
    model: "meta/llama-3.1-8b-instruct",
    success: true,
    latencyMs: 123.7,
    inputTokens: 5,
    outputTokens: 8,
  });
  assertEquals(row.provider, "nvidia");
  assertEquals(row.success, true);
  assertEquals(row.latency_ms, 124);
  assertEquals(row.fallback_used, false);
  assertEquals(row.error_code, null);
  assert(Array.isArray(row.attempts));
});
