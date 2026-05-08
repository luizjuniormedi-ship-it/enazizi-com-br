import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══ CONFIG ═══
const AI_MODEL = "openai/gpt-5-mini";
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 1.0, 
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const e = await r.text().catch(() => "?");
      throw new Error(`AI ${r.status}: ${e.substring(0, 300)}`);
    }
    const j = await r.json();
    const c = j?.choices?.[0]?.message?.content;
    if (!c) throw new Error("AI content vazio.");
    const cleaned = c.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`JSON não encontrado: ${c.substring(0, 200)}`);
    return JSON.parse(match[0]) as T;
  } finally { clearTimeout(timer); }
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
Você é o sistema ENAZIZI MASTER — Gerador de Mnemônicos Médicos de Elite.
Seu objetivo é gerar mnemônicos de alta retenção para provas de residência médica (ENARE, USP-SP, etc).

REGRA PRINCIPAL:
NUNCA OMITIR TERMOS. NUNCA TROCAR LETRAS. NUNCA INVENTAR ITENS.
O sistema deve falhar ("fail-closed") se houver qualquer erro de cobertura.

PIPELINE OBRIGATÓRIO (Executar internamente antes de responder):
1. ELIGIBILITY GATE: Validar 3-7 itens, remover duplicados.
2. NORMALIZAÇÃO: Preservar nomenclatura médica oficial.
3. GERADOR CORE: Criar sigla, frase (sujeito+verbo+objeto), associação fonética e cena mental cinematográfica.
4. AUDITOR MÉDICO: Garantir precisão clínica e cobertura 1:1 (Score >= 90).
5. AUDITOR PEDAGÓGICO: Validar retenção e active recall (Score >= 85).
6. AUDITOR LINGUÍSTICO: Português natural, fluidez.
7. GERADOR VISUAL: Criar prompt de imagem Pixar-style (sem texto).
8. AUDITOR VISUAL: Garantir representação de todos os itens.
9. RECONCILIADOR: Mapeamento letra -> termo final.

FORMATO JSON OBRIGATÓRIO:
{
  "mnemonic": "SIGLA",
  "phrase": "Frase natural e memorável",
  "items_map": [
    {
      "letter": "A",
      "word": "Palavra na frase",
      "original_item": "Item original",
      "symbol": "Símbolo visual"
    }
  ],
  "scene": "Título da cena",
  "scene_description": "Descrição detalhada (personagens, ação, impacto)",
  "image_prompt": "Prompt 3D Pixar, vivid, no text",
  "image_url": "",
  "explanation_tecnica": "Explicação para médicos",
  "explanation_didatica": "Explicação Feynman (leiga)",
  "pontos_de_prova": [
    { "pergunta_gatilho": "", "resposta_esperada": "", "armadilha_comum": "" }
  ],
  "audit": {
    "score_medico": 0,
    "score_pedagogico": 0,
    "score_visual": 0,
    "coverage_ok": false,
    "missing_items": [],
    "extra_items": []
  }
}

REGRAS DE BLOQUEIO:
NÃO retorne se: score_medico < 90, score_pedagogico < 85 ou coverage_ok = false.
Caso não consiga atingir os scores, retorne o JSON com coverage_ok = false e descreva o motivo no audit.`;

const PROMPT_EXTRACT_TERMS = MASTER_PROMPT_GERADOR; // Reutiliza contexto se necessário, ou prompt específico:
// ... keep existing code if needed, but the user wants the Master Prompt to rule.


// ═══ PIPELINE ═══

serve(async (req: Request) => {
  const startedAt = Date.now();
  const requestIdForError = crypto.randomUUID();

  try {
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
      }, GLOBAL_TIMEOUT_MS);
    });

    const mainPipeline = async (): Promise<Response> => {
      try {
        const aiKey = requireEnv("LOVABLE_API_KEY");
        let rawBody;
        try {
          rawBody = await req.json();
        } catch {
          return jsonResponse({ success: false, error: "JSON inválido.", code: "INVALID_JSON", requestId: requestIdForError }, 400);
        }
        
        if (!rawBody) throw new Error("Body vazio.");
      console.log(`[MNEMONIC] Payload received: tema=${(rawBody as any)?.tema ?? (rawBody as any)?.topic}, termos=${(rawBody as any)?.termos?.length ?? (rawBody as any)?.items?.length}`);

      const payload = validatePayload(rawBody);
      payload.termos = normalizeTerms(payload.termos);
      payload.tema = payload.tema.trim();

      const userId = await getUserIdFromRequest(req);
      db = getServiceClient();

      // Rate limiting per user
      const rl = await checkRateLimit(db, userId);
      if (!rl.ok) {
        throw new RateLimitError(`Limite de ${rl.limit}/h atingido (plano ${rl.plan}). Aguarde para gerar novos mnemônicos.`);
      }


      // ══════════════════════════════════════
      // ETAPA 0 (NOVA): Extração automática de termos quando não fornecidos
      // ══════════════════════════════════════
      if (payload.auto_extract_terms && !payload.regenerate_image_only) {
        console.log(`[MNEMONIC] ETAPA 0: Extraindo termos automaticamente para "${payload.tema}"`);
        const extractStart = Date.now();
        try {
          const extracted = await callAI<{ termos?: unknown; contexto_clinico?: string; justificativa?: string }>(
            aiKey,
            PROMPT_EXTRACT_TERMS,
            `Tema médico: ${payload.tema}${payload.publico ? `\nPúblico: ${payload.publico}` : ""}`
          );
          const rawTermos = Array.isArray(extracted?.termos) ? extracted.termos : [];
          const cleanTermos = rawTermos
            .filter((t): t is string => typeof t === "string" && !!t.trim())
            .map((t) => t.trim())
            .slice(0, 7);
          if (cleanTermos.length < 3) {
            return jsonResponse({
              success: false,
              error: "Tema muito vago ou não-médico. Forneça um tema mais específico (ex: 'Critérios de Light para derrame pleural').",
              code: "EXTRACTION_FAILED",
              details: extracted?.justificativa || "IA não conseguiu extrair termos suficientes.",
            }, 422);
          }
          payload.termos = normalizeTerms(cleanTermos);
          if (extracted?.contexto_clinico && typeof extracted.contexto_clinico === "string") {
            (payload as any).contexto_clinico = extracted.contexto_clinico.trim();
            console.log(`[MNEMONIC] ETAPA 0: contexto_clinico = ${(payload as any).contexto_clinico}`);
          }
          console.log(`[MNEMONIC] ETAPA 0 OK: ${payload.termos.length} termos extraídos: ${payload.termos.join(", ")}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[MNEMONIC] ETAPA 0 FAILED:", msg);
          return jsonResponse({
            success: false,
            error: "Não foi possível extrair termos do tema. Tente reformular ou seja mais específico.",
            code: "EXTRACTION_FAILED",
            details: msg,
          }, 422);
        }
      }

      // Validação final: precisamos ter termos para o pipeline (exceto regenerate_image_only)
      if (!payload.regenerate_image_only && payload.termos.length === 0) {
        return jsonResponse({
          success: false,
          error: "Nenhum termo disponível para gerar o mnemônico.",
          code: "NO_TERMS",
        }, 422);
      }

      requestId = await insertRequest(db, userId, payload);
      let order = 0;

      // Log da extração (depois do insertRequest para ter o request_id)
      if (payload.auto_extract_terms && requestId) {
        try {
          await insertAgentLog(db, {
            request_id: requestId, user_id: userId,
            agent_name: "gerador",
            execution_order: ++order, status: "completed",
            input_json: { tema: payload.tema, mode: "auto_extract_terms" },
            output_json: { termos_extraidos: payload.termos },
            duration_ms: 0,
          });
        } catch { /* non-critical */ }
      }

      const contextoClinico = (payload as any).contexto_clinico as string | undefined;
      const ctx = `Tema: ${payload.tema}${contextoClinico ? `\nContexto clínico: ${contextoClinico}` : ""}\nTermos (TODOS devem estar no mnemônico):\n${payload.termos.map((t, i) => `${i + 1}. ${t}`).join("\n")}${payload.estilo ? `\nEstilo preferido: ${payload.estilo}` : ""}${payload.publico ? `\nPúblico: ${payload.publico}` : ""}`;

      // ══════════════════════════════════════
      // HANDLE: Regenerate image only
      // ══════════════════════════════════════
      if (payload.regenerate_image_only && payload.original_result_id) {
        const { data: origResult } = await db.from("mnemonic_results")
          .select("*").eq("id", payload.original_result_id).single();
        
        if (!origResult) throw new Error("Resultado original não encontrado.");

        const promptImagem = origResult.prompt_imagem || `3D cartoon Pixar-style medical memory scene for ${payload.tema}, vibrant colors, clean background, no text, no labels.`;
        
        console.log("[MNEMONIC] Regenerating image only");
        const imgStart = Date.now();
        const imgResult = await generateImage(promptImagem);
        await insertAgentLog(db, {
          request_id: requestId, user_id: userId, agent_name: "gerador_imagem",
          execution_order: ++order, status: imgResult.url ? "completed" : "failed",
          input_json: { prompt: promptImagem.substring(0, 500) },
          output_json: { image_url: imgResult.url, error: imgResult.error },
          duration_ms: Date.now() - imgStart, error_message: imgResult.error,
        });

        // Update original result with new image
        if (imgResult.url) {
          await db.from("mnemonic_results").update({ image_url: imgResult.url, updated_at: new Date().toISOString() }).eq("id", payload.original_result_id);
        }

        await updateRequestStatus(db, requestId, "completed");

        return jsonResponse({
          success: true,
          data: {
            request_id: requestId,
            result_id: payload.original_result_id,
            tema: origResult.tema,
            sigla: origResult.sigla,
            frase_mnemonica: origResult.frase_mnemonica,
            explicacao_tecnica: origResult.explicacao_tecnica,
            explicacao_didatica: origResult.explicacao_didatica,
            explicacao_associacao: origResult.explicacao_didatica,
            cena_visual: origResult.cena_visual,
            prompt_imagem: origResult.prompt_imagem,
            image_url: imgResult.url ?? origResult.image_url,
            image_failed: imgResult.failed,
            score_medico: origResult.score_medico,
            score_pedagogico: origResult.score_pedagogico,
            score_linguistico: origResult.score_linguistico ?? 0,
            score_final: origResult.score_final,
            alertas: origResult.alertas_json ?? [],
            items_map: [],
            associacoes: origResult.associacoes_json ?? [],
            associacoes_visuais: origResult.associacoes_visuais_json ?? [],
          },
        });
      }

      // ══════════════════════════════════════
      // ETAPA 1: Gerar mnemônico MASTER — até 3 tentativas
      // ══════════════════════════════════════
      interface MnemonicOutput {
        mnemonic: string;
        phrase: string;
        items_map: Array<{ letter: string; word: string; original_item: string; symbol: string }>;
        scene: string;
        scene_description: string;
        image_prompt: string;
        image_url?: string;
        explanation_tecnica: string;
        explanation_didatica: string;
        pontos_de_prova: Array<{ pergunta_gatilho: string; resposta_esperada: string; armadilha_comum: string }>;
        audit: {
          score_medico: number;
          score_pedagogico: number;
          score_visual: number;
          coverage_ok: boolean;
          missing_items: string[];
          extra_items: string[];
        };
      }

      function validateMnemonic(m: MnemonicOutput | null): string[] {
        const issues: string[] = [];
        if (!m) { issues.push("resposta_vazia"); return issues; }
        if (!m.audit) { issues.push("audit_missing"); return issues; }
        
        // Regras de Bloqueio do Master Prompt
        if (m.audit.score_medico < 90) issues.push(`score_medico_insuficiente (${m.audit.score_medico})`);
        if (m.audit.score_pedagogico < 85) issues.push(`score_pedagogico_insuficiente (${m.audit.score_pedagogico})`);
        if (!m.audit.coverage_ok) issues.push("coverage_failure");
        if (m.audit.missing_items?.length > 0) issues.push(`missing_terms: ${m.audit.missing_items.join(", ")}`);
        
        if (!m.phrase || m.phrase.length < 10) issues.push("phrase_too_short");
        if (!m.mnemonic) issues.push("mnemonic_missing");
        
        return issues;
      }

      console.log("[MNEMONIC] ETAPA 1: Gerando mnemônico MASTER (loop até 3 tentativas)...");
      let mnemonic: MnemonicOutput | null = null;
      let lastIssues: string[] = [];
      let lastVersion: MnemonicOutput | null = null;
      const MAX_ATTEMPTS = 3;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const startMs = Date.now();
        let attemptCtx = ctx;
        
        if (attempt > 1 && lastVersion) {
          attemptCtx = `${ctx}\n\n⚠️ TENTATIVA ${attempt}/${MAX_ATTEMPTS}. A anterior falhou.\nPROBLEMAS: ${lastIssues.join("; ")}\n\nPOR FAVOR, CORRIJA: Garanta que TODOS os itens originais estejam presentes na frase e no mapeamento. Melhore os scores médico (>=90) e pedagógico (>=85). Use o formato JSON estrito.`;
        }

        let candidate: MnemonicOutput | null = null;
        let errMsg: string | undefined;
        try {
          candidate = await callAI<MnemonicOutput>(aiKey, MASTER_PROMPT_GERADOR, attemptCtx);
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e);
        }

        const issues = validateMnemonic(candidate);
        const isValid = issues.length === 0 && !errMsg;

        await insertAgentLog(db, {
          request_id: requestId, user_id: userId,
          agent_name: attempt === 1 ? "gerador_master" : `retry_master_${attempt}`,
          execution_order: ++order,
          status: isValid ? "completed" : "failed",
          input_json: { attempt, payload_summary: { tema: payload.tema, terms_count: payload.termos.length } },
          output_json: candidate,
          score: candidate?.audit?.score_medico,
          duration_ms: Date.now() - startMs,
          error_message: errMsg ?? (issues.length ? `Auditoria falhou: ${issues.join(", ")}` : undefined),
        });

        if (isValid && candidate) {
          mnemonic = candidate;
          break;
        }
        lastIssues = issues;
        lastVersion = candidate;
      }

      if (!mnemonic) {
        console.warn("[MNEMONIC] Pipeline Master falhou após 3 tentativas. Usando fallback.");
        const fb = buildDeterministicFallback(payload.tema, payload.termos);
        if (requestId) await updateRequestStatus(db, requestId, "completed");
        
        return jsonResponse({
          success: true,
          warning: "Mnemônico simples gerado sem IA.",
          response_source: "fallback_deterministic",
          data: {
            request_id: requestId,
            result_id: null,
            tema: payload.tema,
            sigla: fb.sigla,
            frase_mnemonica: fb.frase_mnemonica,
            explicacao_didatica: fb.explicacao_didatica,
            explicacao_tecnica: fb.explicacao_tecnica,
            cena_visual: fb.cena_visual,
            prompt_imagem: "",
            image_url: null,
            image_failed: true,
            score_medico: 50, score_pedagogico: 50, score_final: 50,
            associacoes: fb.associacoes,
            items_map: fb.associacoes.map(a => ({
              letter: a.letra, word: a.representacao_no_mnemonico,
              original_item: a.termo_original, symbol: null
            })),
            pontos_de_prova: [],
            response_source: "fallback_deterministic",
          },
        });
      }


      // ══════════════════════════════════════
      // Cena visual e prompt de imagem agora vêm do ETAPA 1
      // ══════════════════════════════════════
      const cenaVisual = mnemonic.cena_visual || `Cena visual para "${mnemonic.frase_mnemonica}" — imagine os elementos do mnemônico interagindo de forma memorável.`;
      const promptImagem = mnemonic.prompt_imagem || `3D cartoon Pixar-style, vibrant colors, clean background, no text, no labels, no letters, no words. Medical memory scene representing "${mnemonic.sigla || mnemonic.frase_mnemonica}" with expressive characters in dynamic action.`;

      // ══════════════════════════════════════
      // ETAPA 3: Gerar imagem
      // ══════════════════════════════════════
      console.log("[MNEMONIC] ETAPA 2: Gerando imagem...");
      const imgStartMs = Date.now();
      let imageUrl: string | null = null;
      let imageFailed = false;
      try {
        const imgResult = await generateImage(promptImagem);
        imageUrl = imgResult.url;
        imageFailed = imgResult.failed;
        await insertAgentLog(db, {
          request_id: requestId, user_id: userId, agent_name: "gerador_imagem",
          execution_order: ++order, status: imageUrl ? "completed" : "failed",
          input_json: { prompt: promptImagem.substring(0, 500) },
          output_json: { image_url: imageUrl, error: imgResult.error },
          duration_ms: Date.now() - imgStartMs, error_message: imgResult.error,
        });
      } catch (e) {
        imageFailed = true;
        await insertAgentLog(db, {
          request_id: requestId, user_id: userId, agent_name: "gerador_imagem",
          execution_order: ++order, status: "failed",
          input_json: { prompt: promptImagem.substring(0, 500) },
          output_json: null, duration_ms: Date.now() - imgStartMs,
          error_message: e instanceof Error ? e.message : String(e),
        });
      }

      // ══════════════════════════════════════
      // ETAPA 3: Pontos de prova (preferir os já gerados na ETAPA 2)
      // ══════════════════════════════════════
      let pontosDeProva: Array<{ pergunta_gatilho: string; resposta_esperada: string; armadilha_comum: string }> = [];
      if (Array.isArray(mnemonic.pontos_prova) && mnemonic.pontos_prova.length > 0) {
        pontosDeProva = mnemonic.pontos_prova
          .filter((p: any) => p && (p.pergunta || p.resposta))
          .map((p: any) => ({
            pergunta_gatilho: String(p.pergunta || "").trim(),
            resposta_esperada: String(p.resposta || "").trim(),
            armadilha_comum: String(p.armadilha || "").trim(),
          }));
      }
      if (pontosDeProva.length === 0) {
        try {
          const examCtx = `Tema: ${payload.tema}\nTermos: ${payload.termos.join(", ")}`;
          const examResult = await callAI<{ pontos_de_prova: typeof pontosDeProva }>(aiKey, PROMPT_EXAM_POINTS, examCtx);
          pontosDeProva = examResult.pontos_de_prova ?? [];
        } catch { /* non-critical */ }
      }

      // ══════════════════════════════════════
      // SCORES (simplified)
      // ══════════════════════════════════════
      const scoreMnemonic = Math.min(100, Math.max(0, mnemonic.score_autoavaliacao || 75));
      const scoreVisual = cenaVisual ? 80 : 50;
      const scoreFinal = Math.round((scoreMnemonic * 0.6 + scoreVisual * 0.2 + (imageUrl ? 100 : 0) * 0.2));

      // ══════════════════════════════════════
      // PERSIST — só itens REAIS de associação (sem fake termo→termo)
      // ══════════════════════════════════════
      const associacoes = Array.isArray(mnemonic.associacoes)
        ? mnemonic.associacoes.filter(a =>
            a && typeof a === "object" &&
            String(a.termo_original || "").trim() &&
            String(a.representacao_no_mnemonico || "").trim() &&
            String(a.representacao_no_mnemonico).trim().toLowerCase() !== String(a.termo_original).trim().toLowerCase()
          )
        : [];

      // items_map só é construído a partir de associações REAIS (não inventado dos termos)
      const itemsMap = associacoes.map((a: any) => ({
        letter: String(a.representacao_no_mnemonico || "").trim().charAt(0).toUpperCase(),
        word: String(a.representacao_no_mnemonico || "").trim(),
        original_item: String(a.termo_original || "").trim(),
        symbol: null, symbol_reason: null,
      }));

      const explicacaoAssoc = (mnemonic.explicacao_associacao || mnemonic.explicacao_didatica || "").trim();
      const explicacaoDid = (mnemonic.explicacao_didatica || mnemonic.explicacao_associacao || "").trim();

      // ══════════════════════════════════════
      // VALIDAÇÃO FINAL antes de persistir (defesa em profundidade)
      // ══════════════════════════════════════
      const finalIssues: string[] = [];
      if (!mnemonic.frase_mnemonica?.trim() || mnemonic.frase_mnemonica.trim().length < 8) finalIssues.push("frase_invalida");
      const finalSentenceAnalysis = analyzeMnemonicSentence(mnemonic.frase_mnemonica || "", payload.termos);
      if (!finalSentenceAnalysis.hasVerb) finalIssues.push("frase_sem_verbo");
      if (finalSentenceAnalysis.glueCount === 0 || finalSentenceAnalysis.looksTelegraphic) finalIssues.push("frase_sem_logica");
      if (!explicacaoAssoc || explicacaoAssoc.length < 20) finalIssues.push("explicacao_invalida");
      if (!cenaVisual?.trim() || cenaVisual.trim().length < 12) finalIssues.push("cena_invalida");
      if (finalIssues.length > 0) {
        console.error("[MNEMONIC] FINAL VALIDATION FAILED:", finalIssues);
        if (requestId) { try { await updateRequestStatus(db, requestId, "failed"); } catch {} }
        return jsonResponse({
          success: false,
          error: "Resultado gerado não passou na validação final.",
          code: "GENERATION_FAILED",
          details: finalIssues.join(", "),
        }, 422);
      }

      const resultId = await insertResult(db, {
        request_id: requestId, user_id: userId, tema: payload.tema,
        sigla: mnemonic.sigla || "",
        frase_mnemonica: mnemonic.frase_mnemonica,
        explicacao_tecnica: mnemonic.explicacao_tecnica,
        explicacao_didatica: explicacaoDid,
        cena_visual: cenaVisual, prompt_imagem: promptImagem,
        score_medico: scoreMnemonic, score_pedagogico: scoreMnemonic,
        score_linguistico: scoreMnemonic, score_final: scoreFinal,
        aprovado: scoreMnemonic >= 70, aprovado_medico: true, aprovado_pedagogico: scoreMnemonic >= 70,
        image_url: imageUrl, associacoes_json: associacoes, associacoes_visuais_json: [],
        alertas_json: imageFailed ? ["Imagem não foi gerada — use 'Regenerar imagem'"] : [],
      });

      await updateRequestStatus(db, requestId, "completed");

      return jsonResponse({
        success: true,
        data: {
          request_id: requestId,
          result_id: resultId,
          tema: payload.tema,
          sigla: mnemonic.sigla || "",
          frase_mnemonica: mnemonic.frase_mnemonica,
          explicacao_clinica: mnemonic.explicacao_clinica || explicacaoDid,
          explicacao_associacao: explicacaoAssoc,
          explicacao_tecnica: mnemonic.explicacao_tecnica,
          explicacao_didatica: explicacaoDid,
          cena_visual: cenaVisual,
          cena_visual_obj: mnemonic.cena_visual_obj ?? null,
          prompt_imagem: promptImagem,
          image_url: imageUrl,
          image_failed: imageFailed,
          score_medico: scoreMnemonic,
          score_pedagogico: scoreMnemonic,
          score_linguistico: scoreMnemonic,
          score_final: scoreFinal,
          quality_flag: scoreFinal >= 80 ? "high" : scoreFinal >= 60 ? "medium" : "low",
          alertas: imageFailed ? ["Imagem não foi gerada — use 'Regenerar imagem'"] : [],
          items_map: itemsMap,
          associacoes,
          mapa_associacao: associacoes.map((a: any) => ({
            termo_original: a.termo_original,
            representacao: a.representacao_no_mnemonico,
            explicacao: a.explicacao || "",
          })),
          associacoes_visuais: [],
          pontos_de_prova: pontosDeProva,
          pontos_prova: pontosDeProva,
        },
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro interno.";
      console.error("[MNEMONIC] FAILED:", msg);

      if (error instanceof AuthError) {
        return jsonResponse({
          success: false,
          error: "Faça login para gerar mnemônicos.",
          message: "Faça login para gerar mnemônicos.",
          code: "UNAUTHORIZED",
          requestId: requestIdForError,
        }, 401);
      }
      if (error instanceof RateLimitError) {
        return jsonResponse({
          success: false,
          error: msg,
          message: msg,
          code: "RATE_LIMIT",
          requestId: requestIdForError,
        }, 429);
      }

      if (requestId && db) { try { await updateRequestStatus(db, requestId, "failed"); } catch {} }
      return jsonResponse({
        success: false,
        error: "Não foi possível gerar o mnemônico agora. Tente novamente.",
        code: "MNEMONIC_RUNTIME_ERROR",
        message: "Não foi possível gerar o mnemônico agora. Tente novamente.",
        requestId: requestId || requestIdForError,
        details: msg,
      }, 500);
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
