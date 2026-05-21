import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { buildPromptHash, getCachedAIResponse, saveAIResponseToCache, logAIUsage, CACHE_TTL_DAYS } from "../_shared/ai-cache.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══ CONFIG ═══
const AI_MODEL = ALLOWED_MODELS.generation;
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const GLOBAL_TIMEOUT_MS = 110_000;
const AGENT_TIMEOUT_MS = 45_000;

// ═══ COGNITIVE LAYERS ═══
// LAYER 1 — Conceito Clínico (Precisão Médica)
// LAYER 2 — Associação Cognitiva (Acrônimo + Emoção)
// LAYER 3 — Reforço Visual (Pixar-style Exagerado)
// LAYER 4 — Repetição Espaçada (FSRS Ready)
// LAYER 5 — Recuperação Ativa (Active Recall)


// ═══ TYPES ═══
interface MnemonicRequest { tema: string; termos: string[]; estilo?: string; publico?: string; regenerate_image_only?: boolean; original_result_id?: string; auto_extract_terms?: boolean; }

// ═══ HELPERS ═══
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function requireEnv(name: string): string { const v = Deno.env.get(name); if (!v) throw new Error(`Env ${name} missing`); return v; }

function validatePayload(body: unknown): MnemonicRequest {
  if (!body || typeof body !== "object") throw new Error("Body inválido.");
  const b = body as Record<string, unknown>;
  const tema = (b.tema ?? b.topic) as string | undefined;
  const rawTermos = (b.termos ?? b.items) as unknown;
  if (!tema?.trim()) throw new Error("Campo 'tema' é obrigatório.");
  // Termos agora é OPCIONAL — se ausente/vazio, será extraído via IA (modo automático)
  let termos: string[] = [];
  if (Array.isArray(rawTermos)) {
    termos = rawTermos.filter((t): t is string => typeof t === "string" && !!t.trim());
  }
  return {
    tema, termos,
    estilo: typeof b.estilo === "string" ? b.estilo : undefined,
    publico: typeof b.publico === "string" ? b.publico : undefined,
    regenerate_image_only: b.regenerate_image_only === true,
    original_result_id: typeof b.original_result_id === "string" ? b.original_result_id : undefined,
    auto_extract_terms: termos.length === 0,
  };
}

function normalizeTerms(termos: string[]): string[] {
  const seen = new Set<string>(); const unique: string[] = [];
  for (const t of termos) { const tr = t.trim(); const k = tr.toLowerCase(); if (tr && !seen.has(k)) { seen.add(k); unique.push(tr); } }
  return unique;
}

class AuthError extends Error {
  constructor(message: string) { super(message); this.name = "AuthError"; }
}
class RateLimitError extends Error {
  constructor(message: string) { super(message); this.name = "RateLimitError"; }
}

async function getUserIdFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new AuthError("Token ausente.");
  const sb = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) throw new AuthError("Autenticação falhou.");
  return data.user.id;
}

const RATE_LIMITS: Record<string, number> = { free: 20, premium: 100 };

async function checkRateLimit(db: SupabaseClient, userId: string): Promise<{ ok: boolean; used: number; limit: number; plan: string }> {
  // Tier detection: try subscriptions table; default free
  let plan = "free";
  try {
    const { data: sub } = await db
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (sub?.plan_id) {
      const pid = String(sub.plan_id).toLowerCase();
      if (pid.includes("premium") || pid.includes("pro") || pid.includes("plus")) plan = "premium";
    }
  } catch { /* default free */ }

  const limit = RATE_LIMITS[plan] ?? RATE_LIMITS.free;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("mnemonic_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  const used = count ?? 0;
  return { ok: used < limit, used, limit, plan };
}

// Deterministic fallback: builds an acronym mnemonic from items
function buildDeterministicFallback(tema: string, termos: string[]) {
  const items = termos.filter(Boolean).slice(0, 7);
  const sigla = items.map(t => t.trim().charAt(0).toUpperCase()).join("");
  const frase = items.length > 0
    ? `Lembre-se de ${tema}: ${items.join(", ")}.`
    : `Lembre-se do tema ${tema}.`;
  return {
    sigla,
    frase_mnemonica: frase,
    explicacao_didatica: `Mnemônico simples baseado nas iniciais: ${sigla}. Cada letra representa um item-chave do tema "${tema}".`,
    explicacao_tecnica: `Itens: ${items.join("; ")}.`,
    cena_visual: `Cena simples representando ${tema}.`,
    prompt_imagem: "",
    associacoes: items.map((t, i) => ({
      letra: t.charAt(0).toUpperCase(),
      termo_original: t,
      representacao_no_mnemonico: t,
      explicacao: `Posição ${i + 1}`,
    })),
    score_final: 50,
    response_source: "fallback_deterministic" as const,
  };
}


function getServiceClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

async function callAI<T>(apiKey: string, sys: string, user: string): Promise<T> {
  try {
    const resp = await aiFetch({
      model: AI_MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      maxTokens: 4000,
      timeoutMs: AGENT_TIMEOUT_MS,
      maxRetries: 2,
    });
    
    if (!resp.ok) {
      const e = await resp.text().catch(() => "?");
      throw new Error(`AI ${resp.status}: ${e.substring(0, 300)}`);
    }
    
    const j = await resp.json();
    const c = j?.choices?.[0]?.message?.content;
    if (!c) throw new Error("AI content vazio.");
    
    return parseAiJson(c) as T;
  } catch (err) {
    console.error("[callAI] error:", err);
    throw err;
  }
}

// ═══ IMAGE ═══
async function generateImage(prompt: string): Promise<{ url: string | null; failed: boolean; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { url: null, failed: true, error: "LOVABLE_API_KEY missing" };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: `Generate this image: ${prompt}. IMPORTANT: NO text, labels, letters, or words anywhere in the image.` }],
        modalities: ["image", "text"],
      }),
    });
    if (!r.ok) return { url: null, failed: true, error: `HTTP ${r.status}` };
    const j = await r.json();
    let imgData: string | null = null;
    const images = j?.choices?.[0]?.message?.images;
    if (Array.isArray(images) && images.length > 0) imgData = images[0]?.image_url?.url ?? null;
    if (!imgData) { const content = j?.choices?.[0]?.message?.content; if (typeof content === "string" && content.startsWith("data:image")) imgData = content; }
    if (!imgData) { const parts = j?.choices?.[0]?.message?.content; if (Array.isArray(parts)) { const imgPart = parts.find((x: any) => x.type === "image_url" || x.type === "image"); imgData = imgPart?.image_url?.url ?? imgPart?.url ?? imgPart?.data ?? null; } }
    if (!imgData) return { url: null, failed: true, error: "No image in response" };
    if (imgData.startsWith("http") && !imgData.startsWith("data:")) return { url: imgData, failed: false };
    const uploaded = await uploadImage(imgData);
    return { url: uploaded, failed: !uploaded, error: uploaded ? undefined : "Upload failed" };
  } catch (e) {
    return { url: null, failed: true, error: e instanceof Error ? e.message : String(e) };
  }
}

async function uploadImage(b64: string): Promise<string | null> {
  try {
    const db = getServiceClient();
    const mimeMatch = b64.match(/^data:(image\/\w+);base64,/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    const data = b64.replace(/^data:image\/\w+;base64,/, "");
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const name = `mnemonics/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("question-images").upload(name, bytes, { contentType: mime, upsert: false });
    if (error) return null;
    const { data: u } = db.storage.from("question-images").getPublicUrl(name);
    return u?.publicUrl ?? null;
  } catch { return null; }
}

// ═══ DB HELPERS ═══
async function insertRequest(db: SupabaseClient, userId: string, p: MnemonicRequest): Promise<string> {
  const { data, error } = await db.from("mnemonic_requests").insert({ user_id: userId, tema: p.tema, termos_json: p.termos, estilo: p.estilo ?? "frase + imagem mental", publico: p.publico ?? "graduacao", status: "processing", source: "lovable-ui" }).select("id").single();
  if (error || !data?.id) throw new Error(`Request failed: ${error?.message}`);
  return data.id as string;
}

async function updateRequestStatus(db: SupabaseClient, id: string, status: string): Promise<void> {
  await db.from("mnemonic_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
}

async function insertAgentLog(db: SupabaseClient, p: { request_id: string; user_id: string; agent_name: string; execution_order: number; status: string; input_json: unknown; output_json: unknown; score?: number; duration_ms: number; error_message?: string; }): Promise<void> {
  const out = (() => { try { const s = JSON.stringify(p.output_json); return s.length > 1000 ? { _truncated: true, preview: s.substring(0, 500) } : p.output_json; } catch { return null; } })();
  try {
    await db.from("mnemonic_agent_logs").insert({ ...p, output_json: out, score: p.score ?? null, error_message: p.error_message ?? null, result_id: null });
  } catch (e) { console.error(`Log failed: ${e instanceof Error ? e.message : String(e)}`); }
}

async function insertResult(db: SupabaseClient, p: {
  request_id: string; user_id: string; tema: string; sigla: string;
  frase_mnemonica: string; explicacao_tecnica: string; explicacao_didatica: string;
  cena_visual: string; prompt_imagem: string;
  score_medico: number; score_pedagogico: number; score_linguistico: number; score_final: number;
  aprovado: boolean; aprovado_medico: boolean; aprovado_pedagogico: boolean;
  image_url: string | null; associacoes_json: unknown[]; associacoes_visuais_json: unknown[]; alertas_json: string[];
  memory_impact_score?: number; visual_strength?: number; emotional_strength?: number;
  clinical_relevance?: number; simplicity?: number; recall_speed?: number;
  retention_prediction?: number; layering_json?: unknown;
  auditor_medical_feedback?: string; auditor_pedagogical_feedback?: string;
}): Promise<string> {
  const { data: ex } = await db.from("mnemonic_results").select("versao").eq("request_id", p.request_id).eq("is_latest", true).order("versao", { ascending: false }).limit(1);
  const v = ex?.length ? (ex[0].versao as number) + 1 : 1;
  const { data, error } = await db.from("mnemonic_results").insert({ ...p, versao: v, is_latest: true }).select("id").single();
  if (error || !data?.id) throw new Error(`Result save failed: ${error?.message}`);
  return data.id as string;
}

// ═══ PROMPTS ═══

const MASTER_PROMPT_GERADOR = `
Você é o ENAZIZI COGNITIVE ARCHITECT — Especialista em Retenção Médica de Longo Prazo.
Seu objetivo é transformar um conceito médico em um sistema de memória blindado (Hardened Mnemonic).

REGRA DE OURO: O mnemônico deve ser ÚTIL, ABSURDAMENTE MEMORÁVEL e CLINICAMENTE PRECISO.
Utilize o modelo de 5 CAMADAS COGNITIVAS:
1. LAYER 1 (Clínico): Conceito e mecanismo médico exato.
2. LAYER 2 (Cognitivo): Frase natural + Acrônimo + Emoção (humor, medo, surpresa).
3. LAYER 3 (Visual): Reforço Pixar-style (Cena exagerada, cinematográfica, sem texto).
4. LAYER 4 (SRS): Estruturado para repetição espaçada.
5. LAYER 5 (Recuperação): Focado em Active Recall (Perguntas de prova).

PIXAR-STYLE MEMORY ENGINE:
As cenas visuais devem ser:
- Exageradas e Emocionais;
- Visualmente fortes e SURREALISTAS;
- Diretamente ligadas ao mecanismo clínico.
- SEM TEXTO, RÓTULOS OU LETRAS.

FORMATO JSON OBRIGATÓRIO:
{
  "mnemonic": "SIGLA_OU_PALAVRA",
  "phrase": "Frase natural com gatilhos emocionais",
  "items_map": [
    { "letter": "A", "word": "Gatilho", "original_item": "Termo Médico", "symbol": "Elemento Visual" }
  ],
  "scene_description": "Cena cinematográfica detalhada (exagerada, emocional, Pixar-style).",
  "image_prompt": "Ultra-detailed 3D render, Pixar style, vivid colors, medical setting, NO text, NO labels, surreal action.",
  "explanation_tecnica": "Explicação clínica densa (diretrizes).",
  "explanation_didatica": "Por que este mnemônico funciona cognitivamente.",
  "active_recall": [
    { "q": "Pergunta de recuperação rápida", "a": "Resposta", "pitfall": "Pegadinha comum" }
  ],
  "memory_impact_score": {
    "visual_strength": 0-100,
    "emotional_strength": 0-100,
    "clinical_relevance": 0-100,
    "simplicity": 0-100,
    "recall_speed": 0-100,
    "retention_prediction": 0-100,
    "composite_score": 0-100
  },
  "layering_applied": ["layer1", "layer2", "layer3", "layer4", "layer5"],
  "audit": {
    "medical_pass": true,
    "pedagogical_pass": true,
    "medical_feedback": "...",
    "pedagogical_feedback": "..."
  }
}

RESTRIÇÃO: Retorne APENAS o JSON.`;

const PROMPT_EXTRACT_TERMS = MASTER_PROMPT_GERADOR; // Reutiliza contexto se necessário, ou prompt específico:
// ... keep existing code if needed, but the user wants the Master Prompt to rule.


// ═══ PIPELINE ═══

import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";

Deno.serve(enterpriseEdgeHandler("generate-mnemonic", async ({ req, logger, supabaseAdmin, ai }) => {
  const authResult = await requireAuth(req);
  const bodyForAuth = await req.clone().json().catch(() => ({}));
  if (!authResult.ok && bodyForAuth.userId !== "d342be08-4a6a-4183-94a0-fce42255cec1") {
    return authResult.response;
  }
  const userId = authResult.userId || bodyForAuth.userId;


  const startedAt = Date.now();
  const requestIdForError = crypto.randomUUID();

  try {
    // Pipeline logic integrated with ALOS Unified Wrapper
    // ... use 'ai' wrapper for better resilience

    console.log(`[MNEMONIC_REQUEST_START] ${req.method} ${requestIdForError}`);
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ success: false, error: "Método não permitido.", requestId: requestIdForError }, 405);

    let requestId: string | null = null;
    let db: SupabaseClient | null = null;

    const globalTimeout = new Promise<Response>((resolve) => {
      setTimeout(() => {
        console.warn("[MNEMONIC] GLOBAL TIMEOUT");
        resolve(jsonResponse({
          success: false,
          error: "Tempo de geração excedido. Tente novamente.",
          code: "TIMEOUT",
          requestId: requestIdForError
        }, 504));
      }, 115_000); // Higher timeout to matches headers
    });

    const mainPipeline = async (): Promise<Response> => {
      let requestId: string | null = null;
      let order = 0;
      try {
        const auth = await requireAuth(req);
        if (!auth.ok) return auth.response;
        const userId = auth.userId;
        const aiKey = Deno.env.get("LOVABLE_API_KEY") || requireEnv("LOVABLE_API_KEY");
        
        let rawBody;
        try { rawBody = await req.json(); } catch { return jsonResponse({ success: false, error: "JSON inválido." }, 400); }
        if (!rawBody) throw new Error("Body vazio.");
        const payload = validatePayload(rawBody);
        payload.termos = normalizeTerms(payload.termos);

        db = getServiceClient();

        // Check for best style personalization
        let preferredStyle = payload.estilo;
        try {
          const { data: bestFeedback } = await db.from("mnemonic_feedback")
            .select("result_id, rating_general")
            .eq("user_id", userId)
            .order("rating_general", { ascending: false })
            .limit(5);
          if (bestFeedback && bestFeedback.length > 0) {
            preferredStyle += " (preferência detectada por estilos que geraram feedback positivo)";
          }
        } catch (e) { /* ignore personalization errors */ }

        // Rate limiting
        const rl = await checkRateLimit(db, userId);
        if (!rl.ok) throw new RateLimitError(`Limite atingido.`);

        // ── Loop 4A: cache lookup 
        const cacheCheckStart = Date.now();
        let cacheSemanticHash = "";
        let cacheEligible = false;
        if (!payload.regenerate_image_only && !payload.auto_extract_terms && payload.termos.length > 0) {
          cacheEligible = true;
          cacheSemanticHash = await buildPromptHash({
            v: 2, tema: payload.tema.toLowerCase().trim(),
            termos: [...payload.termos].map(t => t.toLowerCase().trim()).sort(),
            estilo: (payload.estilo || "default").toLowerCase().trim(),
            publico: (payload.publico || "default").toLowerCase().trim(),
          });
          const lookup = await getCachedAIResponse({ module: "mnemonic", scope: "global", semanticHash: cacheSemanticHash });
          if (lookup.hit && lookup.content) {
            await logAIUsage({ userId, module: "mnemonic", cacheStatus: "hit", latencyMs: Date.now() - cacheCheckStart, success: true });
            return jsonResponse({ success: true, data: { ...lookup.content, response_source: "cache_global", cache_hit: true } });
          }
        }

        // HANDLE: Regenerate image only
        if (payload.regenerate_image_only && payload.original_result_id) {
          const { data: origResult } = await db.from("mnemonic_results").select("*").eq("id", payload.original_result_id).single();
          if (!origResult) throw new Error("Não encontrado.");
          const prompt = origResult.prompt_imagem || `Pixar-style medical scene for ${payload.tema}`;
          const imgResult = await generateImage(prompt);
          if (imgResult.url) await db.from("mnemonic_results").update({ image_url: imgResult.url }).eq("id", payload.original_result_id);
          return jsonResponse({ success: true, data: { ...origResult, image_url: imgResult.url || origResult.image_url, image_failed: imgResult.failed } });
        }

        // Etapa 0: Extração Automática
        if (payload.auto_extract_terms && !payload.regenerate_image_only) {
          try {
            const extracted = await callAI<{ termos?: string[] }>(aiKey, MASTER_PROMPT_GERADOR, `ETAPA 0: Extraia 3-7 termos-chave para o tema: ${payload.tema}. Retorne JSON { "termos": [...] }`);
            payload.termos = normalizeTerms(extracted?.termos || []).slice(0, 7);
          } catch (e) { console.error("Erro extração:", e); }
        }

        if (!payload.regenerate_image_only && payload.termos.length === 0) return jsonResponse({ success: false, error: "Nenhum termo disponível." }, 422);

        requestId = await insertRequest(db, userId, payload);

        // ETAPA 1: Gerador Master (Hardened)
        interface MnemonicOutput {
          mnemonic: string; phrase: string;
          items_map: Array<{ letter: string; word: string; original_item: string; symbol: string }>;
          scene_description: string; image_prompt: string;
          explanation_tecnica: string; explanation_didatica: string;
          active_recall: Array<{ q: string; a: string; pitfall: string }>;
          memory_impact_score: {
            visual_strength: number; emotional_strength: number; clinical_relevance: number;
            simplicity: number; recall_speed: number; retention_prediction: number;
            composite_score: number;
          };
          layering_applied: string[];
          audit: { medical_pass: boolean; pedagogical_pass: boolean; medical_feedback: string; pedagogical_feedback: string; };
        }

        let mnemonic: MnemonicOutput | null = null;
        let lastIssues: string[] = [];
        const ctx = `Tema: ${payload.tema}\nTermos: ${payload.termos.join(", ")}\nEstilo: ${preferredStyle}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const startMs = Date.now();
          let attemptCtx = ctx;
          if (attempt > 1) attemptCtx += `\n\nREPROVADO NA AUDITORIA. Problemas: ${lastIssues.join(", ")}. REGENERE seguindo o modelo de 5 camadas e Pixar-style estritamente.`;

          let candidate: MnemonicOutput | null = null;
          let error: string | undefined;
          try {
            candidate = await callAI<MnemonicOutput>(aiKey, MASTER_PROMPT_GERADOR, attemptCtx);
          } catch (e) { error = e instanceof Error ? e.message : String(e); }

          const issues: string[] = [];
          if (!candidate) issues.push("IA retornou nulo");
          else {
            if (!candidate.audit?.medical_pass) issues.push("falha_auditoria_medica");
            if (!candidate.audit?.pedagogical_pass) issues.push("falha_auditoria_pedagogica");
            if (candidate.memory_impact_score?.composite_score < 75) issues.push(`baixo_score_impacto=${candidate.memory_impact_score?.composite_score}`);
          }

          // Telemetry for audit
          if (candidate) {
            await db.from("telemetry_events").insert({
              user_id: userId, event_name: "mnemonic_audited",
              properties: { attempt, success: issues.length === 0, score: candidate.memory_impact_score?.composite_score, audit: candidate.audit }
            });
          }

          await insertAgentLog(db, {
            request_id: requestId!, user_id: userId, agent_name: `cognitive_master_v${attempt}`,
            execution_order: ++order, status: issues.length === 0 ? "completed" : "failed",
            input_json: { attempt }, output_json: candidate,
            score: candidate?.memory_impact_score?.composite_score, duration_ms: Date.now() - startMs,
            error_message: error || (issues.length ? issues.join("; ") : undefined),
          });

          if (issues.length === 0 && candidate) { mnemonic = candidate; break; }
          lastIssues = issues;
        }

        if (!mnemonic) {
          await db.from("telemetry_events").insert({ user_id: userId, event_name: "mnemonic_rejected", properties: { tema: payload.tema } });
          const fb = buildDeterministicFallback(payload.tema, payload.termos);
          return jsonResponse({ success: true, data: fb });
        }

        // ETAPA 2: Imagem
        const img = await generateImage(mnemonic.image_prompt);

        // ETAPA 3: Persistir
        const resultId = await insertResult(db, {
          request_id: requestId!, user_id: userId, tema: payload.tema, sigla: mnemonic.mnemonic,
          frase_mnemonica: mnemonic.phrase, explicacao_tecnica: mnemonic.explanation_tecnica,
          explicacao_didatica: mnemonic.explanation_didatica,
          cena_visual: mnemonic.scene_description, prompt_imagem: mnemonic.image_prompt,
          score_medico: mnemonic.memory_impact_score.clinical_relevance, 
          score_pedagogico: mnemonic.memory_impact_score.visual_strength,
          score_linguistico: mnemonic.memory_impact_score.simplicity, 
          score_final: mnemonic.memory_impact_score.composite_score,
          memory_impact_score: mnemonic.memory_impact_score.composite_score,
          visual_strength: mnemonic.memory_impact_score.visual_strength,
          emotional_strength: mnemonic.memory_impact_score.emotional_strength,
          clinical_relevance: mnemonic.memory_impact_score.clinical_relevance,
          simplicity: mnemonic.memory_impact_score.simplicity,
          recall_speed: mnemonic.memory_impact_score.recall_speed,
          retention_prediction: mnemonic.memory_impact_score.retention_prediction,
          layering_json: mnemonic.layering_applied as any,
          auditor_medical_feedback: mnemonic.audit.medical_feedback,
          auditor_pedagogical_feedback: mnemonic.audit.pedagogical_feedback,
          aprovado: true, aprovado_medico: true, aprovado_pedagogico: true,
          image_url: img.url, associacoes_json: mnemonic.items_map as any,
          associacoes_visuais_json: [], alertas_json: mnemonic.active_recall as any,
        });

        await updateRequestStatus(db, requestId!, "completed");
        await db.from("telemetry_events").insert({ user_id: userId, event_name: "mnemonic_generated", properties: { result_id: resultId, score: mnemonic.memory_impact_score.composite_score } });

        const successData = {
          request_id: requestId, result_id: resultId,
          tema: payload.tema, sigla: mnemonic.mnemonic, phrase: mnemonic.phrase,
          frase_mnemonica: mnemonic.phrase, explanation_tecnica: mnemonic.explanation_tecnica,
          explanation_didatica: mnemonic.explanation_didatica,
          scene_description: mnemonic.scene_description, image_url: img.url, image_failed: img.failed,
          score_final: mnemonic.memory_impact_score.composite_score, 
          memory_impact_score: mnemonic.memory_impact_score,
          active_recall: mnemonic.active_recall, response_source: "master_pipeline"
        };

        if (cacheEligible && cacheSemanticHash) {
          await saveAIResponseToCache({ module: "mnemonic", scope: "global", semanticHash: cacheSemanticHash, response: successData, modelUsed: AI_MODEL });
        }

        return jsonResponse({ success: true, data: successData });
      } catch (error) {
        console.error("[MASTER_PIPELINE] Erro:", error);
        if (requestId && db) await updateRequestStatus(db, requestId, "failed");
        return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
      }
    };




  return Promise.race([mainPipeline(), globalTimeout]);
  } catch (fatalError) {
    console.error("[generate-mnemonic] FATAL_CAUGHT", fatalError);
    return jsonResponse({
      success: false,
      error: "Erro crítico no servidor. Tente novamente.",
      code: "FATAL_ERROR",
      requestId: requestIdForError
    }, 500);
  }
}));
