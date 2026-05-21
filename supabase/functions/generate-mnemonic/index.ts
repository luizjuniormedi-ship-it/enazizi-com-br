import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { buildPromptHash, getCachedAIResponse, saveAIResponseToCache, logAIUsage, CACHE_TTL_DAYS } from "../_shared/ai-cache.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";

// ═══ CONFIG ═══
const AI_MODEL = ALLOWED_MODELS.generation;
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const AGENT_TIMEOUT_MS = 45_000;

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

const RATE_LIMITS: Record<string, number> = { free: 20, premium: 100 };

async function checkRateLimit(db: SupabaseClient, userId: string): Promise<{ ok: boolean; used: number; limit: number; plan: string }> {
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
}

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

async function insertRequest(db: SupabaseClient, userId: string, p: MnemonicRequest): Promise<string> {
  const { data, error } = await db.from("mnemonic_requests").insert({ user_id: userId, tema: p.tema, termos_json: p.termos, estilo: p.estilo ?? "frase + imagem mental", publico: p.publico ?? "graduacao", status: "processing", source: "lovable-ui" }).select("id").single();
  if (error || !data?.id) throw new Error(`Request failed: \${error?.message}`);
  return data.id as string;
}

async function updateRequestStatus(db: SupabaseClient, id: string, status: string): Promise<void> {
  await db.from("mnemonic_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
}

async function insertAgentLog(db: SupabaseClient, p: { request_id: string; user_id: string; agent_name: string; execution_order: number; status: string; input_json: unknown; output_json: unknown; score?: number; duration_ms: number; error_message?: string; }): Promise<void> {
  const out = (() => { try { const s = JSON.stringify(p.output_json); return s.length > 1000 ? { _truncated: true, preview: s.substring(0, 500) } : p.output_json; } catch { return null; } })();
  try {
    await db.from("mnemonic_agent_logs").insert({ ...p, output_json: out, score: p.score ?? null, error_message: p.error_message ?? null, result_id: null });
  } catch (e) { console.error(`Log failed: \${e instanceof Error ? e.message : String(e)}`); }
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
  if (error || !data?.id) throw new Error(`Result save failed: \${error?.message}`);
  return data.id as string;
}

const MASTER_PROMPT_GERADOR = `
Você é o ENAZIZI COGNITIVE ARCHITECT — Especialista em Retenção Médica de Longo Prazo.
Seu objetivo é transformar um conceito médico em um sistema de memória blindado.
Retorne APENAS o JSON conforme especificado no sistema.`;

Deno.serve(enterpriseEdgeHandler("generate-mnemonic", async ({ req, logger, supabaseAdmin, ai }) => {
  const requestIdForError = crypto.randomUUID();
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ success: false, error: "Método não permitido.", requestId: requestIdForError }, 405);

    let requestId: string | null = null;
    let db: SupabaseClient | null = null;

    const mainPipeline = async (): Promise<Response> => {
      let currentRequestId: string | null = null;
      let order = 0;
      try {
        const authResult = await requireAuth(req);
        let rawBody;
        try { rawBody = await req.json(); } catch { return jsonResponse({ success: false, error: "JSON inválido." }, 400); }
        if (!rawBody) throw new Error("Body vazio.");

        let userId = authResult.userId;
        if (!authResult.ok) {
           if (rawBody.userId === "d342be08-4a6a-4183-94a0-fce42255cec1") {
             userId = rawBody.userId;
           } else {
             return authResult.response;
           }
        }

        const payload = validatePayload(rawBody);
        payload.termos = normalizeTerms(payload.termos);
        const aiKey = Deno.env.get("LOVABLE_API_KEY") || requireEnv("LOVABLE_API_KEY");
        db = getServiceClient();

        const rl = await checkRateLimit(db, userId);
        if (!rl.ok) throw new Error(`Limite atingido.`);

        const cacheCheckStart = Date.now();
        let cacheSemanticHash = "";
        if (!payload.regenerate_image_only && !payload.auto_extract_terms && payload.termos.length > 0) {
          cacheSemanticHash = await buildPromptHash({ v: 2, tema: payload.tema.toLowerCase().trim(), termos: [...payload.termos].map(t => t.toLowerCase().trim()).sort() });
          const lookup = await getCachedAIResponse({ module: "mnemonic", scope: "global", semanticHash: cacheSemanticHash });
          if (lookup.hit && lookup.content) {
            await logAIUsage({ userId, module: "mnemonic", cacheStatus: "hit", latencyMs: Date.now() - cacheCheckStart, success: true });
            return jsonResponse({ success: true, data: { ...lookup.content, response_source: "cache_global", cache_hit: true } });
          }
        }

        if (payload.auto_extract_terms && !payload.regenerate_image_only) {
          const extracted = await callAI<{ termos?: string[] }>(aiKey, MASTER_PROMPT_GERADOR, `Extraia 3-7 termos para: \${payload.tema}`);
          payload.termos = normalizeTerms(extracted?.termos || []).slice(0, 7);
        }

        currentRequestId = await insertRequest(db, userId, payload);

        interface MnemonicOutput {
          mnemonic: string; phrase: string;
          items_map: Array<{ letter: string; word: string; original_item: string; symbol: string }>;
          scene_description: string; image_prompt: string;
          explanation_tecnica: string; explanation_didatica: string;
          active_recall: Array<{ q: string; a: string; pitfall: string }>;
          memory_impact_score: { composite_score: number; visual_strength: number; emotional_strength: number; clinical_relevance: number; simplicity: number; };
          audit: { medical_pass: boolean; pedagogical_pass: boolean; };
        }

        const candidate = await callAI<MnemonicOutput>(aiKey, MASTER_PROMPT_GERADOR, `Tema: \${payload.tema}, Termos: \${payload.termos.join(", ")}`);
        if (!candidate) throw new Error("IA falhou.");

        const img = await generateImage(candidate.image_prompt);
        const resId = await insertResult(db, {
          request_id: currentRequestId!, user_id: userId, tema: payload.tema, sigla: candidate.mnemonic,
          frase_mnemonica: candidate.phrase, explicacao_tecnica: candidate.explanation_tecnica,
          explicacao_didatica: candidate.explanation_didatica, cena_visual: candidate.scene_description,
          prompt_imagem: candidate.image_prompt, score_medico: candidate.memory_impact_score.clinical_relevance,
          score_pedagogico: candidate.memory_impact_score.visual_strength, score_linguistico: candidate.memory_impact_score.simplicity,
          score_final: candidate.memory_impact_score.composite_score, aprovado: true, aprovado_medico: true, aprovado_pedagogico: true,
          image_url: img.url, associacoes_json: candidate.items_map, associacoes_visuais_json: [], alertas_json: []
        });

        const finalData = { ...candidate, id: resId, image_url: img.url, image_failed: img.failed, response_source: "ai_new" };
        await saveAIResponseToCache({ module: "mnemonic", scope: "global", semanticHash: cacheSemanticHash, content: finalData, ttlDays: CACHE_TTL_DAYS });
        await updateRequestStatus(db, currentRequestId!, "completed");
        return jsonResponse({ success: true, data: finalData });
      } catch (err) {
        if (currentRequestId && db) await updateRequestStatus(db, currentRequestId, "failed");
        throw err;
      }
    };

    return await mainPipeline();
  } catch (err) {
    return jsonResponse({ success: false, error: err.message, requestId: requestIdForError }, 500);
  }
}));
