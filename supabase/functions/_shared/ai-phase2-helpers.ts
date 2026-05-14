/**
 * Phase 2/3/3.5/v13 AI helpers: cache, usage control, anti-repetition,
 * content logging, cost governance, and scale governance.
 */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export { corsHeaders };

function getAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export { getAdmin };

// ── Auth helper ──
export async function extractUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
    const sub = claimsData?.claims?.sub;
    if (!claimsError && typeof sub === "string" && sub.length > 0) return sub;
    const { data } = await sb.auth.getUser(token);
    return data?.user?.id || null;
  } catch (err) {
    console.warn("[extractUserId] failed:", err);
    return null;
  }
}

// ── Robust hash ──
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { sha256 };

/** Deterministic hash from type + sorted payload */
export async function buildCacheKey(
  type: string,
  params: Record<string, unknown>,
): Promise<string> {
  const canonical = JSON.stringify(
    Object.keys(params)
      .sort()
      .reduce((o, k) => {
        o[k] = String(params[k] ?? "").toLowerCase().trim();
        return o;
      }, {} as Record<string, string>),
  );
  const hash = await sha256(canonical);
  return `p3::${type}::${hash.slice(0, 24)}`;
}

/** Quick hash for content dedup (anti-repetition) */
export async function contentHash(text: string): Promise<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
  return (await sha256(normalized)).slice(0, 32); // v13 uses longer hash for safety
}

// ── Cost Governance ──
export async function trackAiCost(params: {
  featureName: string;
  modelName: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  metadata?: any;
}): Promise<void> {
  try {
    const sb = getAdmin();
    await sb.from("ai_cost_metrics").insert({
      feature_name: params.featureName,
      model_name: params.modelName,
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      cost_usd: params.costUsd,
      metadata: params.metadata,
    });
  } catch (e) {
    console.warn("[trackAiCost] failed:", e);
  }
}

// ── Question Lifecycle & Governance ──
export type QuestionLifecycleState = 
  | 'generated' 
  | 'validating' 
  | 'approved' 
  | 'golden' 
  | 'shadow_review' 
  | 'quarantined' 
  | 'deprecated' 
  | 'archived';

export async function updateQuestionLifecycle(
  questionId: string, 
  state: QuestionLifecycleState,
  notes?: string
): Promise<void> {
  try {
    const sb = getAdmin();
    await sb.from("questions_bank")
      .update({ 
        lifecycle_state: state,
        // Optional: add to an audit log if needed
      })
      .eq("id", questionId);
      
    if (notes) {
      await sb.from("adaptive_governance_logs").insert({
        question_id: questionId,
        event_type: `lifecycle_transition_${state}`,
        details: { notes }
      });
    }
  } catch (e) {
    console.warn("[updateQuestionLifecycle] failed:", e);
  }
}

export async function triggerHumanAudit(
  questionId: string, 
  reason: 'random' | 'high_risk' | 'divergence',
  divergenceScore?: number
): Promise<void> {
  try {
    const sb = getAdmin();
    await sb.from("human_audit_queue").insert({
      question_id: questionId,
      audit_reason: reason,
      divergence_score: divergenceScore,
      status: 'pending'
    });
  } catch (e) {
    console.warn("[triggerHumanAudit] failed:", e);
  }
}

// ── Cache (reuses ai_content_cache) ──
export async function getCache(
  type: string,
  params: Record<string, unknown>,
): Promise<{ hit: true; data: any; key: string } | { hit: false; key: string }> {
  const key = await buildCacheKey(type, params);
  try {
    const sb = getAdmin();
    const { data } = await sb
      .from("ai_content_cache")
      .select("id, content_json, hit_count")
      .eq("cache_key", key)
      .eq("content_type", type)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) {
      // Increment hit_count (fire-and-forget)
      sb.from("ai_content_cache")
        .update({ hit_count: (data.hit_count || 0) + 1 })
        .eq("id", data.id)
        .then(() => {});
      return { hit: true, data: data.content_json, key };
    }
  } catch {
    /* miss */
  }
  return { hit: false, key };
}

export async function setCache(
  key: string,
  type: string,
  json: any,
  ttlDays = 30,
  modelUsed?: string,
) {
  try {
    const sb = getAdmin();
    await sb.from("ai_content_cache").upsert(
      {
        cache_key: key,
        content_type: type,
        content_json: json,
        model_used: modelUsed || "openai/gpt-5-mini",
        expires_at: new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
        hit_count: 0,
      },
      { onConflict: "cache_key,content_type" },
    );
  } catch {
    /* non-critical */
  }
}

// ── Anti-repetition ──
export async function wasRecentlyGenerated(
  userId: string,
  hash: string,
  windowHours = 24,
): Promise<boolean> {
  try {
    const sb = getAdmin();
    const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
    const { count } = await sb
      .from("generated_content_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("content_hash", hash)
      .gt("created_at", since);
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

// ── Content logging ──
export async function logGeneratedContent(params: {
  userId: string;
  contentType: string;
  theme: string;
  subtopic?: string;
  contentHash: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  sourceEndpoint: string;
  modelUsed?: string;
  cacheHit: boolean;
  costUnits: number;
}): Promise<void> {
  try {
    const sb = getAdmin();
    await sb.from("generated_content_log").insert({
      user_id: params.userId,
      content_type: params.contentType,
      theme: params.theme,
      subtopic: params.subtopic || null,
      content_hash: params.contentHash,
      request_payload: params.requestPayload as any,
      response_payload: params.responsePayload as any,
      source_endpoint: params.sourceEndpoint,
      model_used: params.modelUsed || "openai/gpt-5-mini",
      cache_hit: params.cacheHit,
      cost_units: params.costUnits,
    });
  } catch (e) {
    console.warn("[logGeneratedContent] failed:", e);
  }
}

// ── Usage control ──
const LIMITS: Record<string, number> = {
  free: 30,
  pro: 150,
  premium: 500,
  enterprise: 2000,
};

export const ACTION_COSTS: Record<string, number> = {
  explain_simple: 1,
  reinforce_error: 1,
  summarize_topic: 1,
  adaptive_question: 5,
  adaptive_simulado: 10,
  deep_explanation: 4,
  answer_audit: 6,
};

export async function checkAndIncrementUsage(
  userId: string,
  cost = 1,
): Promise<{ allowed: boolean; remaining: number }> {
  const sb = getAdmin();
  const period = new Date().toISOString().slice(0, 7) + "-01";

  const { data: row } = await sb
    .from("ai_usage_control")
    .upsert(
      { user_id: userId, period_start: period },
      { onConflict: "user_id,period_start", ignoreDuplicates: true },
    )
    .select("ai_calls_used, ai_calls_limit, plan_type")
    .maybeSingle();

  let usage = row;
  if (!usage) {
    const { data } = await sb
      .from("ai_usage_control")
      .select("ai_calls_used, ai_calls_limit, plan_type")
      .eq("user_id", userId)
      .eq("period_start", period)
      .maybeSingle();
    usage = data;
  }

  const limit = usage?.ai_calls_limit ?? LIMITS[usage?.plan_type ?? "free"] ?? 30;
  const used = usage?.ai_calls_used ?? 0;

  if (used + cost > limit) {
    return { allowed: false, remaining: Math.max(0, limit - used) };
  }

  await sb
    .from("ai_usage_control")
    .update({ ai_calls_used: used + cost })
    .eq("user_id", userId)
    .eq("period_start", period);

  return { allowed: true, remaining: limit - used - cost };
}

// ── AI calls ──
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LIGHT_MODEL = "openai/gpt-5-mini";
const HEAVY_MODEL = "openai/gpt-5";

async function callAI(model: string, system: string, user: string, maxTokens: number): Promise<{ content: string; tokensInput: number; tokensOutput: number }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`AI (${model}) failed (${res.status}):`, t.slice(0, 200));
    if (res.status === 429) throw new Error("AI_RATE_LIMITED");
    if (res.status === 402) throw new Error("AI_CREDITS_EXHAUSTED");
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }

  const json = await res.json();
  return {
    content: json.choices?.[0]?.message?.content || "",
    tokensInput: json.usage?.prompt_tokens || 0,
    tokensOutput: json.usage?.completion_tokens || 0
  };
}

export async function callLightAI(system: string, user: string): Promise<string> {
  const { content } = await callAI(LIGHT_MODEL, system, user, 1024);
  return content;
}

export async function callHeavyAI(system: string, user: string, maxTokens = 4096): Promise<string> {
  const { content } = await callAI(HEAVY_MODEL, system, user, maxTokens);
  return content;
}

/** New v13 call with cost tracking */
export async function callAIWithGovernance(
  feature: string,
  model: 'light' | 'heavy',
  system: string,
  user: string,
  maxTokens = 4096
): Promise<string> {
  const modelName = model === 'light' ? LIGHT_MODEL : HEAVY_MODEL;
  const { content, tokensInput, tokensOutput } = await callAI(modelName, system, user, maxTokens);
  
  // Cost estimation (GPT-4o style roughly)
  const costInput = (tokensInput / 1_000_000) * (model === 'light' ? 0.15 : 5.00);
  const costOutput = (tokensOutput / 1_000_000) * (model === 'light' ? 0.60 : 15.00);
  const totalCost = costInput + costOutput;

  await trackAiCost({
    featureName: feature,
    modelName,
    tokensInput,
    tokensOutput,
    costUsd: totalCost
  });

  return content;
}

/** Parse JSON from AI response, handling markdown code blocks */
export function parseAiJsonSafe(raw: string): any {
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = codeBlock ? codeBlock[1].trim() : raw;
  const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");
  return JSON.parse(jsonMatch[0].replace(/,\s*([}\]])/g, "$1"));
}

// ── JSON response helpers ──
export function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Fallback helpers ──
export function fallbackMessage(theme: string): string {
  return `Revise o tema "${theme}" com base no seu material de estudo. Você pode tentar novamente mais tarde quando seu limite for renovado.`;
}

/** Contextual fallback with cheaper endpoint suggestions */
export function smartFallback(endpoint: string, theme: string): {
  message: string;
  suggestedEndpoints: string[];
} {
  const map: Record<string, { msg: string; alt: string[] }> = {
    "generate-adaptive-question": {
      msg: `Limite atingido para geração de questões. Use "explain-simple" ou "summarize-topic" para revisar "${theme}" com custo menor.`,
      alt: ["explain-simple", "summarize-topic"],
    },
    "explain-deep": {
      msg: `Limite atingido para explicação profunda. Use "explain-simple" para uma revisão rápida de "${theme}".`,
      alt: ["explain-simple"],
    },
    "audit-answer": {
      msg: `Limite atingido para auditoria. Revise o gabarito e as referências do tema "${theme}" manualmente.`,
      alt: ["reinforce-error", "explain-simple"],
    },
    "simulado-assistant": {
      msg: `Limite atingido para simulados. Use "generate-adaptive-question" para questões individuais de "${theme}".`,
      alt: ["generate-adaptive-question", "summarize-topic"],
    },
  };
  const entry = map[endpoint] || { msg: fallbackMessage(theme), alt: [] };
  return { message: entry.msg, suggestedEndpoints: entry.alt };
}

// ── Study-next integration conventions ──
export const STUDY_NEXT_ACTION_MAP: Record<string, string[]> = {
  error_review: ["reinforce-error", "generate-adaptive-question"],
  review: ["summarize-topic", "explain-deep"],
  fsrs_review: ["summarize-topic", "explain-simple"],
  daily_task: ["generate-adaptive-question"],
  free_study: ["explain-deep", "generate-adaptive-question"],
  image_quiz: ["generate-image-questions", "reinforce-error"],
  mnemonic: ["generate-mnemonic", "reinforce-error"],
};

/** Handle common AI errors and return appropriate Response */
export function handleAiError(e: unknown, context: string): Response {
  console.error(`${context} error:`, e);
  const msg = e instanceof Error ? e.message : "";
  if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
  if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
  return jsonError(`Erro: ${context}`, 500);
}

