import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ══════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════

interface MnemonicRequest {
  tema: string;
  termos: string[];
  estilo?: string;
  publico?: string;
}

interface Associacao {
  letra: string;
  termo_original: string;
  representacao_no_mnemonico: string;
}

interface GeneratorOutput {
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  associacoes?: Associacao[];
  justificativa_linguistica?: string;
  observacoes?: string[];
}

interface LinguisticAuditOutput {
  score_linguistico: number;
  fluidez_fala: number;
  soa_natural: boolean;
  tem_sentido: boolean;
  memoravel: boolean;
  pronunciavel: boolean;
  adequado_para_aula: boolean;
  problemas_linguisticos: string[];
  versao_corrigida?: GeneratorOutput;
}

interface MedicalAuditOutput {
  score_medico: number;
  todos_os_termos_presentes: boolean;
  houve_omissao: boolean;
  houve_distorcao_semantica: boolean;
  ha_risco_clinico: boolean;
  letras_associadas_corretamente: boolean;
  erros_encontrados: string[];
  versao_corrigida?: GeneratorOutput;
}

interface PedagogicalAuditOutput {
  score_pedagogico: number;
  facilidade_memorizacao: number;
  clareza: number;
  associacao_mental: number;
  aplicabilidade_em_aula: number;
  aplicabilidade_em_prova: number;
  pontos_fortes: string[];
  pontos_fracos: string[];
  versao_otimizada?: {
    frase_mnemonica?: string;
    explicacao_didatica?: string;
    cena_sugerida?: string;
  };
}

interface VisualOutput {
  cena_visual: string;
  associacoes_visuais: Array<{ termo: string; elemento_visual: string }>;
  prompt_imagem: string;
}

interface ConsolidatedOutput {
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  cena_visual: string;
  prompt_imagem: string;
  alertas: string[];
}

// ══════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════

const OPENAI_MODEL = "gpt-4.1-mini";
const OPENAI_TEMP = 0.2;
const SCORE_MEDICO_MIN = 90;
const SCORE_PEDAGOGICO_MIN = 85;
const SCORE_LINGUISTICO_MIN = 85;

// ══════════════════════════════════════════════════
// PROMPTS
// ══════════════════════════════════════════════════

const PROMPT_GERADOR = `Você é um professor brasileiro carismático de medicina, famoso por criar frases inesquecíveis para seus alunos.

Sua missão: criar um mnemônico médico em português do Brasil que seja IMPOSSÍVEL de esquecer.

PROCESSO MENTAL OBRIGATÓRIO:
Antes de responder, simule como um estudante ouviria essa frase em voz alta.
Se não for fácil de lembrar em 5 segundos, reescreva.

Regras de ouro:
- A frase deve soar como algo dito numa aula informal — natural, fluida, falada
- Priorize humor, imagem mental forte ou ritmo de fala
- NUNCA comece com "Paciente com...", "Lembre que...", "Para memorizar..."
- Frases curtas vencem. Máximo 15 palavras na frase mnemônica
- Cada palavra da frase deve começar com a letra do termo correspondente
- Incluir TODOS os termos sem omitir nenhum
- Não trocar o sentido clínico
- Se a sigla ficar impronunciável, prefira uma frase forte sem sigla forçada
- A frase deve ter RITMO — teste lendo em voz alta mentalmente
- Prefira palavras do cotidiano brasileiro, não linguagem acadêmica na frase
- Use criatividade: cenários absurdos, engraçados ou visuais memorizam melhor

Retorne SOMENTE JSON válido com:
{
  "sigla": "string (somente se pronunciável, senão vazio)",
  "frase_mnemonica": "string (curta, impactante, falável)",
  "explicacao_tecnica": "string",
  "explicacao_didatica": "string",
  "associacoes": [
    { "letra": "string", "termo_original": "string", "representacao_no_mnemonico": "string" }
  ],
  "justificativa_linguistica": "string",
  "observacoes": ["string"]
}`;

const PROMPT_AUDITOR_LINGUISTICO = `Você é um linguista brasileiro especializado em didática médica e oralidade.

Avalie o mnemônico com RIGOR nos seguintes critérios:
1. FLUIDEZ ORAL — Leia em voz alta mentalmente. Flui naturalmente? Tem ritmo?
2. NATURALIDADE — Parece algo que um professor brasileiro falaria em aula?
3. SENTIDO — A frase faz sentido por si só (mesmo fora do contexto médico)?
4. MEMORABILIDADE — Um estudante lembraria após ouvir 2x?
5. PRONÚNCIA — A sigla é pronunciável? A frase é falável sem tropeçar?
6. ARTIFICIALIDADE — Há palavras forçadas, traduções ruins ou construções robóticas?

Dê nota de 0 a 100 para score_linguistico.
Dê nota de 0 a 100 para fluidez_fala (quão bem a frase flui ao ser falada em voz alta).

Se score_linguistico < 85 OU fluidez_fala < 80, OBRIGATORIAMENTE produza versao_corrigida.

Retorne SOMENTE JSON válido com:
{
  "score_linguistico": 0,
  "fluidez_fala": 0,
  "soa_natural": true,
  "tem_sentido": true,
  "memoravel": true,
  "pronunciavel": true,
  "adequado_para_aula": true,
  "problemas_linguisticos": ["string"],
  "versao_corrigida": null
}
Se precisar corrigir, inclua versao_corrigida com sigla, frase_mnemonica, explicacao_tecnica, explicacao_didatica, associacoes e justificativa_linguistica.`;

const PROMPT_AUDITOR_MEDICO = `Você é um auditor médico extremamente rigoroso.

Sua missão:
- detectar omissões
- detectar distorções semânticas
- detectar erro de associação letra-termo
- detectar risco clínico

Dê nota de 0 a 100.
Se houver falha relevante, produza uma versão corrigida.

Retorne SOMENTE JSON válido com:
{
  "score_medico": 0,
  "todos_os_termos_presentes": true,
  "houve_omissao": false,
  "houve_distorcao_semantica": false,
  "ha_risco_clinico": false,
  "letras_associadas_corretamente": true,
  "erros_encontrados": ["string"],
  "versao_corrigida": null
}
Se precisar corrigir, inclua versao_corrigida com o mesmo formato do gerador.`;

const PROMPT_AUDITOR_PEDAGOGICO = `Você é especialista em educação médica e neuroaprendizado.

Avalie:
- facilidade de memorização
- clareza
- associação mental
- aplicabilidade em aula
- aplicabilidade em prova

Dê nota de 0 a 100.
Se necessário, proponha uma versão otimizada.

Retorne SOMENTE JSON válido com:
{
  "score_pedagogico": 0,
  "facilidade_memorizacao": 0,
  "clareza": 0,
  "associacao_mental": 0,
  "aplicabilidade_em_aula": 0,
  "aplicabilidade_em_prova": 0,
  "pontos_fortes": ["string"],
  "pontos_fracos": ["string"],
  "versao_otimizada": null
}
Se precisar otimizar, inclua versao_otimizada com frase_mnemonica, explicacao_didatica e cena_sugerida.`;

const PROMPT_VISUAL = `Você é especialista em memória visual aplicada à medicina.

Crie:
- uma cena visual forte e memorável
- associação visual item por item
- prompt de imagem didática

Regras:
- representar todos os termos
- manter fidelidade médica
- ser útil para aula e revisão
- o prompt_imagem deve ser em INGLÊS para o gerador de imagem
- descrever uma cena única, coesa, estilo infográfico médico/cartoon limpo
- proibido incluir textos, letras ou rótulos na cena
- usar alto contraste e cores saturadas sobre fundo branco

REGRAS OBRIGATÓRIAS para prompt_imagem:
O prompt DEVE começar com: "Clean medical infographic illustration, flat design, high contrast, saturated colors, pure white background, no text, no labels, no letters."
Depois descreva a cena com objetos claros e distintos.

Retorne SOMENTE JSON válido com:
{
  "cena_visual": "string",
  "associacoes_visuais": [
    { "termo": "string", "elemento_visual": "string" }
  ],
  "prompt_imagem": "string"
}`;

const PROMPT_CONSOLIDADOR = `Você é o consolidador final do sistema de mnemônicos médicos.

Monte a melhor versão final possível.
Priorize:
- fidelidade clínica absoluta
- clareza didática
- valor de memorização
- utilidade em aula
- naturalidade em português do Brasil

Retorne SOMENTE JSON válido com:
{
  "sigla": "string",
  "frase_mnemonica": "string",
  "explicacao_tecnica": "string",
  "explicacao_didatica": "string",
  "cena_visual": "string",
  "prompt_imagem": "string",
  "alertas": ["string"]
}`;

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const val = Deno.env.get(name);
  if (!val) throw new Error(`Env var ${name} is missing`);
  return val;
}

function validatePayload(body: unknown): MnemonicRequest {
  if (!body || typeof body !== "object") throw new Error("Body inválido.");
  const b = body as Record<string, unknown>;

  const tema = (b.tema ?? b.topic) as string | undefined;
  const termos = (b.termos ?? b.items) as string[] | undefined;

  if (!tema || typeof tema !== "string" || !tema.trim())
    throw new Error("Campo 'tema' é obrigatório.");
  if (!Array.isArray(termos) || termos.length === 0)
    throw new Error("Campo 'termos' deve ser um array não vazio.");
  for (const t of termos) {
    if (typeof t !== "string" || !t.trim())
      throw new Error("Cada termo deve ser uma string não vazia.");
  }
  return {
    tema,
    termos,
    estilo: typeof b.estilo === "string" ? b.estilo : (typeof b.contentType === "string" ? b.contentType : undefined),
    publico: typeof b.publico === "string" ? b.publico : undefined,
  };
}

function normalizeTerms(tema: string, termos: string[]): { tema: string; termos: string[] } {
  const trimmedTema = tema.trim();
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of termos) {
    const trimmed = t.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      unique.push(trimmed);
    }
  }
  return { tema: trimmedTema, termos: unique };
}

function buildContext(req: MnemonicRequest): string {
  let ctx = `Tema: ${req.tema}\nTermos: ${req.termos.join(", ")}`;
  if (req.estilo) ctx += `\nEstilo desejado: ${req.estilo}`;
  if (req.publico) ctx += `\nPúblico-alvo: ${req.publico}`;
  return ctx;
}

async function getUserIdFromRequest(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    throw new Error("Token de autenticação ausente.");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id)
    throw new Error("Não foi possível autenticar o usuário.");
  return data.user.id;
}

// ══════════════════════════════════════════════════
// OPENAI CALL
// ══════════════════════════════════════════════════

const AGENT_TIMEOUT_MS = 15000;

async function callOpenAIJson<T>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: OPENAI_TEMP,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "unknown");
      throw new Error(`OpenAI HTTP ${resp.status}: ${errText.substring(0, 300)}`);
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI retornou content vazio.");

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(`OpenAI retornou JSON inválido: ${content.substring(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// ══════════════════════════════════════════════════
// IMAGE GENERATION VIA LOVABLE AI GATEWAY
// ══════════════════════════════════════════════════

async function generateImage(prompt: string): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    console.warn("LOVABLE_API_KEY not set, skipping image generation");
    return null;
  }

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate a clean medical infographic illustration: ${prompt}. Style: clean cartoon medical illustration, high contrast, saturated colors on white background. NO text, NO labels, NO letters in the image.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "unknown");
      console.error(`Image generation failed: HTTP ${resp.status}: ${errText}`);
      return null;
    }

    const json = await resp.json();
    const imageUrl = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.warn("Image generation returned no image");
      return null;
    }

    // Upload to Supabase Storage
    return await uploadImageToStorage(imageUrl);
  } catch (err) {
    console.error("Image generation error:", err);
    return null;
  }
}

async function uploadImageToStorage(base64DataUrl: string): Promise<string | null> {
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Extract base64 data
    const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const fileName = `mnemonics/${crypto.randomUUID()}.png`;

    const { error } = await db.storage
      .from("question-images")
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error.message);
      return null;
    }

    const { data: publicUrl } = db.storage.from("question-images").getPublicUrl(fileName);
    return publicUrl?.publicUrl ?? null;
  } catch (err) {
    console.error("Upload to storage failed:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════
// DATABASE HELPERS
// ══════════════════════════════════════════════════

function getServiceClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function insertRequest(
  db: SupabaseClient,
  userId: string,
  payload: MnemonicRequest,
): Promise<string> {
  const { data, error } = await db
    .from("mnemonic_requests")
    .insert({
      user_id: userId,
      tema: payload.tema,
      termos_json: payload.termos,
      estilo: payload.estilo ?? "acronimo",
      publico: payload.publico ?? "residencia",
      status: "processing",
      source: "lovable-ui",
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(`Falha ao criar request: ${error?.message}`);
  return data.id as string;
}

async function updateRequestStatus(
  db: SupabaseClient,
  requestId: string,
  status: "completed" | "failed",
): Promise<void> {
  const { error } = await db
    .from("mnemonic_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) console.error(`Falha ao atualizar request status: ${error.message}`);
}

async function insertAgentLog(
  db: SupabaseClient,
  params: {
    request_id: string;
    result_id?: string;
    user_id: string;
    agent_name: string;
    execution_order: number;
    status: "completed" | "failed";
    input_json: unknown;
    output_json: unknown;
    score?: number;
    duration_ms: number;
    error_message?: string;
  },
): Promise<void> {
  const { error } = await db.from("mnemonic_agent_logs").insert({
    request_id: params.request_id,
    result_id: params.result_id ?? null,
    user_id: params.user_id,
    agent_name: params.agent_name,
    execution_order: params.execution_order,
    status: params.status,
    input_json: params.input_json,
    output_json: params.output_json,
    score: params.score ?? null,
    duration_ms: params.duration_ms,
    error_message: params.error_message ?? null,
  });
  if (error) console.error(`Log insert failed for ${params.agent_name}: ${error.message}`);
}

async function insertResult(
  db: SupabaseClient,
  params: {
    request_id: string;
    user_id: string;
    tema: string;
    consolidated: ConsolidatedOutput;
    visual: VisualOutput;
    score_medico: number;
    score_pedagogico: number;
    score_linguistico: number;
    score_final: number;
    aprovado: boolean;
    aprovado_medico: boolean;
    aprovado_pedagogico: boolean;
    image_url: string | null;
  },
): Promise<string> {
  const { data: existing } = await db
    .from("mnemonic_results")
    .select("versao")
    .eq("request_id", params.request_id)
    .eq("is_latest", true)
    .order("versao", { ascending: false })
    .limit(1);

  const versao = existing && existing.length > 0 ? (existing[0].versao as number) + 1 : 1;

  const { data, error } = await db
    .from("mnemonic_results")
    .insert({
      request_id: params.request_id,
      user_id: params.user_id,
      tema: params.tema,
      sigla: params.consolidated.sigla,
      frase_mnemonica: params.consolidated.frase_mnemonica,
      explicacao_tecnica: params.consolidated.explicacao_tecnica,
      explicacao_didatica: params.consolidated.explicacao_didatica,
      cena_visual: params.consolidated.cena_visual,
      prompt_imagem: params.consolidated.prompt_imagem,
      associacoes_json: params.visual.associacoes_visuais ?? [],
      associacoes_visuais_json: params.visual.associacoes_visuais ?? [],
      alertas_json: params.consolidated.alertas ?? [],
      score_medico: params.score_medico,
      score_pedagogico: params.score_pedagogico,
      score_linguistico: params.score_linguistico,
      score_final: params.score_final,
      aprovado: params.aprovado,
      aprovado_medico: params.aprovado_medico,
      aprovado_pedagogico: params.aprovado_pedagogico,
      image_url: params.image_url,
      versao,
      is_latest: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(`Falha ao salvar resultado: ${error?.message}`);
  return data.id as string;
}

// ══════════════════════════════════════════════════
// AGENT RUNNER
// ══════════════════════════════════════════════════

async function runAgent<T>(
  apiKey: string,
  db: SupabaseClient,
  requestId: string,
  userId: string,
  agentName: string,
  order: number,
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const start = Date.now();
  try {
    const output = await callOpenAIJson<T>(apiKey, systemPrompt, userPrompt);
    const duration = Date.now() - start;

    const outRecord = output as Record<string, unknown>;
    const score = typeof outRecord.score_medico === "number"
      ? outRecord.score_medico
      : typeof outRecord.score_pedagogico === "number"
        ? outRecord.score_pedagogico
        : typeof outRecord.score_linguistico === "number"
          ? outRecord.score_linguistico
          : undefined;

    // Truncate output for logs to keep DB lean
    const safeOutput = (() => {
      try {
        const s = JSON.stringify(output);
        return s.length > 1000 ? { _truncated: true, preview: s.substring(0, 500) } : output;
      } catch { return { _error: "non-serializable" }; }
    })();

    await insertAgentLog(db, {
      request_id: requestId,
      user_id: userId,
      agent_name: agentName,
      execution_order: order,
      status: "completed",
      input_json: { userPrompt: userPrompt.substring(0, 500) },
      output_json: safeOutput,
      score: score as number | undefined,
      duration_ms: duration,
    });

    return output;
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);

    await insertAgentLog(db, {
      request_id: requestId,
      user_id: userId,
      agent_name: agentName,
      execution_order: order,
      status: "failed",
      input_json: { userPrompt: userPrompt.substring(0, 500) },
      output_json: null,
      duration_ms: duration,
      error_message: msg,
    });

    throw new Error(`Agente ${agentName} falhou: ${msg}`);
  }
}

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método não permitido." }, 405);
  }

  let requestId: string | null = null;
  let db: SupabaseClient | null = null;

  try {
    // 1. Validate env vars
    const openaiKey = requireEnv("OPENAI_API_KEY");
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_ANON_KEY");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    // 2. Parse & validate body
    const rawBody = await req.json().catch(() => null);
    const payload = validatePayload(rawBody);

    // 3. Normalize
    const normalized = normalizeTerms(payload.tema, payload.termos);
    payload.tema = normalized.tema;
    payload.termos = normalized.termos;

    // 4. Authenticate user
    const userId = await getUserIdFromRequest(req);

    // 5. Init DB client (service role)
    db = getServiceClient();

    // 6. Insert request
    requestId = await insertRequest(db, userId, payload);

    // 7. Build context
    const context = buildContext(payload);
    let order = 0;

    // ──────────────────────────────────────────────
    // AGENT 1: GERADOR
    // ──────────────────────────────────────────────
    let generated = await runAgent<GeneratorOutput>(
      openaiKey, db, requestId, userId, "gerador", ++order, PROMPT_GERADOR, context,
    );

    // ──────────────────────────────────────────────
    // AGENT 2: AUDITOR LINGUÍSTICO PT-BR
    // ──────────────────────────────────────────────
    const lingPrompt = `${context}\n\nMnemônico gerado:\n${JSON.stringify(generated, null, 2)}`;
    let lingAudit = await runAgent<LinguisticAuditOutput>(
      openaiKey, db, requestId, userId, "auditor_linguistico_ptbr", ++order, PROMPT_AUDITOR_LINGUISTICO, lingPrompt,
    );

    // ──────────────────────────────────────────────
    // RETRY LINGUÍSTICO (se score < 85 ou não soa natural)
    // ──────────────────────────────────────────────
    const fluidezFala = typeof lingAudit.fluidez_fala === "number" ? lingAudit.fluidez_fala : 100;
    if (lingAudit.score_linguistico < SCORE_LINGUISTICO_MIN || fluidezFala < 80 || !lingAudit.soa_natural || !lingAudit.tem_sentido) {
      console.log(`Score linguístico ${lingAudit.score_linguistico} < ${SCORE_LINGUISTICO_MIN} ou não natural. Retry...`);

      if (lingAudit.versao_corrigida) {
        generated = lingAudit.versao_corrigida;
      }

      const retryLingPrompt = `${context}\n\nA versão anterior falhou na auditoria linguística (score: ${lingAudit.score_linguistico}/100).\nProblemas: ${(lingAudit.problemas_linguisticos || []).join("; ")}\n\nCrie uma nova versão que soe NATURAL em português do Brasil. A frase deve parecer algo que um professor brasileiro realmente falaria em aula. Evite construções artificiais.`;

      const retryGen = await runAgent<GeneratorOutput>(
        openaiKey, db, requestId, userId, "retry_linguistico", ++order, PROMPT_GERADOR, retryLingPrompt,
      );

      // Re-audit linguistically
      const retryLingAuditPrompt = `${context}\n\nMnemônico gerado (retry linguístico):\n${JSON.stringify(retryGen, null, 2)}`;
      const retryLingAudit = await runAgent<LinguisticAuditOutput>(
        openaiKey, db, requestId, userId, "auditor_linguistico_ptbr", ++order, PROMPT_AUDITOR_LINGUISTICO, retryLingAuditPrompt,
      );

      if (retryLingAudit.score_linguistico >= lingAudit.score_linguistico) {
        lingAudit = retryLingAudit;
        generated = retryLingAudit.versao_corrigida ?? retryGen;
      }
    } else if (lingAudit.versao_corrigida) {
      generated = lingAudit.versao_corrigida;
    }

    // ──────────────────────────────────────────────
    // AGENT 3: AUDITOR MÉDICO
    // ──────────────────────────────────────────────
    const auditMedPrompt = `${context}\n\nMnemônico gerado:\n${JSON.stringify(generated, null, 2)}`;
    let medAudit = await runAgent<MedicalAuditOutput>(
      openaiKey, db, requestId, userId, "auditor_medico", ++order, PROMPT_AUDITOR_MEDICO, auditMedPrompt,
    );

    // ──────────────────────────────────────────────
    // RETRY MÉDICO (se score < 90)
    // ──────────────────────────────────────────────
    let approvedVersion: GeneratorOutput = medAudit.versao_corrigida ?? generated;

    if (medAudit.score_medico < SCORE_MEDICO_MIN) {
      console.log(`Score médico ${medAudit.score_medico} < ${SCORE_MEDICO_MIN}. Retry...`);

      const retryPrompt = `${context}\n\nA versão anterior falhou na auditoria médica (score: ${medAudit.score_medico}/100).\nErros detectados: ${(medAudit.erros_encontrados || []).join("; ")}\n\nCrie uma versão melhorada corrigindo todos os erros apontados. Mantenha a naturalidade em português do Brasil.`;

      const retryGen = await runAgent<GeneratorOutput>(
        openaiKey, db, requestId, userId, "retry_gerador", ++order, PROMPT_GERADOR, retryPrompt,
      );

      const retryAuditPrompt = `${context}\n\nMnemônico gerado (retry):\n${JSON.stringify(retryGen, null, 2)}`;
      const retryMed = await runAgent<MedicalAuditOutput>(
        openaiKey, db, requestId, userId, "retry_auditor_medico", ++order, PROMPT_AUDITOR_MEDICO, retryAuditPrompt,
      );

      if (retryMed.score_medico >= medAudit.score_medico) {
        medAudit = retryMed;
        approvedVersion = retryMed.versao_corrigida ?? retryGen;
      }
    }

    // ──────────────────────────────────────────────
    // AGENT 4: AUDITOR PEDAGÓGICO (resiliente)
    // ──────────────────────────────────────────────
    let pedAudit: PedagogicalAuditOutput = {
      score_pedagogico: 75, facilidade_memorizacao: 75, clareza: 75,
      associacao_mental: 75, aplicabilidade_em_aula: 75, aplicabilidade_em_prova: 75,
      pontos_fortes: [], pontos_fracos: [],
    };
    try {
      const pedPrompt = `${context}\n\nMnemônico aprovado médicamente:\n${JSON.stringify(approvedVersion, null, 2)}`;
      pedAudit = await runAgent<PedagogicalAuditOutput>(
        openaiKey, db, requestId, userId, "auditor_pedagogico", ++order, PROMPT_AUDITOR_PEDAGOGICO, pedPrompt,
      );

      // RETRY PEDAGÓGICO (se score < 85)
      if (pedAudit.score_pedagogico < SCORE_PEDAGOGICO_MIN) {
        console.log(`Score pedagógico ${pedAudit.score_pedagogico} < ${SCORE_PEDAGOGICO_MIN}. Retry...`);
        const retryPedPrompt = `${context}\n\nMnemônico:\n${JSON.stringify(approvedVersion, null, 2)}\n\nA versão anterior teve baixa performance pedagógica (score: ${pedAudit.score_pedagogico}/100).\nPontos fracos: ${(pedAudit.pontos_fracos || []).join("; ")}\n\nReavalie e produza uma versão otimizada.`;
        const retryPed = await runAgent<PedagogicalAuditOutput>(
          openaiKey, db, requestId, userId, "retry_auditor_pedagogico", ++order, PROMPT_AUDITOR_PEDAGOGICO, retryPedPrompt,
        );
        if (retryPed.score_pedagogico >= pedAudit.score_pedagogico) pedAudit = retryPed;
      }
    } catch (pedErr) {
      console.error("Pedagogical audit failed, using defaults:", pedErr);
    }

    // Apply pedagogical optimizations
    if (pedAudit.versao_otimizada) {
      if (pedAudit.versao_otimizada.frase_mnemonica) {
        approvedVersion.frase_mnemonica = pedAudit.versao_otimizada.frase_mnemonica;
      }
      if (pedAudit.versao_otimizada.explicacao_didatica) {
        approvedVersion.explicacao_didatica = pedAudit.versao_otimizada.explicacao_didatica;
      }
    }

    // ──────────────────────────────────────────────
    // AGENT 5: VISUAL (resiliente)
    // ──────────────────────────────────────────────
    let visual: VisualOutput = {
      cena_visual: approvedVersion.frase_mnemonica,
      associacoes_visuais: [],
      prompt_imagem: `Clean medical infographic illustration of ${approvedVersion.sigla}, flat design, white background, no text`,
    };
    try {
      const visualPrompt = `${context}\n\nMnemônico final:\nSigla: ${approvedVersion.sigla}\nFrase: ${approvedVersion.frase_mnemonica}`;
      visual = await runAgent<VisualOutput>(
        openaiKey, db, requestId, userId, "visual", ++order, PROMPT_VISUAL, visualPrompt,
      );
    } catch (visErr) {
      console.error("Visual agent failed, using fallback:", visErr);
    }

    // ──────────────────────────────────────────────
    // AGENT 6: GERADOR DE IMAGEM
    // ──────────────────────────────────────────────
    let imageUrl: string | null = null;
    const imgStart = Date.now();
    try {
      imageUrl = await generateImage(visual.prompt_imagem);
      await insertAgentLog(db, {
        request_id: requestId,
        user_id: userId,
        agent_name: "gerador_imagem",
        execution_order: ++order,
        status: imageUrl ? "completed" : "failed",
        input_json: { prompt: visual.prompt_imagem.substring(0, 500) },
        output_json: { image_url: imageUrl },
        duration_ms: Date.now() - imgStart,
        error_message: imageUrl ? undefined : "Image generation returned null",
      });
    } catch (imgErr) {
      console.error("Image generation agent error:", imgErr);
      await insertAgentLog(db, {
        request_id: requestId,
        user_id: userId,
        agent_name: "gerador_imagem",
        execution_order: ++order,
        status: "failed",
        input_json: { prompt: visual.prompt_imagem.substring(0, 500) },
        output_json: null,
        duration_ms: Date.now() - imgStart,
        error_message: imgErr instanceof Error ? imgErr.message : String(imgErr),
      });
    }

    // ──────────────────────────────────────────────
    // AGENT 7: CONSOLIDADOR
    // ──────────────────────────────────────────────
    const consolidatorPrompt = `${context}

Mnemônico aprovado:
${JSON.stringify(approvedVersion, null, 2)}

Auditoria linguística:
Score: ${lingAudit.score_linguistico}

Auditoria médica:
Score: ${medAudit.score_medico}
Erros: ${(medAudit.erros_encontrados || []).join("; ") || "Nenhum"}

Auditoria pedagógica:
Score: ${pedAudit.score_pedagogico}
Pontos fortes: ${(pedAudit.pontos_fortes || []).join("; ")}
Pontos fracos: ${(pedAudit.pontos_fracos || []).join("; ") || "Nenhum"}

Cena visual: ${visual.cena_visual}
Prompt imagem: ${visual.prompt_imagem}`;

    const consolidated = await runAgent<ConsolidatedOutput>(
      openaiKey, db, requestId, userId, "consolidador", ++order, PROMPT_CONSOLIDADOR, consolidatorPrompt,
    );

    // ──────────────────────────────────────────────
    // SCORES & PERSIST
    // ──────────────────────────────────────────────
    const scoreLinguistico = Math.max(0, Math.min(100, Math.round(lingAudit.score_linguistico)));
    const scoreMedico = Math.max(0, Math.min(100, Math.round(medAudit.score_medico)));
    const scorePedagogico = Math.max(0, Math.min(100, Math.round(pedAudit.score_pedagogico)));
    const scoreFinal = Math.round((scoreMedico + scorePedagogico + scoreLinguistico) / 3);
    const aprovadoMedico = scoreMedico >= SCORE_MEDICO_MIN;
    const aprovadoPedagogico = scorePedagogico >= SCORE_PEDAGOGICO_MIN;
    const aprovado = aprovadoMedico && aprovadoPedagogico;

    const resultId = await insertResult(db, {
      request_id: requestId,
      user_id: userId,
      tema: payload.tema,
      consolidated,
      visual,
      score_medico: scoreMedico,
      score_pedagogico: scorePedagogico,
      score_linguistico: scoreLinguistico,
      score_final: scoreFinal,
      aprovado,
      aprovado_medico: aprovadoMedico,
      aprovado_pedagogico: aprovadoPedagogico,
      image_url: imageUrl,
    });

    await updateRequestStatus(db, requestId, "completed");

    // ──────────────────────────────────────────────
    // RESPONSE
    // ──────────────────────────────────────────────
    return jsonResponse({
      success: true,
      data: {
        request_id: requestId,
        result_id: resultId,
        tema: payload.tema,
        sigla: consolidated.sigla,
        frase_mnemonica: consolidated.frase_mnemonica,
        explicacao_tecnica: consolidated.explicacao_tecnica,
        explicacao_didatica: consolidated.explicacao_didatica,
        cena_visual: consolidated.cena_visual,
        prompt_imagem: consolidated.prompt_imagem,
        image_url: imageUrl,
        score_medico: scoreMedico,
        score_pedagogico: scorePedagogico,
        score_linguistico: scoreLinguistico,
        score_final: scoreFinal,
        alertas: consolidated.alertas ?? [],
        agentes: {
          gerador: generated,
          auditor_linguistico_ptbr: lingAudit,
          auditor_medico: medAudit,
          auditor_pedagogico: pedAudit,
          visual,
          consolidador: consolidated,
        },
      },
    });
  } catch (error) {
    console.error("generate-mnemonic error:", error);

    if (requestId && db) {
      try {
        await updateRequestStatus(db, requestId, "failed");
      } catch (updateErr) {
        console.error("Failed to update request status to failed:", updateErr);
      }
    }

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro interno na Edge Function.",
      },
      500,
    );
  }
});
