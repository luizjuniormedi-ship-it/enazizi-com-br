// ============================================================================
// AI Runtime Orchestrator — ENAZIZI (Fase 1)
// ----------------------------------------------------------------------------
// Cérebro central de roteamento de IA. Decide modelo, executa, faz fallback
// e registra telemetria em `ai_runtime_logs`. Modelos e perfis ficam inline
// nesta fase (sem novas tabelas além de logs). Fases futuras podem mover
// para `ai_model_registry` / `prompt_profiles` sem mudar a interface pública.
//
// Interface pública:
//   - selectAIModel(input): escolhe provider/model + cadeia de fallback
//   - runAI(input): executa com fallback + log + emergency template
// ============================================================================

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_TIMEOUT_MS = 30_000;
const AI_MAX_TOKENS = 4096;
const AI_MAX_TOKENS_DEEP = 6000; // For tutor_chat high complexity & clinical_reasoning

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type AITaskType =
  | "tutor_chat"
  | "clinical_reasoning"
  | "lesson_generation"
  | "flashcard"
  | "mnemonic"
  | "question_generation"
  | "cme_script"
  | "planner"
  | "simulado_review";

export type AIComplexity = "low" | "medium" | "high";
export type AICognitiveLoad = "low" | "normal" | "high";
export type AIBudgetMode = "economy" | "balanced" | "premium";
export type AILatencyMode = "low" | "normal" | "high";

export interface AISelectInput {
  taskType: AITaskType;
  specialty?: string | null;
  topic?: string | null;
  complexity?: AIComplexity;
  cognitiveLoad?: AICognitiveLoad;
  requiresReasoning?: boolean;
  requiresReferences?: boolean;
  requiresJSON?: boolean;
  maxLatency?: AILatencyMode;
  budgetMode?: AIBudgetMode;
}

export interface ModelRef {
  provider: "lovable-ai";
  model: string;
}

export interface AISelection extends ModelRef {
  reason: string;
  fallbackChain: ModelRef[];
  promptProfile: string;
  expectedCostTier: "low" | "medium" | "high";
}

export interface AIAttempt extends ModelRef {
  success: boolean;
  status?: number;
  code?: string;
  message?: string;
  latency_ms: number;
}

export interface AIRunInput extends AISelectInput {
  messages: Array<{ role: string; content: string }>;
  userId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  emergencyTemplate?: string;
  /** When provided, log row is written via this Supabase client. */
  supabase?: any;
}

export interface AIRunResult {
  content: string;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  attempts: AIAttempt[];
  latencyMs: number;
  selection: AISelection;
  errorCode?: string;
}

// ---------------------------------------------------------------------------
// Registry inline (Fase 1)
// ---------------------------------------------------------------------------

// Modelos validados em produção via Lovable AI Gateway.
// Modelos validados em produção. Prioridade para OpenAI Direto (sem gateway).
const MODELS = {
  flash: { provider: "openai", model: "gpt-4o" } as ModelRef,
  flashStable: { provider: "openai", model: "gpt-4o" } as ModelRef,
  flashLite: { provider: "openai", model: "gpt-4o-mini" } as ModelRef,
  pro: { provider: "openai", model: "gpt-4o" } as ModelRef,
  gpt5Mini: { provider: "openai", model: "gpt-4o-mini" } as ModelRef,
  gpt5: { provider: "openai", model: "gpt-4o" } as ModelRef,
  geminiFallback: { provider: "lovable-ai", model: "google/gemini-2.5-flash" } as ModelRef,
  openaiFallback: { provider: "openai", model: "gpt-4o-mini" } as ModelRef,
};

const COST_TIER: Record<string, "low" | "medium" | "high"> = {
  "google/gemini-2.5-flash-lite": "low",
  "google/gemini-2.5-flash": "low",
  "google/gemini-2.5-pro": "medium",
  "gpt-4o-mini": "low",
  "gpt-4o": "medium",
  "openai/gpt-4o-mini": "low",
  "openai/gpt-4o": "medium",
};

// ---------------------------------------------------------------------------
// LOTE 0 — Cost catalog (USD por token). Fonte autoritativa do orchestrator.
// ---------------------------------------------------------------------------
const COST_RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o":               { input: 2.50e-6,  output: 10.00e-6 },
  "gpt-4o-mini":          { input: 0.15e-6,  output: 0.60e-6  },
  "openai/gpt-4o":        { input: 2.50e-6,  output: 10.00e-6 },
  "openai/gpt-4o-mini":   { input: 0.15e-6,  output: 0.60e-6  },
  "google/gemini-2.5-flash":      { input: 0.30e-6, output: 2.50e-6 },
  "google/gemini-2.5-flash-lite": { input: 0.10e-6, output: 0.40e-6 },
  "google/gemini-2.5-pro":        { input: 1.25e-6, output: 5.00e-6 },
};

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = COST_RATES[model] || COST_RATES[model.replace(/^openai\//, "")] || { input: 0, output: 0 };
  return (inputTokens * r.input) + (outputTokens * r.output);
}

// ---------------------------------------------------------------------------
// LOTE 0 — TaskType → feature_name registry (com fallback generic_ai_task)
// ---------------------------------------------------------------------------
const TASK_FEATURE_MAP: Record<string, string> = {
  tutor_chat:          "tutor_chat",
  clinical_reasoning:  "tutor_chat",
  lesson_generation:   "lesson_generation",
  cme_script:          "cme_script",
  flashcard:           "flashcard_generation",
  mnemonic:            "mnemonic",
  question_generation: "question_generation",
  simulado_review:     "simulado_review",
  planner:             "study_plan",
};
export function featureNameForTask(taskType: string): string {
  return TASK_FEATURE_MAP[taskType] || "generic_ai_task";
}

// Perfis de prompt (apenas marcadores nesta fase; o prompt real é montado
// pelo chamador, isto serve para telemetria + futuro lookup).
export const PROMPT_PROFILES = {
  feynman_light: "feynman_light",
  feynman_full: "feynman_full",
  clinical_reasoning: "clinical_reasoning",
  pharmacology_deep: "pharmacology_deep",
  preventive_sus: "preventive_sus",
  exam_mode: "exam_mode",
  fast_review: "fast_review",
  lesson_builder: "lesson_builder",
  mnemonic_builder: "mnemonic_builder",
  question_explainer: "question_explainer",
} as const;

// ---------------------------------------------------------------------------
// selectAIModel
// ---------------------------------------------------------------------------

export function selectAIModel(input: AISelectInput): AISelection {
  const budget = input.budgetMode || "balanced";
  const cognitiveLoad = input.cognitiveLoad || "normal";
  const complexity = input.complexity || "medium";
  const specialty = (input.specialty || "").toLowerCase();

  // ---- Aluno cansado: reduz profundidade independentemente da tarefa ----
  if (cognitiveLoad === "high") {
    return wrap(
      MODELS.flashLite,
      [MODELS.flash, MODELS.geminiFallback],
      "cognitive_load_high → modelo rápido + Feynman light",
      PROMPT_PROFILES.feynman_light,
    );
  }

  // ---- Modo economy força modelo barato ----
  if (budget === "economy") {
    return wrap(
      MODELS.flashLite,
      [MODELS.flash, MODELS.geminiFallback],
      "budget_mode=economy",
      PROMPT_PROFILES.fast_review,
    );
  }

  switch (input.taskType) {
    case "tutor_chat": {
      // Pergunta simples → modelo mais barato
      if (complexity === "low") {
        return wrap(
          MODELS.flashLite,
          [MODELS.flash, MODELS.geminiFallback],
          "tutor_chat low complexity → flash mini",
          PROMPT_PROFILES.fast_review,
        );
      }

      // Farmacologia → precisão
      if (/farmaco|farmacologia|drug|posolog/i.test(specialty)) {
        const primary = MODELS.gpt5;
        return wrap(
          primary,
          [MODELS.flash, MODELS.geminiFallback],
          "tutor_chat farmacologia → reasoning preciso",
          PROMPT_PROFILES.pharmacology_deep,
        );
      }

      // Preventiva / SUS
      if (/preventiv|sus|saúde\s+coletiva|saude\s+coletiva|epidemio/i.test(specialty)) {
        return wrap(
          MODELS.flash,
          [MODELS.flashLite, MODELS.geminiFallback],
          "tutor_chat preventiva/SUS → openai/gpt-4o",
          PROMPT_PROFILES.preventive_sus,
        );
      }

      // Raciocínio clínico profundo
      if (input.requiresReasoning || complexity === "high") {
        const primary = MODELS.gpt5;
        return wrap(
          primary,
          [MODELS.flash, MODELS.geminiFallback],
          "tutor_chat reasoning profundo",
          PROMPT_PROFILES.clinical_reasoning,
        );
      }

      // Default tutor
      return wrap(
        MODELS.flash,
        [MODELS.flashLite, MODELS.geminiFallback],
        "tutor_chat default balanced",
        PROMPT_PROFILES.feynman_full,
      );
    }

    case "lesson_generation":
    case "cme_script": {
      const primary = MODELS.flash;
      return wrap(
        primary,
        [MODELS.flashLite, MODELS.geminiFallback],
        "lesson/cme → equilibrado",
        PROMPT_PROFILES.lesson_builder,
      );
    }

    case "mnemonic":
      return wrap(
        MODELS.flash,
        [MODELS.flashLite, MODELS.geminiFallback],
        "mnemonic → rápido + auditor",
        PROMPT_PROFILES.mnemonic_builder,
      );

    case "flashcard":
      return wrap(
        MODELS.flashLite,
        [MODELS.flash, MODELS.geminiFallback],
        "flashcard → barato",
        PROMPT_PROFILES.fast_review,
      );

    case "question_generation":
    case "simulado_review": {
      const primary = MODELS.flash;
      return wrap(
        primary,
        [MODELS.flashLite, MODELS.geminiFallback],
        "questão/simulado → reasoning",
        PROMPT_PROFILES.question_explainer,
      );
    }

    case "planner":
      return wrap(
        MODELS.flash,
        [MODELS.flashLite, MODELS.geminiFallback],
        "planner → reasoning leve",
        PROMPT_PROFILES.clinical_reasoning,
      );

    default:
      return wrap(
        MODELS.flash,
        [MODELS.geminiFallback],
        "fallback default → flash",
        PROMPT_PROFILES.fast_review,
      );
  }
}

function wrap(
  primary: ModelRef,
  rest: ModelRef[],
  reason: string,
  promptProfile: string,
): AISelection {
  // Garante que o primário não se repita na cadeia de fallback
  const dedup: ModelRef[] = [];
  const seen = new Set<string>([primary.model]);
  for (const m of rest) {
    if (!seen.has(m.model)) {
      dedup.push(m);
      seen.add(m.model);
    }
  }
  return {
    ...primary,
    reason,
    fallbackChain: dedup,
    promptProfile,
    expectedCostTier: COST_TIER[primary.model] || "medium",
  };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function getAIKey(provider: string): string {
  if (provider === "openai") {
    return Deno.env.get("OPENAI_API_KEY") || "";
  }
  return (
    Deno.env.get("LOVABLE_API_KEY") ||
    Deno.env.get("AI_GATEWAY_API_KEY") ||
    Deno.env.get("LOVABLE_AI_GATEWAY_KEY") ||
    ""
  );
}

function extractProviderError(status: number | undefined, bodyText: string, err?: unknown) {
  const fallbackMessage = err instanceof Error ? err.message : bodyText || "Provider unavailable";
  let code = status ? `HTTP_${status}` : "AI_PROVIDER_ERROR";
  let message = fallbackMessage;

  try {
    const parsed = JSON.parse(bodyText);
    const providerError = parsed?.error || parsed;
    code = providerError?.code || providerError?.type || code;
    message = providerError?.message || parsed?.message || message;
  } catch {
    if (status === 401 || status === 403) code = "AI_AUTH_ERROR";
    else if (status === 402) code = "AI_QUOTA_EXHAUSTED";
    else if (status === 404) code = "AI_MODEL_NOT_FOUND";
    else if (status === 429) code = "AI_RATE_LIMITED";
    else if (status && status >= 500) code = "AI_PROVIDER_UNAVAILABLE";
  }

  if (err instanceof DOMException && err.name === "AbortError") {
    code = "TIMEOUT";
    message = "AI provider request timed out";
  }

  return { code, message: String(message).slice(0, 300) };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOnce(
  ref: ModelRef,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = AI_MAX_TOKENS,
): Promise<{ content?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; attempt: AIAttempt }> {
  const start = Date.now();
  try {
    const isOpenAI5 = ref.model.includes("google/gemini-2.5-pro") || /^openai\/o[13]/.test(ref.model) || /^o[13]/.test(ref.model) || ref.model.includes("gpt-5");
    const tokenField = isOpenAI5 ? "max_completion_tokens" : "max_tokens";
    const body: Record<string, unknown> = {
      model: ref.model,
      messages,
      [tokenField]: maxTokens,
    };
    const url = ref.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : AI_GATEWAY_URL;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      AI_TIMEOUT_MS,
    );
    const latency_ms = Date.now() - start;
    const responseText = await res.text();

    if (!res.ok) {
      const e = extractProviderError(res.status, responseText);
      return { attempt: { ...ref, success: false, status: res.status, ...e, latency_ms } };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return {
        attempt: {
          ...ref,
          success: false,
          status: res.status,
          code: "AI_INVALID_JSON",
          message: "AI provider returned invalid JSON",
          latency_ms,
        },
      };
    }
    const content = parsed?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return {
        attempt: {
          ...ref,
          success: false,
          status: res.status,
          code: "AI_EMPTY_RESPONSE",
          message: "AI provider returned no assistant content",
          latency_ms,
        },
      };
    }
    return {
      content,
      usage: parsed?.usage,
      attempt: { ...ref, success: true, status: res.status, latency_ms },
    };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const e = extractProviderError(undefined, "", err);
    return { attempt: { ...ref, success: false, ...e, latency_ms } };
  }
}

function defaultEmergency(input: AIRunInput): string {
  const focus = input.topic || "o tema solicitado";
  return `Não consegui acessar o modelo de IA agora, mas posso estruturar seu estudo sobre ${focus}.

Introdução: vamos organizar o tema em uma sequência segura.

Explicação leiga: pense no problema como uma cadeia de causa, mecanismo, manifestação clínica e conduta.

Técnica: identifique definição, fisiopatologia, quadro clínico, diagnóstico, tratamento e pegadinhas.

Active recall:
1. Qual é a definição central?
2. Qual achado clínico muda a conduta?
3. Qual erro comum a banca explora?

Próxima ação: tente novamente em instantes para um aprofundamento completo.`;
}

// Modelos com status "ruim" e checagem recente são pulados.
// Se a checagem é antiga (> 15 min), assume saudável.
const HEALTH_BAD_STATUS = new Set(["down", "quota_exhausted", "model_not_found"]);
const HEALTH_FRESH_MS = 15 * 60 * 1000;

async function filterByHealth(supabase: any | undefined, chain: ModelRef[]): Promise<ModelRef[]> {
  if (!supabase || chain.length === 0) return chain;
  try {
    const models = chain.map((c) => c.model);
    const { data, error } = await supabase
      .from("ai_provider_health")
      .select("provider, model, status, checked_at")
      .in("model", models);
    if (error || !data) return chain;

    const now = Date.now();
    const badKeys = new Set<string>();
    for (const row of data) {
      if (!HEALTH_BAD_STATUS.has(row.status)) continue;
      const ts = row.checked_at ? new Date(row.checked_at).getTime() : 0;
      if (now - ts <= HEALTH_FRESH_MS) {
        badKeys.add(`${row.provider}::${row.model}`);
      }
    }
    if (badKeys.size === 0) return chain;
    const filtered = chain.filter((c) => !badKeys.has(`${c.provider}::${c.model}`));
    if (filtered.length === 0) {
      console.warn("[AI_RUNTIME_HEALTH] All chain models flagged unhealthy — proceeding anyway", { chain });
      return chain;
    }
    if (filtered.length !== chain.length) {
      console.log("[AI_RUNTIME_HEALTH] Skipping unhealthy models", { skipped: [...badKeys] });
    }
    return filtered;
  } catch (err) {
    console.warn("[AI_RUNTIME_HEALTH_LOOKUP_FAILED]", err instanceof Error ? err.message : String(err));
    return chain;
  }
}

async function logRun(
  supabase: any | undefined,
  input: AIRunInput,
  selection: AISelection,
  result: Omit<AIRunResult, "selection">,
) {
  if (!supabase) return;
  try {
    const lastAttempt = result.attempts.at(-1);
    const successAttempt = result.attempts.find((a) => a.success);
    const used = successAttempt || lastAttempt;
    await supabase.from("ai_runtime_logs").insert({
      user_id: input.userId || null,
      session_id: input.sessionId || null,
      request_id: input.requestId || null,
      task_type: input.taskType,
      specialty: input.specialty || null,
      topic: input.topic || null,
      provider: result.provider,
      model: result.model,
      prompt_profile: selection.promptProfile,
      fallback_used: result.fallbackUsed,
      fallback_chain: selection.fallbackChain,
      attempts: result.attempts,
      latency_ms: result.latencyMs,
      input_tokens: null,
      output_tokens: null,
      estimated_cost: null,
      quality_score: null,
      error_code: result.errorCode || (result.success ? null : lastAttempt?.code) || null,
      success: result.success,
      budget_mode: input.budgetMode || "balanced",
      metadata: {
        selection_reason: selection.reason,
        expected_cost_tier: selection.expectedCostTier,
        last_status: used?.status || null,
      },
    });
  } catch (err) {
    console.warn("[AI_RUNTIME_LOG_FAILED]", err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// LOTE 0 — Cooldowns / Failures / Cost recorders
// ---------------------------------------------------------------------------

const COOLDOWN_DEFAULT_MS = 60_000;
const COOLDOWN_TRIGGER_CODES = new Set<string | undefined>([
  "AI_RATE_LIMITED", "AI_QUOTA_EXHAUSTED", "AI_PROVIDER_UNAVAILABLE", "TIMEOUT",
]);
const COOLDOWN_TRIGGER_STATUSES = new Set<number | undefined>([429, 402, 502, 503, 504]);

async function getActiveCooldowns(supabase: any | undefined): Promise<Set<string>> {
  if (!supabase) return new Set();
  try {
    const { data, error } = await supabase
      .from("ai_provider_cooldowns")
      .select("provider, model")
      .gt("cooldown_until", new Date().toISOString());
    if (error || !data) return new Set();
    return new Set(data.map((r: any) => `${r.provider}::${r.model}`));
  } catch (err) {
    console.warn("[COOLDOWN_LOOKUP_FAILED]", err instanceof Error ? err.message : String(err));
    return new Set();
  }
}

async function triggerCooldown(
  supabase: any | undefined,
  provider: string,
  model: string,
  reason: string,
  ms: number = COOLDOWN_DEFAULT_MS,
) {
  if (!supabase) return;
  try {
    const cooldown_until = new Date(Date.now() + ms).toISOString();
    await supabase.from("ai_provider_cooldowns").insert({ provider, model, reason, cooldown_until });
    console.warn(`[COOLDOWN_TRIGGERED] ${provider}/${model} until=${cooldown_until} reason=${reason}`);
  } catch (err) {
    console.warn("[COOLDOWN_INSERT_FAILED]", err instanceof Error ? err.message : String(err));
  }
}

async function recordProviderFailure(
  supabase: any | undefined,
  attempt: AIAttempt,
  fallbackModel: string | undefined,
  retryAttempt: number,
) {
  if (!supabase) return;
  const errorCode = attempt.code || (attempt.status ? `HTTP_${attempt.status}` : "UNKNOWN");
  try {
    await supabase.from("ai_provider_failures").insert({
      provider: attempt.provider,
      model: attempt.model,
      error_code: errorCode,
      error_message: attempt.message || null,
      retry_attempt: retryAttempt,
      fallback_model: fallbackModel || null,
    });
    console.warn(`[PROVIDER_FAILURE] ${attempt.provider}/${attempt.model} code=${errorCode} status=${attempt.status ?? "-"} retry=${retryAttempt}`);
  } catch (err) {
    console.warn("[PROVIDER_FAILURE_INSERT_FAILED]", err instanceof Error ? err.message : String(err));
  }

  // Cooldown automático em condições de saturação
  if (
    COOLDOWN_TRIGGER_CODES.has(attempt.code) ||
    COOLDOWN_TRIGGER_STATUSES.has(attempt.status)
  ) {
    await triggerCooldown(supabase, attempt.provider, attempt.model, errorCode);
  }
}

async function recordCostMetric(
  supabase: any | undefined,
  input: AIRunInput,
  provider: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  latencyMs: number,
) {
  if (!supabase) return;
  const tokens_input = usage?.prompt_tokens ?? 0;
  const tokens_output = usage?.completion_tokens ?? 0;
  const cost_usd = calculateCostUsd(model, tokens_input, tokens_output);
  try {
    await supabase.from("ai_cost_metrics").insert({
      feature_name: featureNameForTask(input.taskType),
      model_name: model,
      tokens_input,
      tokens_output,
      cost_usd,
      user_id: input.userId || null,
      metadata: {
        provider,
        task_type: input.taskType,
        specialty: input.specialty || null,
        topic: input.topic || null,
        latency_ms: latencyMs,
        request_id: input.requestId || null,
        session_id: input.sessionId || null,
        budget_mode: input.budgetMode || "balanced",
      },
    });
    console.log(`[AI_COST_RECORDED] ${featureNameForTask(input.taskType)}/${model} in=${tokens_input} out=${tokens_output} cost=$${cost_usd.toFixed(6)}`);
  } catch (err) {
    console.warn("[AI_COST_INSERT_FAILED]", err instanceof Error ? err.message : String(err));
  }
}

export async function runAI(input: AIRunInput): Promise<AIRunResult> {
  const selection = selectAIModel(input);
  const totalStart = Date.now();
  const attempts: AIAttempt[] = [];
  const reqTag = input.requestId || "-";

  console.log(`[AI_RUNTIME_START] req=${reqTag} task=${input.taskType} model=${selection.model} profile=${selection.promptProfile}`);

  const fullChain: ModelRef[] = [
    { provider: selection.provider, model: selection.model },
    ...selection.fallbackChain,
  ];

  // If primary provider is lovable-ai and we have OpenAI key, ensure OpenAI is tried first
  const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
  if (hasOpenAI && selection.provider === "lovable-ai") {
    const modelClean = selection.model.replace("openai/", "");
    if (!fullChain.some(c => c.provider === "openai" && c.model === modelClean)) {
      fullChain.unshift({ provider: "openai", model: modelClean });
    }
  }

  // Health-aware filtering: pula modelos com falha recente conhecida.
  const healthChain = await filterByHealth(input.supabase, fullChain);

  // LOTE 0 — Cooldown-aware filtering (circuit breaker leve)
  const cooldownSet = await getActiveCooldowns(input.supabase);
  const chain: ModelRef[] = [];
  for (const ref of healthChain) {
    const key = `${ref.provider}::${ref.model}`;
    if (cooldownSet.has(key)) {
      console.warn(`[CIRCUIT_SKIP] req=${reqTag} provider=${ref.provider} model=${ref.model}`);
      attempts.push({ ...ref, success: false, code: "CIRCUIT_SKIP", message: "Provider in active cooldown", latency_ms: 0 });
      continue;
    }
    chain.push(ref);
  }
  if (chain.length === 0) {
    console.warn(`[AI_RUNTIME_FAIL] req=${reqTag} reason=ALL_PROVIDERS_IN_COOLDOWN`);
    chain.push(...healthChain); // fallback: tenta de qualquer forma
  }

  for (let i = 0; i < chain.length; i++) {
    const ref = chain[i];
    const needsDeep = (input.taskType === "tutor_chat" && input.complexity === "high") ||
                      input.taskType === "clinical_reasoning" ||
                      input.taskType === "simulado_review";
    const maxTokens = needsDeep ? AI_MAX_TOKENS_DEEP : AI_MAX_TOKENS;
    const apiKey = getAIKey(ref.provider);

    if (!apiKey) {
      const att: AIAttempt = { ...ref, success: false, code: "AI_AUTH_ERROR", message: `Missing key for provider ${ref.provider}`, latency_ms: 0 };
      attempts.push(att);
      await recordProviderFailure(input.supabase, att, chain[i + 1]?.model, i);
      continue;
    }

    const r = await callOnce(ref, apiKey, input.messages, maxTokens);
    attempts.push(r.attempt);

    if (r.attempt.success && r.content) {
      const latencyMs = Date.now() - totalStart;
      const result: AIRunResult = {
        content: r.content,
        provider: ref.provider,
        model: ref.model,
        fallbackUsed: i > 0,
        attempts,
        latencyMs,
        selection,
      };
      const provider_fallback = i > 0 && ref.provider === "openai" ? "openai" : undefined;
      await logRun(input.supabase, input, selection, { ...result, success: true, metadata: { ...selection, provider_fallback } } as any);
      // LOTE 0 — cost metric on success
      await recordCostMetric(input.supabase, input, ref.provider, ref.model, r.usage, latencyMs);
      console.log(`[AI_RUNTIME_SUCCESS] req=${reqTag} task=${input.taskType} provider=${ref.provider} model=${ref.model} latency=${latencyMs}ms fallback=${i > 0}`);
      return result;
    }

    // failed attempt — record + maybe cooldown
    await recordProviderFailure(input.supabase, r.attempt, chain[i + 1]?.model, i);
  }

  // Todos falharam
  const lastCode = attempts.at(-1)?.code || "AI_PROVIDER_UNAVAILABLE";
  const result: AIRunResult = {
    content: input.emergencyTemplate || defaultEmergency(input),
    provider: "template",
    model: "emergency_template_response",
    fallbackUsed: true,
    attempts,
    latencyMs: Date.now() - totalStart,
    selection,
    errorCode: lastCode,
  };
  await logRun(input.supabase, input, selection, { ...result, success: false } as any);
  console.warn(`[AI_RUNTIME_FAIL] req=${reqTag} task=${input.taskType} lastCode=${lastCode} attempts=${attempts.length}`);
  return result;
}

// ---------------------------------------------------------------------------
// LOTE 0 — runAIStream
// ---------------------------------------------------------------------------
// SSE passthrough com telemetria final (ai_runtime_logs + ai_cost_metrics).
// Retorna { stream, done }. O caller propaga `stream` para o cliente; `done`
// resolve com o conteúdo final + telemetria após o término do upstream.
// ---------------------------------------------------------------------------

export interface AIStreamResult {
  stream: ReadableStream<Uint8Array>;
  done: Promise<{
    content: string;
    provider: string;
    model: string;
    latencyMs: number;
    fallbackUsed: boolean;
    attempts: AIAttempt[];
    success: boolean;
    errorCode?: string;
  }>;
}

async function callOnceStream(
  ref: ModelRef,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<{ ok: true; response: Response; attempt: AIAttempt } | { ok: false; attempt: AIAttempt }> {
  const start = Date.now();
  try {
    const isOpenAI5 = ref.model.includes("google/gemini-2.5-pro") || /^openai\/o[13]/.test(ref.model) || /^o[13]/.test(ref.model) || ref.model.includes("gpt-5");
    const tokenField = isOpenAI5 ? "max_completion_tokens" : "max_tokens";
    const body: Record<string, unknown> = {
      model: ref.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      [tokenField]: maxTokens,
    };
    const url = ref.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : AI_GATEWAY_URL;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      AI_TIMEOUT_MS,
    );
    const latency_ms = Date.now() - start;
    if (!res.ok || !res.body) {
      const text = res.body ? await res.text() : "";
      const e = extractProviderError(res.status, text);
      return { ok: false, attempt: { ...ref, success: false, status: res.status, ...e, latency_ms } };
    }
    return { ok: true, response: res, attempt: { ...ref, success: true, status: res.status, latency_ms } };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const e = extractProviderError(undefined, "", err);
    return { ok: false, attempt: { ...ref, success: false, ...e, latency_ms } };
  }
}

export async function runAIStream(input: AIRunInput): Promise<AIStreamResult> {
  const selection = selectAIModel(input);
  const totalStart = Date.now();
  const attempts: AIAttempt[] = [];
  const reqTag = input.requestId || "-";

  console.log(`[STREAM_START] req=${reqTag} task=${input.taskType} model=${selection.model}`);

  const fullChain: ModelRef[] = [
    { provider: selection.provider, model: selection.model },
    ...selection.fallbackChain,
  ];
  const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
  if (hasOpenAI && selection.provider === "lovable-ai") {
    const modelClean = selection.model.replace("openai/", "");
    if (!fullChain.some(c => c.provider === "openai" && c.model === modelClean)) {
      fullChain.unshift({ provider: "openai", model: modelClean });
    }
  }
  const healthChain = await filterByHealth(input.supabase, fullChain);
  const cooldownSet = await getActiveCooldowns(input.supabase);
  const chain: ModelRef[] = [];
  for (const ref of healthChain) {
    const key = `${ref.provider}::${ref.model}`;
    if (cooldownSet.has(key)) {
      console.warn(`[CIRCUIT_SKIP] req=${reqTag} provider=${ref.provider} model=${ref.model}`);
      attempts.push({ ...ref, success: false, code: "CIRCUIT_SKIP", message: "Provider in active cooldown", latency_ms: 0 });
      continue;
    }
    chain.push(ref);
  }
  if (chain.length === 0) chain.push(...healthChain);

  const needsDeep = (input.taskType === "tutor_chat" && input.complexity === "high") ||
                    input.taskType === "clinical_reasoning";
  const maxTokens = needsDeep ? AI_MAX_TOKENS_DEEP : AI_MAX_TOKENS;

  // Tenta cada provider até obter um stream válido (apenas a 1ª resposta abre stream)
  let opened: { response: Response; ref: ModelRef; idx: number } | null = null;
  for (let i = 0; i < chain.length; i++) {
    const ref = chain[i];
    const apiKey = getAIKey(ref.provider);
    if (!apiKey) {
      const att: AIAttempt = { ...ref, success: false, code: "AI_AUTH_ERROR", message: `Missing key for provider ${ref.provider}`, latency_ms: 0 };
      attempts.push(att);
      await recordProviderFailure(input.supabase, att, chain[i + 1]?.model, i);
      continue;
    }
    const r = await callOnceStream(ref, apiKey, input.messages, maxTokens);
    attempts.push(r.attempt);
    if (r.ok) {
      opened = { response: r.response, ref, idx: i };
      break;
    }
    await recordProviderFailure(input.supabase, r.attempt, chain[i + 1]?.model, i);
  }

  if (!opened) {
    const lastCode = attempts.at(-1)?.code || "AI_PROVIDER_UNAVAILABLE";
    const fallbackContent = input.emergencyTemplate || defaultEmergency(input);
    const sse = new TextEncoder().encode(
      `data: ${JSON.stringify({ choices: [{ delta: { content: fallbackContent } }] })}\n\ndata: [DONE]\n\n`,
    );
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(sse); c.close(); },
    });
    const done = (async () => {
      const latencyMs = Date.now() - totalStart;
      await logRun(input.supabase, input, selection, {
        content: fallbackContent, provider: "template", model: "emergency_template_response",
        fallbackUsed: true, attempts, latencyMs, errorCode: lastCode,
      } as any);
      console.warn(`[STREAM_END] req=${reqTag} success=false code=${lastCode} latency=${latencyMs}ms`);
      return { content: fallbackContent, provider: "template", model: "emergency_template_response",
               latencyMs, fallbackUsed: true, attempts, success: false, errorCode: lastCode };
    })();
    return { stream, done };
  }

  // Tee upstream para capturar tokens enquanto repassa para o cliente
  const upstream = opened.response.body!;
  const [toClient, toParser] = upstream.tee();

  const doneResolver = (async () => {
    let content = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const reader = toParser.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done: rDone, value } = await reader.read();
        if (rDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === "string") content += delta;
            if (json?.usage) usage = json.usage;
          } catch { /* ignore partial */ }
        }
      }
    } catch (err) {
      console.warn("[STREAM_PARSE_ERROR]", err instanceof Error ? err.message : String(err));
    }

    const latencyMs = Date.now() - totalStart;
    const result = {
      content,
      provider: opened!.ref.provider,
      model: opened!.ref.model,
      latencyMs,
      fallbackUsed: opened!.idx > 0,
      attempts,
      success: true as const,
    };
    await logRun(input.supabase, input, selection, {
      content, provider: result.provider, model: result.model,
      fallbackUsed: result.fallbackUsed, attempts, latencyMs,
    } as any);
    await recordCostMetric(input.supabase, input, result.provider, result.model, usage, latencyMs);
    console.log(`[STREAM_END] req=${reqTag} success=true provider=${result.provider} model=${result.model} chars=${content.length} latency=${latencyMs}ms`);
    return result;
  })();

  return { stream: toClient, done: doneResolver };
}

