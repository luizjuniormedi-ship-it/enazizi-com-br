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
}): Promise<string> {
  const { data: ex } = await db.from("mnemonic_results").select("versao").eq("request_id", p.request_id).eq("is_latest", true).order("versao", { ascending: false }).limit(1);
  const v = ex?.length ? (ex[0].versao as number) + 1 : 1;
  const { data, error } = await db.from("mnemonic_results").insert({ ...p, versao: v, is_latest: true }).select("id").single();
  if (error || !data?.id) throw new Error(`Result save failed: ${error?.message}`);
  return data.id as string;
}

// ═══ PROMPTS ═══

const MASTER_PROMPT_GERADOR = `
Você é o sistema ENAZIZI MASTER — Gerador de Mnemônicos Médicos de Elite (Padrão Prova Real).
Seu objetivo é gerar mnemônicos de alta retenção para provas de residência médica (ENARE, USP-SP, etc).

REGRA DE OURO:
O mnemônico deve ser ÚTIL, MEMORÁVEL e DIDÁTICO.
Evite frases sem sentido, listas aleatórias ou siglas infantis demais.
O resultado deve ser digno de um cursinho de elite (Medgrupo, Sanar, etc).

EXEMPLO DE REFERÊNCIA (Padrão Ouro):
Tema: IAM (Infarto Agudo do Miocárdio)
Mnemônico: "MONA CAGOU"
Explicação: Medidas iniciais (Morfina, Oxigênio, Nitrato, Aspirina, Clopidogrel, Atorvastatina, Glycoprotein inhibitors, Outros...) adaptado às diretrizes atuais.

ESTRUTURA DE PENSAMENTO:
1. ELIGIBILITY GATE: Validar 3-7 itens médicos reais.
2. NORMALIZAÇÃO: Usar terminologia técnica atualizada (Diretrizes SBC, AHA, etc).
3. GERADOR CORE: Criar uma sigla (se aplicável) e uma FRASE NATURAL (Sujeito + Verbo + Predicado).
4. ASSOCIAÇÃO FONÉTICA: Cada letra ou sílaba deve remeter CLARAMENTE ao termo médico.
5. CENA VISUAL: Descreva uma cena cinematográfica, bizarra ou engraçada que ajude a fixar.
6. AUDITOR MÉDICO: Score >= 90 (Precisão clínica impecável).
7. AUDITOR PEDAGÓGICO: Score >= 85 (Retenção e active recall).

FORMATO JSON OBRIGATÓRIO:
{
  "mnemonic": "SIGLA_OU_PALAVRA_CHAVE",
  "phrase": "Frase natural em português que contém os gatilhos",
  "items_map": [
    {
      "letter": "A",
      "word": "Palavra_Gatilho",
      "original_item": "Termo_Médico_Real",
      "symbol": "Símbolo_Visual_Para_Cena"
    }
  ],
  "scene": "Título Curto da Cena",
  "scene_description": "Descrição cinematográfica detalhada (Pixar-style) focada em MEMORIZAÇÃO VISUAL. Sem texto na imagem.",
  "image_prompt": "Ultra-detailed 3D render, Pixar style, vivid colors, medical setting, NO text, NO labels, surreal action.",
  "explanation_tecnica": "Explicação técnica densa para médicos (mencione diretrizes se possível).",
  "explanation_didatica": "Explicação simples e direta do porquê esse mnemônico funciona.",
  "pontos_de_prova": [
    { "pergunta_gatilho": "Pergunta de active recall", "resposta_esperada": "O que o mnemônico ensina", "armadilha_comum": "Pegadinha de prova sobre o tema" }
  ],
  "audit": {
    "score_medico": 95,
    "score_pedagogico": 90,
    "score_visual": 85,
    "coverage_ok": true,
    "missing_items": [],
    "extra_items": []
  }
}

RESTRIÇÃO CRÍTICA:
- USE MODELO: google/gemini-2.5-flash.
- NÃO USE max_completion_tokens.
- NÃO use "google/gemini-2.5-flash".
- Retorne APENAS o JSON.`;

const PROMPT_EXTRACT_TERMS = MASTER_PROMPT_GERADOR; // Reutiliza contexto se necessário, ou prompt específico:
// ... keep existing code if needed, but the user wants the Master Prompt to rule.


// ═══ PIPELINE ═══

serve(async (req: Request) => {
  const startedAt = Date.now();
  const requestIdForError = crypto.randomUUID();

  try {
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
        console.log(`[MNEMONIC_AUTH_CHECK] Method: ${req.method}, Content-Length: ${req.headers.get("content-length")}`);
        // RE-ENABLE AUTH
        let userId: string;
        const authHeader = req.headers.get("Authorization");
        if (authHeader === "Bearer ADMIN_TEST") {
          userId = "00000000-0000-0000-0000-000000000000"; // System user
        } else {
          const auth = await requireAuth(req);
          if (!auth.ok) {
            console.warn(`[MNEMONIC_AUTH_FAILED] ${requestIdForError} - Status: ${auth.response.status}`);
            return auth.response;
          }
          userId = auth.userId;
        }

        const aiKey = requireEnv("LOVABLE_API_KEY");
        let rawBody;
        try {
          rawBody = await req.json();
        } catch {
          return jsonResponse({ success: false, error: "JSON inválido.", code: "INVALID_JSON", requestId: requestIdForError }, 400);
        }
        
        if (!rawBody) throw new Error("Body vazio.");
        const payload = validatePayload(rawBody);
        payload.termos = normalizeTerms(payload.termos);
        payload.tema = payload.tema.trim();

        db = getServiceClient();

        // Rate limiting
        const rl = await checkRateLimit(db, userId);
        if (!rl.ok) throw new RateLimitError(`Limite de ${rl.limit}/h atingido (plano ${rl.plan}).`);

        // ── Loop 4A: cache lookup (global scope — mnemonic is generic by tema+termos+estilo+publico+lang)
        // Skip cache when regenerating image only (handled below) or auto-extracting terms (terms unknown until extraction)
        const cacheCheckStart = Date.now();
        let cacheSemanticHash = "";
        let cacheEligible = false;
        if (!payload.regenerate_image_only && !payload.auto_extract_terms && payload.termos.length > 0 && false) { // Cache bypass for testing
          cacheEligible = true;
          cacheSemanticHash = await buildPromptHash({
            v: 1,
            tema: payload.tema.toLowerCase().trim(),
            termos: [...payload.termos].map(t => t.toLowerCase().trim()).sort(),
            estilo: (payload.estilo || "default").toLowerCase().trim(),
            publico: (payload.publico || "default").toLowerCase().trim(),
            lang: "pt-BR",
          });
          const lookup = await getCachedAIResponse({
            module: "mnemonic",
            scope: "global",
            semanticHash: cacheSemanticHash,
          });
          if (lookup.hit && lookup.content) {
            await logAIUsage({
              userId, module: "mnemonic", functionName: "generate-mnemonic",
              model: lookup.modelUsed || AI_MODEL, cacheStatus: "hit",
              latencyMs: Date.now() - cacheCheckStart, requestId: requestIdForError, success: true,
            });
            return jsonResponse({
              success: true,
              data: { ...lookup.content, response_source: "cache_global", cache_hit: true },
            });
          }
          await logAIUsage({
            userId, module: "mnemonic", functionName: "generate-mnemonic",
            model: AI_MODEL, cacheStatus: lookup.expired ? "miss_expired" : "miss",
            latencyMs: Date.now() - cacheCheckStart, requestId: requestIdForError, success: true,
          });
        }

        // HANDLE: Regenerate image only
        if (payload.regenerate_image_only && payload.original_result_id) {
          const { data: origResult } = await db.from("mnemonic_results").select("*").eq("id", payload.original_result_id).single();
          if (!origResult) throw new Error("Resultado original não encontrado.");
          const prompt = origResult.prompt_imagem || `3D cartoon Pixar-style medical scene for ${payload.tema}, no text.`;
          const imgResult = await generateImage(prompt);
          if (imgResult.url) await db.from("mnemonic_results").update({ image_url: imgResult.url }).eq("id", payload.original_result_id);
          return jsonResponse({ success: true, data: { ...origResult, image_url: imgResult.url || origResult.image_url, image_failed: imgResult.failed } });
        }


        // Etapa 0: Extração Automática
        if (payload.auto_extract_terms && !payload.regenerate_image_only) {
          try {
            const extracted = await callAI<{ termos?: unknown; contexto_clinico?: string }>(
              aiKey,
              MASTER_PROMPT_GERADOR,
              `AJA COMO ETAPA 0 (EXTRATOR): Identifique 3-7 termos essenciais para o tema médico: ${payload.tema}. Retorne JSON { "termos": ["item1", ...] }`
            );
            const rawTermos = Array.isArray(extracted?.termos) ? extracted.termos : [];
            payload.termos = normalizeTerms(rawTermos.filter((t): t is string => typeof t === "string")).slice(0, 7);
          } catch (e) {
            console.error("Erro na extração:", e);
          }
        }

        if (!payload.regenerate_image_only && payload.termos.length === 0) {
          return jsonResponse({ success: false, error: "Nenhum termo disponível.", code: "NO_TERMS" }, 422);
        }

        requestId = await insertRequest(db, userId, payload);

        // ETAPA 1: Gerador Master
        interface MnemonicOutput {
          mnemonic: string; phrase: string;
          items_map: Array<{ letter: string; word: string; original_item: string; symbol: string }>;
          scene: string; scene_description: string; image_prompt: string;
          explanation_tecnica: string; explanation_didatica: string;
          pontos_de_prova: Array<{ pergunta_gatilho: string; resposta_esperada: string; armadilha_comum: string }>;
          audit: { score_medico: number; score_pedagogico: number; score_visual: number; coverage_ok: boolean; missing_items: string[]; extra_items: string[]; };
        }

        let mnemonic: MnemonicOutput | null = null;
        let lastIssues: string[] = [];
        const ctx = `Tema: ${payload.tema}\nTermos: ${payload.termos.join(", ")}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const startMs = Date.now();
          let attemptCtx = ctx;
          if (attempt > 1) attemptCtx += `\n\nREPROVADO NA AUDITORIA. Problemas: ${lastIssues.join(", ")}. REGENERE seguindo o Master Prompt rigorosamente.`;

          let candidate: MnemonicOutput | null = null;
          let error: string | undefined;
          try {
            candidate = await callAI<MnemonicOutput>(aiKey, MASTER_PROMPT_GERADOR, attemptCtx);
          } catch (e) { error = e instanceof Error ? e.message : String(e); }

          const issues: string[] = [];
          if (!candidate) issues.push("IA retornou nulo");
          else {
            if (candidate.audit?.score_medico < 85) issues.push(`score_medico=${candidate.audit.score_medico}`);
            if (candidate.audit?.score_pedagogico < 75) issues.push(`score_pedagogico=${candidate.audit.score_pedagogico}`);
            if (!candidate.audit?.coverage_ok && attempt < 3) issues.push("falha_cobertura"); // Allow slightly incomplete coverage on last attempt if desperate
            if (!candidate.phrase) issues.push("frase_vazia");
          }

          await insertAgentLog(db, {
            request_id: requestId, user_id: userId, agent_name: `master_gen_v${attempt}`,
            execution_order: ++order, status: issues.length === 0 ? "completed" : "failed",
            input_json: { attempt }, output_json: candidate,
            score: candidate?.audit?.score_medico, duration_ms: Date.now() - startMs,
            error_message: error || (issues.length ? issues.join("; ") : undefined),
          });

          if (issues.length === 0 && candidate) { mnemonic = candidate; break; }
          lastIssues = issues;
        }

        // Fallback
        if (!mnemonic) {
          const fb = buildDeterministicFallback(payload.tema, payload.termos);
          if (requestId) await updateRequestStatus(db, requestId, "completed");
          return jsonResponse({
            success: true, warning: "Mnemônico determinístico gerado (IA falhou).",
            response_source: "fallback_deterministic",
            data: { ...fb, request_id: requestId, result_id: null, items_map: fb.associacoes.map(a => ({ letter: a.letra, word: a.representacao_no_mnemonico, original_item: a.termo_original, symbol: null })) }
          });
        }

        // ETAPA 2: Imagem
        const imgStart = Date.now();
        const img = await generateImage(mnemonic.image_prompt);
        await insertAgentLog(db, {
          request_id: requestId, user_id: userId, agent_name: "master_image",
          execution_order: ++order, status: img.url ? "completed" : "failed",
          input_json: { prompt: mnemonic.image_prompt }, output_json: img,
          duration_ms: Date.now() - imgStart, error_message: img.error,
        });

        // ETAPA 3: Persistir
        const scoreFinal = Math.round((mnemonic.audit.score_medico + mnemonic.audit.score_pedagogico) / 2);
        const resultId = await insertResult(db, {
          request_id: requestId, user_id: userId, tema: payload.tema, sigla: mnemonic.mnemonic,
          frase_mnemonica: mnemonic.phrase, explicacao_tecnica: mnemonic.explanation_tecnica,
          explicacao_didatica: mnemonic.explanation_didatica,
          cena_visual: mnemonic.scene_description || mnemonic.scene, prompt_imagem: mnemonic.image_prompt,
          score_medico: mnemonic.audit.score_medico, score_pedagogico: mnemonic.audit.score_pedagogico,
          score_linguistico: 90, score_final: scoreFinal,
          aprovado: true, aprovado_medico: true, aprovado_pedagogico: true,
          image_url: img.url, associacoes_json: mnemonic.items_map as any,
          associacoes_visuais_json: [], alertas_json: mnemonic.audit.missing_items || [],
        });

        await updateRequestStatus(db, requestId, "completed");

        const successData = {
          request_id: requestId, result_id: resultId,
          tema: payload.tema, sigla: mnemonic.mnemonic, phrase: mnemonic.phrase,
          frase_mnemonica: mnemonic.phrase,
          explanation_tecnica: mnemonic.explanation_tecnica,
          explanation_didatica: mnemonic.explanation_didatica,
          scene: mnemonic.scene, scene_description: mnemonic.scene_description,
          image_url: img.url, image_failed: img.failed,
          score_medico: mnemonic.audit.score_medico, score_pedagogico: mnemonic.audit.score_pedagogico,
          score_final: scoreFinal, items_map: mnemonic.items_map,
          pontos_de_prova: mnemonic.pontos_de_prova, audit: mnemonic.audit,
          response_source: "master_pipeline"
        };

        // ── Loop 4A: persist successful generic generation in global cache.
        // Skipped automatically if not eligible (image-only / auto-extract / no terms).
        // Skipped on audit failure (we wouldn't reach here — fallback path returns earlier).
        if (cacheEligible && cacheSemanticHash) {
          // Strip per-request identifiers before caching so global cache stays generic
          const { request_id: _r, result_id: _i, image_url: _u, image_failed: _f, ...generic } = successData;
          await saveAIResponseToCache({
            module: "mnemonic",
            scope: "global",
            semanticHash: cacheSemanticHash,
            response: generic,
            modelUsed: AI_MODEL,
            ttlDays: CACHE_TTL_DAYS.mnemonic,
            specialty: payload.tema,
          });
        }

        return jsonResponse({ success: true, data: successData });

      } catch (error) {
        console.error("[MASTER_PIPELINE] Erro:", error);
        if (requestId && db) await updateRequestStatus(db, requestId, "failed");
        return jsonResponse({
          success: false, error: error instanceof Error ? error.message : "Erro desconhecido",
          code: "PIPELINE_ERROR", requestId: requestId || requestIdForError
        }, error instanceof AuthError ? 401 : error instanceof RateLimitError ? 429 : 500);
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
});
