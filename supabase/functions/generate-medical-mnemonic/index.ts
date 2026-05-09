import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";

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
  observacoes?: string[];
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

const OPENAI_MODEL = "google/gemini-2.5-flash";
const OPENAI_TEMP = 1.0; // Fixed: gpt-5-mini only supports default (1.0)
const SCORE_MEDICO_MIN = 90;
const SCORE_PEDAGOGICO_MIN = 85;

// ══════════════════════════════════════════════════
// PROMPTS
// ══════════════════════════════════════════════════

const PROMPT_GERADOR = `Você é um professor de medicina e especialista em memorização clínica.
Crie mnemônicos médicos com altíssima fidelidade.

Regras:
- incluir todos os termos sem omitir nenhum
- não trocar sentido clínico
- não usar sinônimos que alterem precisão
- a sigla deve respeitar os termos
- a frase deve ser útil em aula médica

Retorne SOMENTE JSON válido com:
{
  "sigla": "string",
  "frase_mnemonica": "string",
  "explicacao_tecnica": "string",
  "explicacao_didatica": "string",
  "associacoes": [
    { "letra": "string", "termo_original": "string", "representacao_no_mnemonico": "string" }
  ],
  "observacoes": ["string"]
}`;

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

  // Accept both formats: tema/termos (new) and topic/items (legacy unified service)
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

async function callOpenAIJson<T>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      ...(OPENAI_MODEL.includes("gpt") ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown");
    throw new Error(`OpenAI HTTP ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI retornou content vazio.");

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`OpenAI retornou JSON inválido: ${content.substring(0, 200)}`);
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
    score_final: number;
    aprovado: boolean;
    aprovado_medico: boolean;
    aprovado_pedagogico: boolean;
  },
): Promise<string> {
  // Calculate version
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
      score_final: params.score_final,
      aprovado: params.aprovado,
      aprovado_medico: params.aprovado_medico,
      aprovado_pedagogico: params.aprovado_pedagogico,
      versao,
      is_latest: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(`Falha ao salvar resultado: ${error?.message}`);
  return data.id as string;
}

// ══════════════════════════════════════════════════
// AGENT RUNNERS
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
        : undefined;

    await insertAgentLog(db, {
      request_id: requestId,
      user_id: userId,
      agent_name: agentName,
      execution_order: order,
      status: "completed",
      input_json: { userPrompt: userPrompt.substring(0, 500) },
      output_json: output,
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

function runGenerator(apiKey: string, db: SupabaseClient, requestId: string, userId: string, order: number, userPrompt: string) {
  return runAgent<GeneratorOutput>(apiKey, db, requestId, userId, "gerador", order, PROMPT_GERADOR, userPrompt);
}

function runMedicalAudit(apiKey: string, db: SupabaseClient, requestId: string, userId: string, order: number, userPrompt: string) {
  return runAgent<MedicalAuditOutput>(apiKey, db, requestId, userId, "auditor_medico", order, PROMPT_AUDITOR_MEDICO, userPrompt);
}

function runPedagogicalAudit(apiKey: string, db: SupabaseClient, requestId: string, userId: string, order: number, userPrompt: string) {
  return runAgent<PedagogicalAuditOutput>(apiKey, db, requestId, userId, "auditor_pedagogico", order, PROMPT_AUDITOR_PEDAGOGICO, userPrompt);
}

function runVisualAgent(apiKey: string, db: SupabaseClient, requestId: string, userId: string, order: number, userPrompt: string) {
  return runAgent<VisualOutput>(apiKey, db, requestId, userId, "visual", order, PROMPT_VISUAL, userPrompt);
}

function runConsolidator(apiKey: string, db: SupabaseClient, requestId: string, userId: string, order: number, userPrompt: string) {
  return runAgent<ConsolidatedOutput>(apiKey, db, requestId, userId, "consolidador", order, PROMPT_CONSOLIDADOR, userPrompt);
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
    const generated = await runGenerator(openaiKey, db, requestId, userId, ++order, context);

    // ──────────────────────────────────────────────
    // AGENT 2: AUDITOR MÉDICO
    // ──────────────────────────────────────────────
    const auditMedPrompt = `${context}\n\nMnemônico gerado:\n${JSON.stringify(generated, null, 2)}`;
    let medAudit = await runMedicalAudit(openaiKey, db, requestId, userId, ++order, auditMedPrompt);

    // ──────────────────────────────────────────────
    // RETRY MÉDICO (se score < 90)
    // ──────────────────────────────────────────────
    let approvedVersion: GeneratorOutput = medAudit.versao_corrigida ?? generated;

    if (medAudit.score_medico < SCORE_MEDICO_MIN) {
      console.log(`Score médico ${medAudit.score_medico} < ${SCORE_MEDICO_MIN}. Iniciando retry...`);

      const retryPrompt = `${context}\n\nA versão anterior falhou na auditoria médica (score: ${medAudit.score_medico}/100).\nErros detectados: ${(medAudit.erros_encontrados || []).join("; ")}\n\nCrie uma versão melhorada corrigindo todos os erros apontados.`;

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
    // AGENT 3: AUDITOR PEDAGÓGICO
    // ──────────────────────────────────────────────
    const pedPrompt = `${context}\n\nMnemônico aprovado médicamente:\n${JSON.stringify(approvedVersion, null, 2)}`;
    let pedAudit = await runPedagogicalAudit(openaiKey, db, requestId, userId, ++order, pedPrompt);

    // ──────────────────────────────────────────────
    // RETRY PEDAGÓGICO (se score < 85)
    // ──────────────────────────────────────────────
    if (pedAudit.score_pedagogico < SCORE_PEDAGOGICO_MIN) {
      console.log(`Score pedagógico ${pedAudit.score_pedagogico} < ${SCORE_PEDAGOGICO_MIN}. Iniciando retry...`);

      const retryPedPrompt = `${context}\n\nMnemônico:\n${JSON.stringify(approvedVersion, null, 2)}\n\nA versão anterior teve baixa performance pedagógica (score: ${pedAudit.score_pedagogico}/100).\nPontos fracos: ${(pedAudit.pontos_fracos || []).join("; ")}\n\nReavalie e produza uma versão otimizada.`;

      const retryPed = await runAgent<PedagogicalAuditOutput>(
        openaiKey, db, requestId, userId, "retry_auditor_pedagogico", ++order, PROMPT_AUDITOR_PEDAGOGICO, retryPedPrompt,
      );

      if (retryPed.score_pedagogico >= pedAudit.score_pedagogico) {
        pedAudit = retryPed;
      }
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
    // AGENT 4: VISUAL
    // ──────────────────────────────────────────────
    const visualPrompt = `${context}\n\nMnemônico final:\nSigla: ${approvedVersion.sigla}\nFrase: ${approvedVersion.frase_mnemonica}`;
    const visual = await runVisualAgent(openaiKey, db, requestId, userId, ++order, visualPrompt);

    // ──────────────────────────────────────────────
    // AGENT 5: CONSOLIDADOR
    // ──────────────────────────────────────────────
    const consolidatorPrompt = `${context}

Mnemônico aprovado:
${JSON.stringify(approvedVersion, null, 2)}

Auditoria médica:
Score: ${medAudit.score_medico}
Erros: ${(medAudit.erros_encontrados || []).join("; ") || "Nenhum"}

Auditoria pedagógica:
Score: ${pedAudit.score_pedagogico}
Pontos fortes: ${(pedAudit.pontos_fortes || []).join("; ")}
Pontos fracos: ${(pedAudit.pontos_fracos || []).join("; ") || "Nenhum"}

Cena visual: ${visual.cena_visual}
Prompt imagem: ${visual.prompt_imagem}`;

    const consolidated = await runConsolidator(openaiKey, db, requestId, userId, ++order, consolidatorPrompt);

    // ──────────────────────────────────────────────
    // SCORES & PERSIST
    // ──────────────────────────────────────────────
    const scoreMedico = Math.max(0, Math.min(100, Math.round(medAudit.score_medico)));
    const scorePedagogico = Math.max(0, Math.min(100, Math.round(pedAudit.score_pedagogico)));
    const scoreFinal = Math.round((scoreMedico + scorePedagogico) / 2);
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
      score_final: scoreFinal,
      aprovado,
      aprovado_medico: aprovadoMedico,
      aprovado_pedagogico: aprovadoPedagogico,
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
        score_medico: scoreMedico,
        score_pedagogico: scorePedagogico,
        score_final: scoreFinal,
        alertas: consolidated.alertas ?? [],
        agentes: {
          gerador: generated,
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
