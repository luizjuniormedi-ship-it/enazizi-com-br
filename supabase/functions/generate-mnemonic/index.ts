import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MnemonicRequest { tema: string; termos: string[]; estilo?: string; publico?: string; }
interface MapaClinico { termo_original: string; qualificadores: string[]; representacao_no_mnemonico: string; explicacao: string; }
interface GeneratorOutput {
  tipo: string; sigla: string; frase_mnemonica: string; explicacao_tecnica: string;
  explicacao_didatica: string; mapa_completo: MapaClinico[];
  justificativa_clinica: string; justificativa_linguistica: string;
  associacoes?: Array<{ letra: string; termo_original: string; representacao_no_mnemonico: string }>;
}
interface LinguisticAuditOutput {
  score_linguistico: number; fluidez_fala: number; naturalidade: number; soa_natural: boolean;
  problemas: string[]; versao_corrigida?: { frase_mnemonica: string; explicacao_didatica: string; };
}
interface MedicalAuditOutput {
  score_medico: number; todos_os_termos_presentes: boolean; perda_clinica: boolean;
  termos_faltantes: string[]; qualificadores_perdidos: string[]; erros_encontrados: string[];
  versao_corrigida?: GeneratorOutput;
}
interface PedagogicalAuditOutput {
  score_pedagogico: number; facilidade_memorizacao: number; clareza: number;
  associacao_mental: number; aplicabilidade_em_aula: number; aplicabilidade_em_prova: number;
  pontos_fortes: string[]; pontos_fracos: string[];
  versao_otimizada?: { frase_mnemonica?: string; explicacao_didatica?: string; cena_sugerida?: string; };
}
interface VisualOutput { cena_visual: string; associacoes_visuais: Array<{ termo: string; elemento_visual: string }>; prompt_imagem: string; }
interface ExamStructureOutput {
  estrutura_prova: { topico: string; itens_organizados: Array<{ item: string; ponto_chave_prova: string; armadilha_comum: string }>; };
  diferencial_prova: { diagnostico_comparado: string; diferencas_chave: string[]; pegadinhas: string[]; };
  memorizacao_ativa: { pergunta_rapida: string; resposta_esperada: string; gatilho_mental: string; };
}
interface ConsolidatedOutput { sigla: string; frase_mnemonica: string; explicacao_tecnica: string; explicacao_didatica: string; cena_visual: string; prompt_imagem: string; alertas: string[]; }

const AI_MODEL = "google/gemini-2.5-flash";
const AI_TEMP = 0.3;
const SCORE_MEDICO_MIN = 90;
const SCORE_PEDAGOGICO_MIN = 85;
const SCORE_LINGUISTICO_MIN = 85;

// ═══ PROMPTS ═══

const PROMPT_GERADOR = `Você é um professor brasileiro de medicina com 20 anos de experiência em ensino clínico.

Crie um mnemônico médico em português do Brasil que seja NATURAL, COMPLETO e MEMORÁVEL.

REGRAS DE FIDELIDADE CLÍNICA:
1. PRESERVAR 100% DOS TERMOS — não omitir nenhum
2. PRESERVAR QUALIFICADORES — "bordas elevadas e nítidas" NÃO vira "bordas nítidas"
3. "dor intensa/queimação" NÃO vira "dor queima"
4. "fatores de risco" NÃO vira "fatores"
5. NUNCA truncar ou simplificar termos perdendo precisão

REGRAS DE NATURALIDADE:
6. Deve soar como fala de professor em aula
7. Fácil de repetir em voz alta
8. NUNCA palavras truncadas ou artificiais
9. NUNCA sigla forçada que piore clareza
10. NUNCA "Paciente com...", "Lembre que..."
11. Linguagem oral brasileira natural

FORMATO — ordem de preferência:
1. FRASE natural (primeira escolha)
2. IMAGEM MENTAL forte
3. MINI-HISTÓRIA
4. SIGLA (somente se excelente e pronunciável)

TESTE: Leia em voz alta mentalmente. Se não soar natural em 5s → reescreva.

Retorne SOMENTE JSON:
{
  "tipo": "frase" ou "sigla",
  "sigla": "string (vazia se tipo=frase)",
  "frase_mnemonica": "string",
  "explicacao_tecnica": "string",
  "explicacao_didatica": "string",
  "mapa_completo": [{"termo_original":"string","qualificadores":["string"],"representacao_no_mnemonico":"string","explicacao":"string"}],
  "justificativa_clinica": "string",
  "justificativa_linguistica": "string"
}`;

const PROMPT_AUDITOR_MEDICO = `Você é auditor médico EXTREMAMENTE rigoroso em fidelidade clínica de mnemônicos.

Para CADA termo original:
1. Está presente no mnemônico? (completo, não parcial)
2. Qualificadores preservados? ("elevadas","intensa","de risco" etc)
3. Significado clínico intacto?
4. Ambiguidade diagnóstica?

REPROVAR (perda_clinica=true) se:
- Qualquer termo ausente
- Qualquer qualificador importante removido
- Simplificação que reduza precisão
- Ambiguidade clínica

Retorne SOMENTE JSON:
{
  "score_medico":0,"todos_os_termos_presentes":true,"perda_clinica":false,
  "termos_faltantes":[],"qualificadores_perdidos":[],"erros_encontrados":[],
  "versao_corrigida":null
}
Se perda_clinica=true, inclua versao_corrigida com formato completo do gerador.`;

const PROMPT_AUDITOR_LINGUISTICO = `Você é linguista brasileiro especializado em didática médica.

Avalie com RIGOR:
1. FLUIDEZ ORAL — Flui ao ler em voz alta?
2. NATURALIDADE — Parece fala de professor brasileiro?
3. PALAVRAS REAIS — Todas existem no português?
4. FACILIDADE — Aluno lembraria após ouvir 2x?
5. ARTIFICIALIDADE — Palavras truncadas ou robóticas?

Reprovar se fluidez_fala<80 ou naturalidade<80.

Retorne SOMENTE JSON:
{
  "score_linguistico":0,"fluidez_fala":0,"naturalidade":0,"soa_natural":true,
  "problemas":[],"versao_corrigida":null
}
Se reprovar, versao_corrigida com {"frase_mnemonica":"...","explicacao_didatica":"..."}.`;

const PROMPT_AUDITOR_PEDAGOGICO = `Você é especialista em educação médica e neuroaprendizado.
Avalie: facilidade de memorização, clareza, associação mental, aplicabilidade em aula e prova.
Dê nota 0-100. Se necessário, proponha versão otimizada.
Retorne SOMENTE JSON:
{"score_pedagogico":0,"facilidade_memorizacao":0,"clareza":0,"associacao_mental":0,"aplicabilidade_em_aula":0,"aplicabilidade_em_prova":0,"pontos_fortes":[],"pontos_fracos":[],"versao_otimizada":null}`;

const PROMPT_VISUAL = `Você é especialista em memória visual aplicada à medicina.
Crie cena visual forte, associação visual item por item, prompt de imagem em INGLÊS.
O prompt_imagem DEVE começar com: "Clean medical infographic illustration, flat design, high contrast, saturated colors, pure white background, no text, no labels, no letters."
Retorne SOMENTE JSON:
{"cena_visual":"string","associacoes_visuais":[{"termo":"string","elemento_visual":"string"}],"prompt_imagem":"string"}`;

const PROMPT_ESTRUTURA_PROVA = `Você é especialista em provas de residência médica no Brasil.
Para o tema e termos, crie estrutura de prova com pontos-chave, armadilhas, diferencial diagnóstico e pergunta de memorização ativa.
Retorne SOMENTE JSON:
{
  "estrutura_prova":{"topico":"string","itens_organizados":[{"item":"string","ponto_chave_prova":"string","armadilha_comum":"string"}]},
  "diferencial_prova":{"diagnostico_comparado":"string","diferencas_chave":[],"pegadinhas":[]},
  "memorizacao_ativa":{"pergunta_rapida":"string","resposta_esperada":"string","gatilho_mental":"string"}
}`;

const PROMPT_CONSOLIDADOR = `Você é o consolidador final do sistema de mnemônicos médicos.
Monte a melhor versão final. REGRA CRÍTICA: Não remover qualificadores clínicos.
Retorne SOMENTE JSON:
{"sigla":"string","frase_mnemonica":"string","explicacao_tecnica":"string","explicacao_didatica":"string","cena_visual":"string","prompt_imagem":"string","alertas":[]}`;

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
  return { tema, termos, estilo: typeof b.estilo === "string" ? b.estilo : undefined, publico: typeof b.publico === "string" ? b.publico : undefined };
}

function normalizeTerms(tema: string, termos: string[]): { tema: string; termos: string[] } {
  const seen = new Set<string>(); const unique: string[] = [];
  for (const t of termos) { const tr = t.trim(); const k = tr.toLowerCase(); if (tr && !seen.has(k)) { seen.add(k); unique.push(tr); } }
  return { tema: tema.trim(), termos: unique };
}

function buildContext(req: MnemonicRequest): string {
  let ctx = `Tema: ${req.tema}\nTermos clínicos (TODOS devem ser preservados integralmente, com qualificadores):\n`;
  req.termos.forEach((t, i) => { ctx += `${i + 1}. ${t}\n`; });
  if (req.estilo) ctx += `\nEstilo: ${req.estilo}`;
  if (req.publico) ctx += `\nPúblico: ${req.publico}`;
  return ctx;
}

function runClinicalGate(originalTermos: string[], frase: string, mapa?: MapaClinico[]): { passed: boolean; missing: string[] } {
  const fLower = frase.toLowerCase();
  const mapped = new Set((mapa ?? []).map(m => m.termo_original.toLowerCase()));
  const missing: string[] = [];
  for (const t of originalTermos) {
    const tLower = t.toLowerCase().trim();
    const inMap = [...mapped].some(m => m.includes(tLower) || tLower.includes(m));
    if (!inMap) {
      const kws = tLower.split(/\s+/).filter(w => w.length > 3);
      if (!kws.some(kw => fLower.includes(kw))) missing.push(t);
    }
  }
  return { passed: missing.length === 0, missing };
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

const AGENT_TIMEOUT_MS = 25000;

async function callAIJson<T>(apiKey: string, sys: string, user: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: AI_TEMP,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const e = await r.text().catch(() => "?");
      throw new Error(`AI Gateway ${r.status}: ${e.substring(0, 300)}`);
    }
    const j = await r.json();
    const c = j?.choices?.[0]?.message?.content;
    if (!c) throw new Error("AI content vazio.");
    // Extract JSON from possible markdown fences
    const cleaned = c.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`JSON não encontrado: ${c.substring(0, 200)}`);
    try { return JSON.parse(match[0]) as T; } catch { throw new Error(`JSON inválido: ${match[0].substring(0, 200)}`); }
  } finally { clearTimeout(timer); }
}

async function generateImage(prompt: string): Promise<{ url: string | null; failed: boolean; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { url: null, failed: true, error: "LOVABLE_API_KEY missing" };
  try {
    console.log("[IMAGE] Calling Gemini image generation...");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: `Generate this image: ${prompt}. IMPORTANT: NO text, labels, letters, or words in the image.` }],
        modalities: ["image", "text"],
      }),
    });
    console.log(`[IMAGE] HTTP status: ${r.status}`);
    if (!r.ok) return { url: null, failed: true, error: `HTTP ${r.status}` };

    const j = await r.json();

    // Detect image from multiple possible response shapes
    let imgData: string | null = null;

    // Shape 1: images array (most common)
    const images = j?.choices?.[0]?.message?.images;
    if (Array.isArray(images) && images.length > 0) {
      imgData = images[0]?.image_url?.url ?? null;
      console.log(`[IMAGE] Found in images array: ${imgData ? "yes" : "no"}`);
    }

    // Shape 2: content is data URL string
    if (!imgData) {
      const content = j?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.startsWith("data:image")) {
        imgData = content;
        console.log("[IMAGE] Found as data URL in content");
      }
    }

    // Shape 3: content is array with image parts
    if (!imgData) {
      const parts = j?.choices?.[0]?.message?.content;
      if (Array.isArray(parts)) {
        const imgPart = parts.find((x: any) => x.type === "image_url" || x.type === "image");
        imgData = imgPart?.image_url?.url ?? imgPart?.url ?? imgPart?.data ?? null;
        console.log(`[IMAGE] Found in content array: ${imgData ? "yes" : "no"}`);
      }
    }

    if (!imgData) {
      console.log("[IMAGE] No image data found in response");
      return { url: null, failed: true, error: "No image in response" };
    }

    // If it's already a remote URL, use directly
    if (imgData.startsWith("http") && !imgData.startsWith("data:")) {
      console.log("[IMAGE] Using remote URL directly");
      return { url: imgData, failed: false };
    }

    // Upload base64 to storage
    const uploaded = await uploadImage(imgData);
    console.log(`[IMAGE] Upload result: ${uploaded ? "success" : "failed"}`);
    return { url: uploaded, failed: !uploaded, error: uploaded ? undefined : "Upload failed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[IMAGE] Error: ${msg}`);
    return { url: null, failed: true, error: msg };
  }
}

async function uploadImage(b64: string): Promise<string | null> {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

    // Detect MIME type
    const mimeMatch = b64.match(/^data:(image\/\w+);base64,/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";

    const data = b64.replace(/^data:image\/\w+;base64,/, "");
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const name = `mnemonics/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("question-images").upload(name, bytes, { contentType: mime, upsert: false });
    if (error) { console.error(`[IMAGE] Storage upload error: ${error.message}`); return null; }

    const { data: u } = db.storage.from("question-images").getPublicUrl(name);
    console.log(`[IMAGE] Public URL: ${u?.publicUrl}`);
    return u?.publicUrl ?? null;
  } catch (e) {
    console.error(`[IMAGE] Upload exception: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

function getServiceClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

async function insertRequest(db: SupabaseClient, userId: string, p: MnemonicRequest): Promise<string> {
  const { data, error } = await db.from("mnemonic_requests").insert({ user_id: userId, tema: p.tema, termos_json: p.termos, estilo: p.estilo ?? "frase + imagem mental", publico: p.publico ?? "residencia", status: "processing", source: "lovable-ui" }).select("id").single();
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
  } catch (e) {
    console.error(`Log failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function insertResult(db: SupabaseClient, p: { request_id: string; user_id: string; tema: string; consolidated: ConsolidatedOutput; visual: VisualOutput; score_medico: number; score_pedagogico: number; score_linguistico: number; score_final: number; aprovado: boolean; aprovado_medico: boolean; aprovado_pedagogico: boolean; image_url: string | null; }): Promise<string> {
  const { data: ex } = await db.from("mnemonic_results").select("versao").eq("request_id", p.request_id).eq("is_latest", true).order("versao", { ascending: false }).limit(1);
  const v = ex?.length ? (ex[0].versao as number) + 1 : 1;
  const { data, error } = await db.from("mnemonic_results").insert({
    request_id: p.request_id, user_id: p.user_id, tema: p.tema, sigla: p.consolidated.sigla,
    frase_mnemonica: p.consolidated.frase_mnemonica, explicacao_tecnica: p.consolidated.explicacao_tecnica,
    explicacao_didatica: p.consolidated.explicacao_didatica, cena_visual: p.consolidated.cena_visual,
    prompt_imagem: p.consolidated.prompt_imagem, associacoes_json: p.visual.associacoes_visuais ?? [],
    associacoes_visuais_json: p.visual.associacoes_visuais ?? [], alertas_json: p.consolidated.alertas ?? [],
    score_medico: p.score_medico, score_pedagogico: p.score_pedagogico, score_linguistico: p.score_linguistico,
    score_final: p.score_final, aprovado: p.aprovado, aprovado_medico: p.aprovado_medico,
    aprovado_pedagogico: p.aprovado_pedagogico, image_url: p.image_url, versao: v, is_latest: true,
  }).select("id").single();
  if (error || !data?.id) throw new Error(`Result save failed: ${error?.message}`);
  return data.id as string;
}

async function runAgent<T>(apiKey: string, db: SupabaseClient, reqId: string, userId: string, name: string, order: number, sys: string, user: string): Promise<T> {
  const start = Date.now();
  try {
    const out = await callAIJson<T>(apiKey, sys, user);
    const d = Date.now() - start;
    const r = out as Record<string, unknown>;
    const sc = typeof r.score_medico === "number" ? r.score_medico : typeof r.score_pedagogico === "number" ? r.score_pedagogico : typeof r.score_linguistico === "number" ? r.score_linguistico : undefined;
    await insertAgentLog(db, { request_id: reqId, user_id: userId, agent_name: name, execution_order: order, status: "completed", input_json: { prompt: user.substring(0, 500) }, output_json: out, score: sc as number | undefined, duration_ms: d });
    return out;
  } catch (err) {
    const d = Date.now() - start; const msg = err instanceof Error ? err.message : String(err);
    await insertAgentLog(db, { request_id: reqId, user_id: userId, agent_name: name, execution_order: order, status: "failed", input_json: { prompt: user.substring(0, 500) }, output_json: null, duration_ms: d, error_message: msg });
    throw new Error(`${name} falhou: ${msg}`);
  }
}

// ═══ MAIN ═══

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Método não permitido." }, 405);

  let requestId: string | null = null;
  let db: SupabaseClient | null = null;
  let currentStage = "init";

  try {
    currentStage = "env_check";
    const aiKey = requireEnv("LOVABLE_API_KEY");
    requireEnv("SUPABASE_URL"); requireEnv("SUPABASE_ANON_KEY"); requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    currentStage = "parse_body";
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) throw new Error("Body vazio ou JSON inválido.");
    console.log(`[MNEMONIC] Payload received: tema=${(rawBody as any)?.tema}, termos=${(rawBody as any)?.termos?.length}`);

    currentStage = "validate_input";
    const payload = validatePayload(rawBody);
    const norm = normalizeTerms(payload.tema, payload.termos);
    payload.tema = norm.tema; payload.termos = norm.termos;

    currentStage = "auth";
    const userId = await getUserIdFromRequest(req);
    console.log(`[MNEMONIC] User: ${userId.substring(0, 8)}...`);

    currentStage = "db_init";
    db = getServiceClient();
    requestId = await insertRequest(db, userId, payload);
    console.log(`[MNEMONIC] Request: ${requestId}`);
    const ctx = buildContext(payload);
    let order = 0;

    // ── 1. GERADOR CLÍNICO ──
    currentStage = "agent_gerador";
    let gen = await runAgent<GeneratorOutput>(aiKey, db, requestId, userId, "gerador", ++order, PROMPT_GERADOR, ctx);

    currentStage = "clinical_gate";
    // ── 2. GATE DE COBERTURA CLÍNICA ──
    let coverageOk = true;
    const gate = runClinicalGate(payload.termos, gen.frase_mnemonica, gen.mapa_completo);
    if (!gate.passed) {
      coverageOk = false;
      console.log(`[GATE] FAILED. Missing: ${gate.missing.join(", ")}`);
      const gatePrompt = `${ctx}\n\nVersão anterior FALHOU no gate clínico.\nTermos faltantes: ${gate.missing.join(", ")}\nINCLUA TODOS os termos originais com seus qualificadores completos.`;
      gen = await runAgent<GeneratorOutput>(aiKey, db, requestId, userId, "retry_gerador", ++order, PROMPT_GERADOR, gatePrompt);
      const gate2 = runClinicalGate(payload.termos, gen.frase_mnemonica, gen.mapa_completo);
      coverageOk = gate2.passed;
    }

    currentStage = "agent_linguistico";
    // ── 3. AUDITOR LINGUÍSTICO ──
    const lingP = `${ctx}\n\nMnemônico:\nFrase: ${gen.frase_mnemonica}\nDidática: ${gen.explicacao_didatica}`;
    let ling = await runAgent<LinguisticAuditOutput>(aiKey, db, requestId, userId, "auditor_linguistico_ptbr", ++order, PROMPT_AUDITOR_LINGUISTICO, lingP);
    const flu = typeof ling.fluidez_fala === "number" ? ling.fluidez_fala : 100;
    const nat = typeof ling.naturalidade === "number" ? ling.naturalidade : 100;

    // ── 4. RETRY LINGUÍSTICO ──
    if (ling.score_linguistico < SCORE_LINGUISTICO_MIN || flu < 80 || nat < 80 || !ling.soa_natural) {
      if (ling.versao_corrigida?.frase_mnemonica) { gen.frase_mnemonica = ling.versao_corrigida.frase_mnemonica; if (ling.versao_corrigida.explicacao_didatica) gen.explicacao_didatica = ling.versao_corrigida.explicacao_didatica; }
      const rP = `${ctx}\n\nAuditoria linguística falhou (score=${ling.score_linguistico}, fluidez=${flu}, nat=${nat}).\nProblemas: ${(ling.problemas||[]).join("; ")}\nAtual: ${gen.frase_mnemonica}\nReescreva NATURAL, preservando TODOS os termos.`;
      const rGen = await runAgent<GeneratorOutput>(aiKey, db, requestId, userId, "retry_linguistico", ++order, PROMPT_GERADOR, rP);
      const rLing = await runAgent<LinguisticAuditOutput>(aiKey, db, requestId, userId, "auditor_linguistico_ptbr", ++order, PROMPT_AUDITOR_LINGUISTICO, `${ctx}\n\nRetry:\nFrase: ${rGen.frase_mnemonica}`);
      if (rLing.score_linguistico >= ling.score_linguistico) { ling = rLing; gen = rGen; }
    } else if (ling.versao_corrigida?.frase_mnemonica) { gen.frase_mnemonica = ling.versao_corrigida.frase_mnemonica; }

    currentStage = "agent_medico";
    // ── 5. AUDITOR MÉDICO ──
    const medP = `${ctx}\n\nMnemônico:\n${JSON.stringify({ sigla: gen.sigla, frase_mnemonica: gen.frase_mnemonica, mapa_completo: gen.mapa_completo }, null, 2)}`;
    let med = await runAgent<MedicalAuditOutput>(aiKey, db, requestId, userId, "auditor_medico", ++order, PROMPT_AUDITOR_MEDICO, medP);
    let approved = gen;

    // ── 6. RETRY MÉDICO ──
    if (med.perda_clinica || med.score_medico < SCORE_MEDICO_MIN) {
      if (med.versao_corrigida) approved = med.versao_corrigida;
      const rP = `${ctx}\n\nAuditoria médica FALHOU (score=${med.score_medico}).\nFaltantes: ${(med.termos_faltantes||[]).join(", ")}\nQualif. perdidos: ${(med.qualificadores_perdidos||[]).join(", ")}\nCrie versão com TODOS termos e qualificadores.`;
      const rGen = await runAgent<GeneratorOutput>(aiKey, db, requestId, userId, "retry_gerador", ++order, PROMPT_GERADOR, rP);
      const rMed = await runAgent<MedicalAuditOutput>(aiKey, db, requestId, userId, "retry_auditor_medico", ++order, PROMPT_AUDITOR_MEDICO, `${ctx}\n\nRetry médico:\n${JSON.stringify({ sigla: rGen.sigla, frase_mnemonica: rGen.frase_mnemonica, mapa_completo: rGen.mapa_completo }, null, 2)}`);
      if (rMed.score_medico >= med.score_medico) { med = rMed; approved = rMed.versao_corrigida ?? rGen; }
    }

    currentStage = "agent_pedagogico";
    // ── 7. AUDITOR PEDAGÓGICO (resilient) ──
    let ped: PedagogicalAuditOutput = { score_pedagogico: 75, facilidade_memorizacao: 75, clareza: 75, associacao_mental: 75, aplicabilidade_em_aula: 75, aplicabilidade_em_prova: 75, pontos_fortes: [], pontos_fracos: [] };
    try {
      ped = await runAgent<PedagogicalAuditOutput>(aiKey, db, requestId, userId, "auditor_pedagogico", ++order, PROMPT_AUDITOR_PEDAGOGICO, `${ctx}\n\nFrase: ${approved.frase_mnemonica}\nDidática: ${approved.explicacao_didatica}`);
      // ── 8. RETRY PEDAGÓGICO ──
      if (ped.score_pedagogico < SCORE_PEDAGOGICO_MIN) {
        const rPed = await runAgent<PedagogicalAuditOutput>(aiKey, db, requestId, userId, "retry_auditor_pedagogico", ++order, PROMPT_AUDITOR_PEDAGOGICO, `${ctx}\n\nFrase: ${approved.frase_mnemonica}\nScore: ${ped.score_pedagogico}. Fracos: ${(ped.pontos_fracos||[]).join("; ")}. Otimize.`);
        if (rPed.score_pedagogico >= ped.score_pedagogico) ped = rPed;
      }
    } catch { /* use defaults */ }
    if (ped.versao_otimizada?.frase_mnemonica) approved.frase_mnemonica = ped.versao_otimizada.frase_mnemonica;
    if (ped.versao_otimizada?.explicacao_didatica) approved.explicacao_didatica = ped.versao_otimizada.explicacao_didatica;

    currentStage = "agent_visual";
    // ── 9. GERADOR VISUAL (resilient) ──
    let vis: VisualOutput = { cena_visual: approved.frase_mnemonica, associacoes_visuais: [], prompt_imagem: `Clean medical infographic of ${approved.sigla || payload.tema}, flat design, white bg, no text` };
    try { vis = await runAgent<VisualOutput>(aiKey, db, requestId, userId, "visual", ++order, PROMPT_VISUAL, `${ctx}\n\nSigla: ${approved.sigla}\nFrase: ${approved.frase_mnemonica}`); } catch { /* fallback */ }

    currentStage = "image_generation";
    // ── 10. GERADOR DE IMAGEM (resilient, with diagnostics) ──
    let imageUrl: string | null = null;
    let imageFailed = false;
    const imgS = Date.now();
    try {
      const imgResult = await generateImage(vis.prompt_imagem);
      imageUrl = imgResult.url;
      imageFailed = imgResult.failed;
      await insertAgentLog(db, {
        request_id: requestId, user_id: userId, agent_name: "gerador_imagem", execution_order: ++order,
        status: imageUrl ? "completed" : "failed",
        input_json: { prompt: vis.prompt_imagem.substring(0, 500) },
        output_json: { image_url: imageUrl, image_failed: imageFailed, error: imgResult.error ?? null },
        duration_ms: Date.now() - imgS,
        error_message: imgResult.error,
      });
    } catch (e) {
      imageFailed = true;
      await insertAgentLog(db, { request_id: requestId, user_id: userId, agent_name: "gerador_imagem", execution_order: ++order, status: "failed", input_json: { prompt: vis.prompt_imagem.substring(0, 500) }, output_json: null, duration_ms: Date.now() - imgS, error_message: e instanceof Error ? e.message : String(e) });
    }

    // ── ESTRUTURA DE PROVA (resilient, parallel with consolidator context) ──
    let exam: ExamStructureOutput = { estrutura_prova: { topico: payload.tema, itens_organizados: [] }, diferencial_prova: { diagnostico_comparado: "", diferencas_chave: [], pegadinhas: [] }, memorizacao_ativa: { pergunta_rapida: "", resposta_esperada: "", gatilho_mental: "" } };
    try { exam = await runAgent<ExamStructureOutput>(aiKey, db, requestId, userId, "consolidador", ++order, PROMPT_ESTRUTURA_PROVA, `${ctx}\n\nFrase: ${approved.frase_mnemonica}`); } catch { /* fallback */ }

    currentStage = "consolidador";
    // ── 11. CONSOLIDADOR FINAL ──
    const consP = `${ctx}\n\nMnemônico:\n${JSON.stringify(approved, null, 2)}\n\nLing: ${ling.score_linguistico} | Méd: ${med.score_medico} | Ped: ${ped.score_pedagogico}\nCena: ${vis.cena_visual}\nPrompt img: ${vis.prompt_imagem}`;
    const cons = await runAgent<ConsolidatedOutput>(aiKey, db, requestId, userId, "consolidador", ++order, PROMPT_CONSOLIDADOR, consP);

    // ── SCORES & QUALITY FLAG ──
    const sL = Math.max(0, Math.min(100, Math.round(ling.score_linguistico)));
    const sM = Math.max(0, Math.min(100, Math.round(med.score_medico)));
    const sP = Math.max(0, Math.min(100, Math.round(ped.score_pedagogico)));
    const sF = Math.round((sM + sP + sL) / 3);
    const aM = sM >= SCORE_MEDICO_MIN; const aP = sP >= SCORE_PEDAGOGICO_MIN; const ap = aM && aP;
    const qf = (sM >= 90 && sL >= 85 && sP >= 85) ? "high" : (sL < 80 || sM < 85) ? "low" : "medium";

    currentStage = "db_persist";
    const resultId = await insertResult(db, { request_id: requestId, user_id: userId, tema: payload.tema, consolidated: cons, visual: vis, score_medico: sM, score_pedagogico: sP, score_linguistico: sL, score_final: sF, aprovado: ap, aprovado_medico: aM, aprovado_pedagogico: aP, image_url: imageUrl });
    await updateRequestStatus(db, requestId, "completed");

    const itemsMap = (approved.mapa_completo ?? []).map(m => ({ letter: m.representacao_no_mnemonico.charAt(0).toUpperCase(), word: m.representacao_no_mnemonico, original_item: m.termo_original, symbol: null, symbol_reason: m.explicacao || null }));

    return jsonResponse({
      success: true,
      data: {
        request_id: requestId, result_id: resultId, tema: payload.tema,
        sigla: cons.sigla, frase_mnemonica: cons.frase_mnemonica,
        explicacao_tecnica: cons.explicacao_tecnica, explicacao_didatica: cons.explicacao_didatica,
        cena_visual: cons.cena_visual, prompt_imagem: cons.prompt_imagem, image_url: imageUrl,
        score_medico: sM, score_pedagogico: sP, score_linguistico: sL, score_final: sF,
        quality_flag: qf, coverage_ok: coverageOk, image_failed: imageFailed,
        alertas: cons.alertas ?? [], items_map: itemsMap,
        associacoes: (approved.mapa_completo ?? []).map(m => ({ letra: m.representacao_no_mnemonico.charAt(0).toUpperCase(), termo_original: m.termo_original, representacao_no_mnemonico: m.representacao_no_mnemonico })),
        associacoes_visuais: vis.associacoes_visuais ?? [],
        mapa_clinico_completo: approved.mapa_completo ?? [],
        estrutura_prova: exam.estrutura_prova,
        diferencial_prova: exam.diferencial_prova,
        memorizacao_ativa: exam.memorizacao_ativa,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno.";
    console.error(`[MNEMONIC] FAILED at stage=${currentStage}:`, msg);
    if (requestId && db) { try { await updateRequestStatus(db, requestId, "failed"); } catch {} }
    return jsonResponse({ success: false, error: msg, stage: currentStage }, 500);
  }
});
