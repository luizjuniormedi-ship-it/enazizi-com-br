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

async function getUserIdFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Token ausente.");
  const sb = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Autenticação falhou.");
  return data.user.id;
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

const PROMPT_MNEMONIC = `Você é o núcleo oficial de geração de mnemônicos do ENAZIZI.
Você é um sistema avançado de memorização médica de alta retenção.

🎯 MISSÃO: Transformar conteúdos médicos em mnemônicos visuais e lógicos.

🚨 REGRAS DE OURO (SISTEMA MESTRE):
1. COBERTURA 1:1: Cada item fornecido DEVE ter uma correspondência clara na frase.
2. FRASE LÓGICA (OBRIGATÓRIO): A frase NÃO pode ser apenas uma lista de palavras. Ela DEVE ser uma micro-história com SUJEITO, VERBO e COMPLEMENTO.
   - Ruim: "Febre, Tosse, Dispneia"
   - Bom: "O paciente tem FEBRE, TOSSE e sente DISPNEIA"
3. NATURALIDADE: Use Português do Brasil fluído. Evite frases telegráficas ou robóticas.
4. MEMORABILIDADE: Crie cenas inusitadas, engraçadas ou dramáticas.

Retorne SOMENTE JSON:
{
  "sigla": "SIGLA (curta)",
  "frase_mnemonica": "Frase completa e natural com verbos",
  "explicacao_didatica": "Como memorizar a frase",
  "explicacao_tecnica": "Importância clínica dos itens",
  "cena_visual": "Descrição da cena (sujeito + ação + ambiente)",
  "prompt_imagem": "Prompt 3D Pixar style, vivid colors, no text",
  "associacoes": [
    { "termo": "item original", "simbolo": "representação na frase", "explicacao": "por que um lembra o outro" }
  ],
  "score_autoavaliacao": 100,
  "problemas_detectados": []
}`;


const PROMPT_EXAM_POINTS = `Você é especialista em provas de residência médica brasileira.

Dado o tema e os termos, crie 2-3 pontos de prova rápidos para revisão.

Retorne SOMENTE JSON:
{
  "pontos_de_prova": [
    {
      "pergunta_gatilho": "pergunta direta de prova",
      "resposta_esperada": "resposta correta curta",
      "armadilha_comum": "erro frequente em provas"
    }
  ]
}`;

// ═══ NOVO: PROMPT DE EXTRAÇÃO AUTOMÁTICA DE TERMOS ═══
const PROMPT_EXTRACT_TERMS = `Você é um especialista em Medicina e neuro-memorização do ENAZIZI.

Identifique de 3 a 7 termos essenciais para o tema médico fornecido, priorizando sinais clássicos, critérios diagnósticos e achados de prova.

REGRAS:
- Curto e claro (1-4 palavras)
- Sem redundância
- Sem itens genéricos (exames, conduta, investigar)

Retorne SOMENTE JSON:
{
  "termos": ["Termo 1", "Termo 2", "..."],
  "contexto_clinico": "Tipo + descrição curta",
  "justificativa": "Por que esses termos caem em prova"
}`;

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
      // ETAPA 1: Gerar mnemônico (texto) — até 3 tentativas com validação
      // ══════════════════════════════════════
      interface MnemonicOutput {
        sigla: string; frase_mnemonica: string;
        explicacao_associacao?: string;
        explicacao_clinica?: string;
        explicacao_didatica: string; explicacao_tecnica: string;
        cena_visual: string;
        cena_visual_obj?: { descricao?: string; personagens?: string; acao?: string; emocao?: string };
        prompt_imagem: string;
        associacoes: Array<{ termo_original: string; representacao_no_mnemonico: string; explicacao?: string }>;
        mapa_associacao?: Array<{ termo_original: string; representacao: string; explicacao?: string }>;
        pontos_prova?: Array<{ pergunta: string; resposta: string; armadilha: string }>;
        score_autoavaliacao: number; problemas_detectados: string[];
      }

      // Normaliza o novo schema (4 etapas) para o formato interno do pipeline
      function normalizeMnemonic(raw: any): MnemonicOutput | null {
        if (!raw || typeof raw !== "object") return null;
        const m: any = { ...raw };

        // cena_neuro_memoravel (novo schema) -> cena_visual
        if (m.cena_neuro_memoravel && typeof m.cena_neuro_memoravel === "object" && !m.cena_visual) {
          const cv = m.cena_neuro_memoravel;
          const norm = {
            descricao: cv.descricao,
            personagens: cv.personagem ?? cv.personagens,
            acao: cv.acao,
            emocao: cv.emocao,
          };
          const parts = [norm.descricao, norm.personagens, norm.acao, norm.emocao]
            .filter((v: any) => typeof v === "string" && v.trim());
          m.cena_visual_obj = norm;
          m.cena_visual = parts.join(" — ");
        }

        // cena_visual pode vir como objeto { descricao, personagens, acao, emocao }
        if (m.cena_visual && typeof m.cena_visual === "object") {
          const cv = m.cena_visual;
          const parts = [cv.descricao, cv.personagens ?? cv.personagem, cv.acao, cv.emocao]
            .filter((v: any) => typeof v === "string" && v.trim());
          m.cena_visual_obj = cv;
          m.cena_visual = parts.join(" — ");
        }

        // associacoes pode vir no novo formato { termo, simbolo, explicacao }
        if (Array.isArray(m.associacoes) && m.associacoes.length > 0 && m.associacoes.some((a: any) => a?.termo || a?.simbolo)) {
          m.associacoes = m.associacoes.map((a: any) => ({
            termo_original: a?.termo_original ?? a?.termo ?? "",
            representacao_no_mnemonico: a?.representacao_no_mnemonico ?? a?.simbolo ?? a?.representacao ?? "",
            explicacao: a?.explicacao ?? "",
          }));
        }

        // mapa_associacao -> associacoes (compat)
        if (Array.isArray(m.mapa_associacao) && (!Array.isArray(m.associacoes) || m.associacoes.length === 0)) {
          m.associacoes = m.mapa_associacao.map((a: any) => ({
            termo_original: a?.termo_original ?? a?.termo ?? "",
            representacao_no_mnemonico: a?.representacao ?? a?.representacao_no_mnemonico ?? a?.simbolo ?? "",
            explicacao: a?.explicacao ?? "",
          }));
        }

        // explicacao_associacao: derivar de explicacao / explicacao_clinica / associacoes
        if (!m.explicacao_associacao || !String(m.explicacao_associacao).trim()) {
          if (m.explicacao && String(m.explicacao).trim()) {
            m.explicacao_associacao = String(m.explicacao).trim();
          } else if (m.explicacao_clinica && String(m.explicacao_clinica).trim()) {
            m.explicacao_associacao = String(m.explicacao_clinica).trim();
          } else if (Array.isArray(m.associacoes) && m.associacoes.length) {
            m.explicacao_associacao = m.associacoes
              .map((a: any) => `${a.termo_original}: ${a.representacao_no_mnemonico}${a.explicacao ? ` — ${a.explicacao}` : ""}`)
              .join("\n");
          }
        }

        // explicacao_didatica fallback
        if (!m.explicacao_didatica || !String(m.explicacao_didatica).trim()) {
          m.explicacao_didatica = m.explicacao_clinica || m.explicacao || m.explicacao_associacao || "";
        }

        // explicacao_tecnica fallback (evita falhar validação no novo schema enxuto)
        if (!m.explicacao_tecnica || !String(m.explicacao_tecnica).trim()) {
          m.explicacao_tecnica = m.explicacao_clinica || m.explicacao || m.explicacao_didatica || "";
        }

        return m as MnemonicOutput;
      }

      function normalizeForAnalysis(text: string): string {
        return text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      }

      const SENTENCE_GLUE_WORDS = new Set([
        "o", "a", "os", "as", "um", "uma", "uns", "umas",
        "de", "do", "da", "dos", "das", "no", "na", "nos", "nas",
        "em", "com", "sem", "por", "para", "pra", "pro", "e", "que",
        "se", "ao", "aos", "como", "quando", "porque", "mas", "so", "sob",
      ]);

      const COMMON_SUBJECT_HINTS = new Set([
        "paciente", "medico", "medica", "residente", "plantonista", "enfermeira",
        "hospital", "ambulancia", "pulmao", "coracao", "cerebro", "figado", "rim",
        "pleura", "crianca", "idoso", "idosa", "bebe", "monstro", "orgão", "orgao",
      ]);

      const COMMON_PORTUGUESE_VERBS = [
        /\b(e|eh|esta|estao|estava|estavam|foi|foram|fica|ficou|ficaram|tem|teve|tinham?)\b/,
        /\b(chega|chegou|chegam|entra|entrou|entram|sai|saiu|saem|corre|correu|correm|cai|caiu|caem)\b/,
        /\b(grita|gritou|gritam|berra|berrou|berram|chora|chorou|choram|ri|riu|riram|desmaia|desmaiou)\b/,
        /\b(implode|implodiu|explode|explodiu|queima|queimou|sangra|sangrou|incha|inchou|trava|travou)\b/,
        /\b(vira|virou|viram|mostra|mostrou|mostram|pede|pediu|pedem|leva|levou|levam|salva|salvou|salvam)\b/,
        /\b(derrama|derramou|derramam|vomita|vomitou|vomitam|bate|bateu|batem|segura|segurou|seguram)\b/,
        /\b(acende|acendeu|acendem|apaga|apagou|apagam|abre|abriu|abrem|fecha|fechou|fecham|parece|pareceu)\b/,
        /\b(chama|chamou|chamam|empurra|empurrou|empurram|puxa|puxou|puxam|socorre|socorreu|socorrem)\b/,
      ];

      function analyzeMnemonicSentence(frase: string, termos: string[]) {
        const normalizedPhrase = normalizeForAnalysis(frase);
        const tokens = normalizedPhrase.match(/[a-z0-9]+/g) ?? [];
        const termTokens = new Set(
          termos
            .map((termo) => normalizeForAnalysis(termo))
            .flatMap((termo) => termo.split(/\s+/).filter(Boolean))
        );
        const glueCount = tokens.filter((token) => SENTENCE_GLUE_WORDS.has(token)).length;
        const nonTermTokens = tokens.filter((token) => !termTokens.has(token));
        const uniqueNonTermCount = new Set(nonTermTokens).size;
        const hasVerb = COMMON_PORTUGUESE_VERBS.some((pattern) => pattern.test(normalizedPhrase))
          || /\b[a-z]{3,}(ou|eu|iu|ava|avam|aram|eram|iram|ando|endo|indo)\b/.test(normalizedPhrase);
        const hasSubjectHint = tokens.some((token) => COMMON_SUBJECT_HINTS.has(token));
        const termTokenRatio = tokens.length === 0
          ? 1
          : tokens.filter((token) => termTokens.has(token)).length / tokens.length;
        const looksTelegraphic = (glueCount === 0 && !hasVerb)
          || (termTokenRatio >= 0.6 && !hasVerb)
          || (/[,;:/\-]/.test(frase) && glueCount === 0);

        return {
          tokenCount: tokens.length,
          glueCount,
          hasVerb,
          hasSubjectHint,
          uniqueNonTermCount,
          termTokenRatio,
          looksTelegraphic,
        };
      }

      const ISSUE_MESSAGES: Record<string, string> = {
        resposta_vazia: "a IA não retornou um mnemônico utilizável",
        frase_vazia: "a frase veio vazia",
        frase_curta_demais: "a frase ficou curta demais",
        frase_sem_contexto: "a frase está curta demais para formar uma cena lógica",
        frase_sem_verbo: "a frase não tem verbo ou ação explícita",
        frase_sem_conexao_logica: "a frase não tem conectivos e parece palavras soltas",
        frase_pouco_natural: "a frase continua artificial e sem naturalidade",
        frase_parece_lista: "a frase parece lista ou frase telegráfica, sem lógica narrativa",
        explicacao_associacao_ausente: "faltou explicação de associação",
        explicacao_curta_demais: "a explicação ficou curta demais",
        explicacao_tecnica_ausente: "faltou explicação técnica",
        eco_literal_termos: "a frase ecoa literalmente os termos",
        frase_so_repete_termos: "a frase só repete os termos",
        placeholder_detectado: "a saída parece placeholder ou texto genérico",
        score_zero: "a autoavaliação veio zerada",
      };

      function describeIssues(issues: string[]): string {
        return issues.map((issue) => ISSUE_MESSAGES[issue] ?? issue).join("; ");
      }

      // Validação dura: frase sem sentido (regras do usuário)
      function fraseSemSentido(frase: string): boolean {
        if (!frase) return true;
        const words = frase.trim().split(/\s+/);
        if (words.length < 6) return true;
        const hasVerb =
          /\b(é|está|estão|estava|era|foi|foram|tem|tinha|sente|sentiu|aperta|apertou|dói|doe|escorre|corre|correu|irradia|irradiou|aponta|apontou|grita|gritou|dispara|disparou|sofre|sofreu|padece|padeceu|queima|queimou|desce|desceu|sobe|subiu|chega|chegou|cai|caiu|vira|virou|chora|chorou|berrou|berra|explode|explodiu|colapsa|colapsou|para|parou|salva|salvou|leva|levou|mostra|mostrou|abre|abriu|fecha|fechou|chama|chamou|avisa|avisou|toma|tomou|usa|usou|faz|fez|gera|gerou|causa|causou)\b/i.test(frase);
        if (!hasVerb) return true;
        if (/[,:;]{2,}/.test(frase)) return true;
        return false;
      }

      // Validador interno de qualidade
      function validateMnemonic(m: MnemonicOutput | null, termos: string[]): string[] {
        const issues: string[] = [];
        if (!m) { issues.push("resposta_vazia"); return issues; }
        const frase = (m.frase_mnemonica || "").trim();
        const expAssoc = (m.explicacao_associacao || "").trim();
        const expDid = (m.explicacao_didatica || "").trim();
        if (!frase) issues.push("frase_vazia");
        else if (frase.length < 8) issues.push("frase_curta_demais");
        if (!expAssoc && !expDid) issues.push("explicacao_associacao_ausente");
        else if ((expAssoc || expDid).length < 20) issues.push("explicacao_curta_demais");
        if (!(m.explicacao_tecnica || "").trim()) issues.push("explicacao_tecnica_ausente");
        // Eco literal: frase é apenas a junção dos termos
        const fraseLow = frase.toLowerCase();
        const termosLow = termos.map(t => t.toLowerCase().trim());
        const joined = termosLow.join(" ").trim();
        if (fraseLow === joined || fraseLow === termosLow.join(", ")) issues.push("eco_literal_termos");
        // Eco token: todos os tokens da frase são termos de entrada (frase = só lista de termos)
        const fraseTokens = fraseLow.split(/\s+/).filter(Boolean);
        const termTokens = new Set(termosLow.flatMap(t => t.split(/\s+/).filter(Boolean)));
        const nonEcho = fraseTokens.filter(tok => !termTokens.has(tok));
        if (fraseTokens.length > 0 && nonEcho.length === 0) issues.push("frase_so_repete_termos");
        const sentenceAnalysis = analyzeMnemonicSentence(frase, termos);
        if (sentenceAnalysis.tokenCount < 5) issues.push("frase_sem_contexto");
        if (!sentenceAnalysis.hasVerb) issues.push("frase_sem_verbo");
        if (sentenceAnalysis.glueCount === 0) issues.push("frase_sem_conexao_logica");
        if (sentenceAnalysis.uniqueNonTermCount < 3) issues.push("frase_pouco_natural");
        if (sentenceAnalysis.looksTelegraphic || (!sentenceAnalysis.hasSubjectHint && sentenceAnalysis.glueCount === 0)) {
          issues.push("frase_parece_lista");
        }
        if (fraseSemSentido(frase)) issues.push("frase_parece_lista");
        // Placeholders óbvios
        if (/lorem ipsum|placeholder|exemplo gen|tente novamente/i.test(frase + " " + expDid + " " + expAssoc)) issues.push("placeholder_detectado");
        // Score
        const score = Number(m.score_autoavaliacao || 0);
        if (score <= 0) issues.push("score_zero");
        return issues;
      }

      console.log("[MNEMONIC] ETAPA 1: Gerando mnemônico (loop até 3 tentativas)...");
      let mnemonic: MnemonicOutput | null = null;
      let lastIssues: string[] = [];
      let lastVersion: MnemonicOutput | null = null;
      const MAX_ATTEMPTS = 3;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const startMs = Date.now();
        let attemptCtx = ctx;
        if (attempt === 2 && lastVersion) {
          attemptCtx = `${ctx}\n\n⚠️ TENTATIVA ${attempt}/${MAX_ATTEMPTS}. A versão anterior falhou na validação.\nProblemas: ${describeIssues(lastIssues)}\nVersão anterior: "${lastVersion.frase_mnemonica}"\n\nREFAÇA com estas exigências DURA: a frase precisa ser uma micro-história completa com sujeito + verbo + consequência. Ela deve soar natural quando lida isoladamente, como uma cena de plantão ou meme clínico. NÃO repita literalmente os termos. NÃO escreva frase telegráfica.`;
        } else if (attempt === 3) {
          attemptCtx = `${ctx}\n\n⚠️ ÚLTIMA TENTATIVA (${attempt}/${MAX_ATTEMPTS}). As tentativas anteriores falharam.\nProblemas detectados: ${describeIssues(lastIssues)}\n\nFOQUE NO ESSENCIAL:\n- Crie UMA FRASE CURTA E FORTE (6-12 palavras), sempre com sujeito + verbo + consequência\n- A sigla pode existir, mas NÃO substitui a frase lógica\n- Português brasileiro natural, falável, com ritmo\n- A frase deve funcionar sozinha como cena compreensível\n- Explicação didática clara e direta\n- Cena visual simples mas marcante`;
        }

        let candidate: MnemonicOutput | null = null;
        let errMsg: string | undefined;
        try {
          const raw = await callAI<any>(aiKey, PROMPT_MNEMONIC, attemptCtx);
          candidate = normalizeMnemonic(raw);
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e);
        }

        const issues = validateMnemonic(candidate, payload.termos);
        const isValid = issues.length === 0 && !errMsg;

        await insertAgentLog(db, {
          request_id: requestId, user_id: userId,
          agent_name: attempt === 1 ? "gerador" : "retry_gerador",
          execution_order: ++order,
          status: isValid ? "completed" : "failed",
          input_json: { attempt, prompt: attemptCtx.substring(0, 500) },
          output_json: { ...candidate, _attempt: attempt, _issues: issues },
          score: candidate?.score_autoavaliacao,
          duration_ms: Date.now() - startMs,
          error_message: errMsg ?? (issues.length ? `Validação falhou: ${issues.join(", ")}` : undefined),
        });

        console.log(`[MNEMONIC] Tentativa ${attempt}: ${isValid ? "✓ VÁLIDA" : "✗ INVÁLIDA"} — issues=[${issues.join(", ")}]${errMsg ? ` err=${errMsg}` : ""}`);

        if (isValid && candidate) {
          mnemonic = candidate;
          break;
        }
        lastIssues = issues;
        if (candidate) lastVersion = candidate;
      }

      if (!mnemonic) {
        if (requestId) { try { await updateRequestStatus(db, requestId, "failed"); } catch {} }
        return jsonResponse({
          success: false,
          error: "Não foi possível gerar um mnemônico válido após 3 tentativas. Tente novamente.",
          code: "GENERATION_FAILED",
          details: lastIssues.join(", "),
        }, 422);
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
      if (requestId && db) { try { await updateRequestStatus(db, requestId, "failed"); } catch {} }
      // NUNCA retornar fallback fake como sucesso
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
