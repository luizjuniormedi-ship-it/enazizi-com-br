import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { selectAIModel } from "./ai-runtime-orchestrator.ts";

Deno.test("tutor_chat usa NVIDIA e Cerebras antes dos fallbacks preservados", () => {
  const selection = selectAIModel({
    taskType: "tutor_chat",
    complexity: "high",
    budgetMode: "premium",
  });

  assertEquals(selection.provider, "nvidia");
  assertEquals(selection.fallbackChain.map(({ provider }) => provider), [
    "cerebras",
    "lovable-ai",
    "lovable-ai",
  ]);
});

Deno.test("question_generation mantém o mesmo contrato NVIDIA e Cerebras", () => {
  const selection = selectAIModel({
    taskType: "question_generation",
    complexity: "high",
    budgetMode: "premium",
  });

  assertEquals(selection.provider, "nvidia");
  assertEquals(selection.fallbackChain[0]?.provider, "cerebras");
});
