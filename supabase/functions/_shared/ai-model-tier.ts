/**
 * Model tiering: select the right model based on task complexity.
 * 
 * TIER 1 — LITE: classification, structure, filters, simple lookups
 * TIER 2 — STANDARD: explanations, flashcards, question generation  
 * TIER 3 — PRO: complex clinical narratives, chronicles, deep reasoning
 */

export type ModelTier = "lite" | "standard" | "pro";

const TIER_MODELS: Record<ModelTier, string> = {
  lite: "openai/gpt-5-mini",
  standard: "openai/gpt-5-mini",
  pro: "openai/gpt-5", // Focado em alta qualidade clínica
};

/** Get the model for a given tier */
export function getModelForTier(tier: ModelTier): string {
  return TIER_MODELS[tier];
}

/** Get the recommended tier for a function/task type */
export function getRecommendedTier(taskType: string): ModelTier {
  const LITE_TASKS = new Set([
    "classification",
    "filter",
    "structure",
    "validate",
    "deduplicate",
    "medical-term-lookup",
    "schedule-review",
    "benchmark-percentile",
    "calculate-rankings",
    "replan-overdue-tasks",
  ]);

  const PRO_TASKS = new Set([
    "medical-chronicle",
    "generate-chronicle-osce",
    "clinical-simulation",
    "anamnesis-trainer",
    "practical-exam",
    "interview-simulator",
    "discursive-questions",
    "chatgpt-agent",
  ]);

  if (LITE_TASKS.has(taskType)) return "lite";
  if (PRO_TASKS.has(taskType)) return "pro";
  return "standard";
}

/** Get recommended max tokens by tier */
export function getMaxTokensForTier(tier: ModelTier): number {
  switch (tier) {
    case "lite": return 4096;
    case "standard": return 8192;
    case "pro": return 16384;
  }
}

/**
 * In-flight request deduplication.
 * Prevents identical concurrent AI calls.
 */
const inflightRequests = new Map<string, Promise<any>>();

export async function deduplicatedCall<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) {
    console.log(`[Dedup] Reusing in-flight request for key: ${key}`);
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, promise);
  return promise;
}
