import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══ CONFIG ═══
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const GLOBAL_TIMEOUT_MS = 45_000;
const AGENT_TIMEOUT_MS = 30_000;

// ═══ TYPES ═══
interface MnemonicRequest { tema: string; termos: string[]; estilo?: string; publico?: string; regenerate_image_only?: boolean; original_result_id?: string; }

// ═══ HELPERS ═══
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function requireEnv(name: string): string { const v = Deno.env.get(name); if (!v) throw new Error(`Env ${name} missing`); return v; }

function validatePayload(body: unknown): MnemonicRequest {
  if (!body || typeof body !== "object") throw new Error("Body inválido.");
  const b = body as Record<string, unknown>;
  const tema = (b.tema ?? b.topic) as string | undefined;
  const termos = (b.termos ?? b.items) as string[] | undefined;
  if (!tema?.trim()) throw new Error("Campo 'tema' é obrigatório.");
  if (!Array.isArray(termos) || termos.length === 0) throw new Error("Campo 'termos' deve ser array não vazio.");
  for (const t of termos) { if (typeof t !== "string" || !t.trim()) throw new Error("Cada termo deve ser string não vazia."); }
  return {
    tema, termos,
    estilo: typeof b.estilo === "string" ? b.estilo : undefined,
    publico: typeof b.publico === "string" ? b.publico : undefined,
    regenerate_image_only: b.regenerate_image_only === true,
    original_result_id: typeof b.original_result_id === "string" ? b.original_result_id : undefined,
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
        model: AI_MODEL, temperature: 0.4,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
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

const PROMPT_MNEMONIC = `Você é um especialista em memorização médica para provas de residência.

Sua ÚNICA tarefa é criar um mnemônico PERFEITO em português do Brasil.

═══ REGRAS OBRIGATÓRIAS ═══
1. Criar uma SIGLA com base nos termos
2. Criar uma FRASE COMPLETA, coerente e fácil de memorizar
3. Criar uma CENA VISUAL absurda, exagerada e memorável
4. Criar EXPLICAÇÃO DIDÁTICA clara
5. Criar EXPLICAÇÃO TÉCNICA correta
6. Criar ASSOCIAÇÃO entre cada termo e a frase

═══ PROIBIDO ═══
- Retornar campos vazios
- Repetir literalmente os termos como frase
- Frase sem sentido ou artificial
- Texto genérico ou acadêmico demais
- Parecer tradução do inglês
- Palavras truncadas ou inventadas sem lógica

═══ EXEMPLOS DE BONS MNEMÔNICOS ═══
- Nervos cranianos: "Oh Odete, Ouve Tu: Trópegos Abelhudos Ficam Vagando Grosseiramente na Horta e na Hipófise"
- Critérios de Light: "PELE" (Proteína, Exsudato, LDH, Efusão)
- Síndrome nefrótica: "PROLAPSO" (Proteinúria, Lipidúria, Albumina baixa, Perda proteica, Sódio retido, Oligúria)

═══ AUTOAVALIAÇÃO ═══
Antes de retornar, verifique:
- Consigo falar em voz alta com naturalidade? Se não, refaça.
- Um aluno lembraria depois de ouvir 2x? Se não, refaça.
- Todos os termos estão representados? Se não, refaça.
- A frase faz sentido em português? Se não, refaça.

═══ FORMATO DE SAÍDA (JSON OBRIGATÓRIO) ═══
{
  "sigla": "a sigla criada",
  "frase_mnemonica": "a frase mnemônica completa e memorável",
  "explicacao_didatica": "explicação clara de como o mnemônico ajuda a lembrar",
  "explicacao_tecnica": "breve contexto clínico correto do tema",
  "cena_visual": "descrição de uma cena 3D estilo Pixar, absurda e memorável, com personagens exagerados",
  "associacoes": [
    { "termo_original": "termo1", "representacao_no_mnemonico": "como esse termo aparece no mnemônico" }
  ],
  "prompt_imagem": "3D cartoon Pixar-style, vibrant colors, clean background, no text, no labels, no letters, no words. [descrição da cena em inglês]",
  "score_autoavaliacao": 0-100,
  "problemas_detectados": []
}

IMPORTANTE: A frase precisa fazer sentido em português e ser fácil de lembrar.`;

const PROMPT_VISUAL = `Você é especialista em memorização visual aplicada à medicina brasileira.

Dada uma PALAVRA ou FRASE MNEMÔNICA, crie uma CENA VISUAL MEMORÁVEL que ajude a fixar o mnemônico na memória.

═══ REGRAS DA CENA ═══
1. A cena deve nascer diretamente do mnemônico (da palavra/frase criada)
2. Deve ser SIMPLES — máximo 3-4 elementos visuais
3. Deve ter AÇÃO/MOVIMENTO — cenas estáticas não funcionam
4. Deve ter algo ENGRAÇADO, ABSURDO ou EMOCIONANTE
5. Deve ser descrita como se fosse um frame de animação Pixar
6. NÃO use elementos abstratos — tudo deve ser visual e concreto

═══ REGRAS DO PROMPT DE IMAGEM ═══
O prompt_imagem DEVE:
- Ser em INGLÊS
- Começar com: "3D cartoon Pixar-style, vibrant colors, clean background, no text, no labels, no letters, no words."
- Descrever exatamente a cena visual criada
- Ser específico sobre personagens, objetos e ações
- NÃO incluir conceitos médicos abstratos — apenas a representação visual

Retorne SOMENTE JSON:
{
  "cena_visual": "descrição da cena em português, 2-3 frases",
  "prompt_imagem": "prompt em inglês para gerar a imagem"
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

// ═══ PIPELINE ═══

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Método não permitido." }, 405);

  let requestId: string | null = null;
  let db: SupabaseClient | null = null;

  const globalTimeout = new Promise<Response>((resolve) => {
    setTimeout(() => {
      console.warn("[MNEMONIC] GLOBAL TIMEOUT");
      resolve(jsonResponse({
        success: false,
        error: "Tempo de geração excedido. Tente novamente.",
        code: "TIMEOUT",
      }, 504));
    }, GLOBAL_TIMEOUT_MS);
  });

  const mainPipeline = async (): Promise<Response> => {
    try {
      const aiKey = requireEnv("LOVABLE_API_KEY");
      const rawBody = await req.json().catch(() => null);
      if (!rawBody) throw new Error("Body vazio ou JSON inválido.");
      console.log(`[MNEMONIC] Payload received: tema=${(rawBody as any)?.tema}, termos=${(rawBody as any)?.termos?.length}`);

      const payload = validatePayload(rawBody);
      payload.termos = normalizeTerms(payload.termos);
      payload.tema = payload.tema.trim();

      const userId = await getUserIdFromRequest(req);
      db = getServiceClient();
      requestId = await insertRequest(db, userId, payload);
      let order = 0;

      const ctx = `Tema: ${payload.tema}\nTermos (TODOS devem estar no mnemônico):\n${payload.termos.map((t, i) => `${i + 1}. ${t}`).join("\n")}${payload.estilo ? `\nEstilo preferido: ${payload.estilo}` : ""}${payload.publico ? `\nPúblico: ${payload.publico}` : ""}`;

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
      // ETAPA 1: Gerar mnemônico (texto)
      // ══════════════════════════════════════
      console.log("[MNEMONIC] ETAPA 1: Gerando mnemônico...");
      let startMs = Date.now();

      interface MnemonicOutput {
        sigla: string; frase_mnemonica: string;
        explicacao_didatica: string; explicacao_tecnica: string;
        cena_visual: string; prompt_imagem: string;
        associacoes: Array<{ termo_original: string; representacao_no_mnemonico: string }>;
        score_autoavaliacao: number; problemas_detectados: string[];
      }

      let mnemonic = await callAI<MnemonicOutput>(aiKey, PROMPT_MNEMONIC, ctx);
      await insertAgentLog(db, {
        request_id: requestId, user_id: userId, agent_name: "gerador",
        execution_order: ++order, status: "completed",
        input_json: { prompt: ctx.substring(0, 500) },
        output_json: mnemonic, score: mnemonic.score_autoavaliacao,
        duration_ms: Date.now() - startMs,
      });

      // Self-validation: if score < 70 or problems detected, retry once
      if (mnemonic.score_autoavaliacao < 70 || (mnemonic.problemas_detectados?.length > 0)) {
        console.log(`[MNEMONIC] Auto-avaliação baixa (${mnemonic.score_autoavaliacao}), retentando...`);
        startMs = Date.now();
        const retryCtx = `${ctx}\n\n⚠️ A versão anterior falhou na autoavaliação (score=${mnemonic.score_autoavaliacao}).\nProblemas: ${(mnemonic.problemas_detectados || []).join(", ")}\nVersão anterior: "${mnemonic.frase_mnemonica}"\n\nCrie uma versão MELHOR, mais memorável e natural em português brasileiro.`;
        const retry = await callAI<MnemonicOutput>(aiKey, PROMPT_MNEMONIC, retryCtx);
        await insertAgentLog(db, {
          request_id: requestId, user_id: userId, agent_name: "retry_gerador",
          execution_order: ++order, status: "completed",
          input_json: { prompt: retryCtx.substring(0, 500) },
          output_json: retry, score: retry.score_autoavaliacao,
          duration_ms: Date.now() - startMs,
        });
        if (retry.score_autoavaliacao >= mnemonic.score_autoavaliacao) {
          mnemonic = retry;
        }
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
      startMs = Date.now();
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
          duration_ms: Date.now() - startMs, error_message: imgResult.error,
        });
      } catch (e) {
        imageFailed = true;
        await insertAgentLog(db, {
          request_id: requestId, user_id: userId, agent_name: "gerador_imagem",
          execution_order: ++order, status: "failed",
          input_json: { prompt: promptImagem.substring(0, 500) },
          output_json: null, duration_ms: Date.now() - startMs,
          error_message: e instanceof Error ? e.message : String(e),
        });
      }

      // ══════════════════════════════════════
      // ETAPA 3: Pontos de prova (não-bloqueante)
      // ══════════════════════════════════════
      let pontosDeProva: Array<{ pergunta_gatilho: string; resposta_esperada: string; armadilha_comum: string }> = [];
      try {
        const examCtx = `Tema: ${payload.tema}\nTermos: ${payload.termos.join(", ")}`;
        const examResult = await callAI<{ pontos_de_prova: typeof pontosDeProva }>(aiKey, PROMPT_EXAM_POINTS, examCtx);
        pontosDeProva = examResult.pontos_de_prova ?? [];
      } catch { /* non-critical */ }

      // ══════════════════════════════════════
      // SCORES (simplified)
      // ══════════════════════════════════════
      const scoreMnemonic = Math.min(100, Math.max(0, mnemonic.score_autoavaliacao || 75));
      const scoreVisual = cenaVisual ? 80 : 50;
      const scoreFinal = Math.round((scoreMnemonic * 0.6 + scoreVisual * 0.2 + (imageUrl ? 100 : 0) * 0.2));

      // ══════════════════════════════════════
      // PERSIST
      // ══════════════════════════════════════
      const itemsMap = payload.termos.map((t, i) => ({
        letter: (mnemonic.sigla || "")[i]?.toUpperCase() || t.charAt(0).toUpperCase(),
        word: t, original_item: t, symbol: null, symbol_reason: null,
      }));

      const associacoes = Array.isArray(mnemonic.associacoes) ? mnemonic.associacoes : [];

      const resultId = await insertResult(db, {
        request_id: requestId, user_id: userId, tema: payload.tema,
        sigla: mnemonic.sigla || "",
        frase_mnemonica: mnemonic.frase_mnemonica,
        explicacao_tecnica: mnemonic.explicacao_tecnica,
        explicacao_didatica: mnemonic.explicacao_didatica,
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
          explicacao_associacao: mnemonic.explicacao_didatica,
          explicacao_tecnica: mnemonic.explicacao_tecnica,
          explicacao_didatica: mnemonic.explicacao_didatica,
          cena_visual: cenaVisual,
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
          associacoes_visuais: [],
          pontos_de_prova: pontosDeProva,
        },
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro interno.";
      console.error("[MNEMONIC] FAILED:", msg);
      if (requestId && db) { try { await updateRequestStatus(db, requestId, "failed"); } catch {} }

      // No fake fallback — return real error

      return jsonResponse({ success: false, error: msg }, 500);
    }
  };

  return Promise.race([mainPipeline(), globalTimeout]);
});
