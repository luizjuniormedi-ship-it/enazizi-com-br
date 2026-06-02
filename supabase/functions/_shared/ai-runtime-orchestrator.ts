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

  const fullChain: ModelRef[] = [
    { provider: selection.provider, model: selection.model },
    ...selection.fallbackChain,
  ];

  // If primary provider is lovable-ai and we have OpenAI key, consider switching or ensuring OpenAI is in fallback
  const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
  if (hasOpenAI && selection.provider === "lovable-ai") {
    // Add OpenAI version of the model to the beginning of the chain to ensure it's tried first as per user request
    const modelClean = selection.model.replace("openai/", "");
    if (!fullChain.some(c => c.provider === "openai" && c.model === modelClean)) {
      fullChain.unshift({ provider: "openai", model: modelClean });
    }
  }

  // Health-aware filtering: pula modelos com falha recente conhecida.
  const chain = await filterByHealth(input.supabase, fullChain);

  for (let i = 0; i < chain.length; i++) {
    const ref = chain[i];
    const needsDeep = (input.taskType === "tutor_chat" && input.complexity === "high") ||
                      input.taskType === "clinical_reasoning" ||
                      input.taskType === "simulado_review";
    const maxTokens = needsDeep ? AI_MAX_TOKENS_DEEP : AI_MAX_TOKENS;
    const apiKey = getAIKey(ref.provider);
    
    if (!apiKey) {
      attempts.push({ ...ref, success: false, code: "AI_AUTH_ERROR", message: `Missing key for provider ${ref.provider}`, latency_ms: 0 });
      continue;
    }

    const r = await callOnce(ref, apiKey, input.messages, maxTokens);
    attempts.push(r.attempt);

    // Se o erro for 402 (quota exhausted no gateway Lovable), forçar fallback para OpenAI se disponível
    if (!r.attempt.success && r.attempt.status === 402 && ref.provider === "lovable-ai" && hasOpenAI) {
      console.warn("[AI_RUNTIME_ORCHESTRATOR] 402 detected on Lovable Gateway. Falling back to OpenAI.");
      // We don't return here, the loop will continue to the next candidate (which might be OpenAI)
    }

    if (r.attempt.success && r.content) {
      const result: AIRunResult = {
        content: r.content,
        provider: ref.provider,
        model: ref.model,
        fallbackUsed: i > 0,
        attempts,
        latencyMs: Date.now() - totalStart,
        selection,
      };
      // Log fallback if switched from Lovable to OpenAI due to 402 or other failure
      const provider_fallback = i > 0 && ref.provider === "openai" ? "openai" : undefined;
      await logRun(input.supabase, input, selection, { ...result, success: true, metadata: { ...selection, provider_fallback } } as any);
      return result;
    }
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
  return result;
}
