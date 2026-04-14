import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

interface GeneratorOutput {
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  associacoes: Array<{
    letra: string;
    termo_original: string;
    representacao_no_mnemonico: string;
  }>;
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
  associacoes_visuais: Array<{
    termo: string;
    elemento_visual: string;
  }>;
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

interface AgentResult {
  gerador?: unknown;
  auditor_medico?: unknown;
  auditor_pedagogico?: unknown;
  visual?: unknown;
  consolidador?: unknown;
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

function extractJSON(raw: string): any | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    const cleaned = m[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try { return JSON.parse(cleaned); } catch { return null; }
  }
}

async function callAI<T>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2
): Promise<T> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("CREDITS_EXHAUSTED");
    const errText = await resp.text();
    throw new Error(`AI error: ${status} - ${errText}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJSON(content);
  if (!parsed) throw new Error("Failed to parse AI JSON response");
  return parsed as T;
}

function validatePayload(payload: MnemonicRequest): string | null {
  if (!payload) return "Body ausente.";
  if (!payload.tema || typeof payload.tema !== "string" || payload.tema.trim().length < 2)
    return "Campo 'tema' é obrigatório (mínimo 2 caracteres).";
  if (!Array.isArray(payload.termos) || payload.termos.length === 0)
    return "Campo 'termos' deve ser um array com pelo menos 1 item.";
  if (payload.termos.some((t) => typeof t !== "string" || !t.trim()))
    return "Todos os termos devem ser strings não vazias.";
  return null;
}

function normalizeTerms(termos: string[]): string[] {
  const seen = new Set<string>();
  return termos
    .map((t) => t.trim())
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildCommonContext(payload: MnemonicRequest): string {
  return `Tema: ${payload.tema}
Termos: ${JSON.stringify(payload.termos)}
Estilo: ${payload.estilo ?? "frase + imagem mental"}
Público: ${payload.publico ?? "graduação médica"}`;
}

// ══════════════════════════════════════════════════
// SUPABASE + AUTH
// ══════════════════════════════════════════════════

function getServiceClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Authorization header ausente.");
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new Error("Token inválido.");

  const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Não foi possível identificar o usuário.");
  return data.claims.sub as string;
}

// ══════════════════════════════════════════════════
// DB OPERATIONS
// ══════════════════════════════════════════════════

async function createRequest(sb: any, userId: string, payload: MnemonicRequest): Promise<string> {
  const { data, error } = await sb
    .from("mnemonic_requests")
    .insert({
      user_id: userId,
      tema: payload.tema,
      termos_json: payload.termos,
      estilo: payload.estilo ?? "frase + imagem mental",
      publico: payload.publico ?? "graduação médica",
      status: "processing",
      source: "lovable-ui",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Erro ao criar request: ${error.message}`);
  return data.id;
}

async function updateRequestStatus(sb: any, requestId: string, status: string) {
  await sb.from("mnemonic_requests").update({ status }).eq("id", requestId);
}

async function insertAgentLog(sb: any, params: {
  requestId: string;
  resultId?: string | null;
  userId: string;
  agentName: string;
  executionOrder: number;
  status: string;
  inputJson: unknown;
  outputJson: unknown;
  score?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
}) {
  await sb.from("mnemonic_agent_logs").insert({
    request_id: params.requestId,
    result_id: params.resultId ?? null,
    user_id: params.userId,
    agent_name: params.agentName,
    execution_order: params.executionOrder,
    status: params.status,
    input_json: params.inputJson ?? {},
    output_json: params.outputJson ?? {},
    score: params.score ?? null,
    duration_ms: params.durationMs ?? null,
    error_message: params.errorMessage ?? null,
  });
}

async function insertResult(sb: any, params: {
  requestId: string;
  userId: string;
  payload: MnemonicRequest;
  consolidated: ConsolidatedOutput;
  approvedVersion: GeneratorOutput;
  medicalAudit: MedicalAuditOutput;
  pedagogicalAudit: PedagogicalAuditOutput;
  visualOutput: VisualOutput;
  scoreFinal: number;
}): Promise<string> {
  const aprovadoMedico = (params.medicalAudit.score_medico ?? 0) >= 90;
  const aprovadoPedagogico = (params.pedagogicalAudit.score_pedagogico ?? 0) >= 85;

  const { data: existing } = await sb
    .from("mnemonic_results")
    .select("versao")
    .eq("request_id", params.requestId)
    .eq("is_latest", true)
    .order("versao", { ascending: false })
    .limit(1);

  const nextVersion = existing?.length ? Number(existing[0].versao || 1) + 1 : 1;

  const { data, error } = await sb
    .from("mnemonic_results")
    .insert({
      request_id: params.requestId,
      user_id: params.userId,
      tema: params.payload.tema,
      sigla: params.consolidated.sigla,
      frase_mnemonica: params.consolidated.frase_mnemonica,
      explicacao_tecnica: params.consolidated.explicacao_tecnica,
      explicacao_didatica: params.consolidated.explicacao_didatica,
      cena_visual: params.consolidated.cena_visual,
      prompt_imagem: params.consolidated.prompt_imagem,
      associacoes_json: params.approvedVersion.associacoes ?? [],
      associacoes_visuais_json: params.visualOutput.associacoes_visuais ?? [],
      alertas_json: params.consolidated.alertas ?? [],
      score_medico: params.medicalAudit.score_medico ?? 0,
      score_pedagogico: params.pedagogicalAudit.score_pedagogico ?? 0,
      score_final: params.scoreFinal,
      aprovado: aprovadoMedico && aprovadoPedagogico,
      aprovado_medico: aprovadoMedico,
      aprovado_pedagogico: aprovadoPedagogico,
      versao: nextVersion,
      is_latest: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Erro ao inserir resultado: ${error.message}`);
  return data.id;
}

// ══════════════════════════════════════════════════
// AGENT PROMPTS
// ══════════════════════════════════════════════════

const GENERATOR_SYSTEM = `Você é um professor de medicina e especialista em memorização clínica.
Crie mnemônicos médicos com altíssima fidelidade.

REGRAS:
- incluir todos os termos sem omitir nenhum
- não trocar sentido clínico
- não usar sinônimos que alterem precisão
- a sigla deve respeitar os termos
- a frase deve ser útil em aula médica

Retorne JSON com:
{
  "sigla": "string",
  "frase_mnemonica": "string",
  "explicacao_tecnica": "string",
  "explicacao_didatica": "string",
  "associacoes": [{"letra":"string","termo_original":"string","representacao_no_mnemonico":"string"}],
  "observacoes": ["string"]
}`;

const MEDICAL_AUDITOR_SYSTEM = `Você é um auditor médico extremamente rigoroso.
Sua missão: detectar omissões, distorções semânticas, erro de associação letra-termo, risco clínico.
Dê nota de 0 a 100. Se houver falha relevante, produza uma versão corrigida.

Retorne JSON com:
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
Se precisar corrigir, "versao_corrigida" deve ter o mesmo schema do gerador.`;

const PEDAGOGICAL_AUDITOR_SYSTEM = `Você é especialista em educação médica e neuroaprendizado.
Avalie: facilidade de memorização, clareza, associação mental, aplicabilidade em aula e prova.
Dê nota de 0 a 100.

Retorne JSON com:
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
}`;

const VISUAL_SYSTEM = `Você é especialista em memória visual aplicada à medicina.
Crie: cena visual forte e memorável, associação visual item por item, prompt de imagem didática.
Regras: representar todos os termos, manter fidelidade médica.

Retorne JSON com:
{
  "cena_visual": "string",
  "associacoes_visuais": [{"termo":"string","elemento_visual":"string"}],
  "prompt_imagem": "string"
}`;

const CONSOLIDATOR_SYSTEM = `Você é o consolidador final do sistema de mnemônicos médicos.
Monte a melhor versão final. Priorize fidelidade clínica, clareza didática, memorização.

Retorne JSON com:
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
// MAIN HANDLER
// ══════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido." }, 405);

  let requestId: string | null = null;
  const sb = getServiceClient();

  try {
    const apiKey = getEnv("LOVABLE_API_KEY");
    const payload = (await req.json()) as MnemonicRequest;
    const validationError = validatePayload(payload);
    if (validationError) return json({ success: false, error: validationError }, 400);

    payload.tema = payload.tema.trim();
    payload.termos = normalizeTerms(payload.termos);

    const userId = await getUserId(req);
    requestId = await createRequest(sb, userId, payload);
    const ctx = buildCommonContext(payload);
    const agents: AgentResult = {};

    // ── 1) GERADOR ──
    const genStart = Date.now();
    let generated: GeneratorOutput;
    try {
      generated = await callAI<GeneratorOutput>(apiKey, GENERATOR_SYSTEM,
        `Gere o mnemônico médico inicial:\n\n${ctx}`);
      agents.gerador = generated;
      await insertAgentLog(sb, { requestId, userId, agentName: "gerador", executionOrder: 1, status: "completed", inputJson: payload, outputJson: generated, durationMs: Date.now() - genStart });
    } catch (err) {
      await insertAgentLog(sb, { requestId, userId, agentName: "gerador", executionOrder: 1, status: "failed", inputJson: payload, outputJson: {}, durationMs: Date.now() - genStart, errorMessage: String(err) });
      if ((err as Error).message === "RATE_LIMIT") return json({ success: false, error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
      if ((err as Error).message === "CREDITS_EXHAUSTED") return json({ success: false, error: "Créditos de IA esgotados." }, 402);
      throw err;
    }

    // ── 2) AUDITOR MÉDICO ──
    const medStart = Date.now();
    let medicalAudit: MedicalAuditOutput;
    try {
      medicalAudit = await callAI<MedicalAuditOutput>(apiKey, MEDICAL_AUDITOR_SYSTEM,
        `Audite clinicamente:\n\nCONTEXTO:\n${ctx}\n\nMNEMÔNICO:\n${JSON.stringify(generated, null, 2)}`);
      agents.auditor_medico = medicalAudit;
      await insertAgentLog(sb, { requestId, userId, agentName: "auditor_medico", executionOrder: 2, status: "completed", inputJson: { payload, generated }, outputJson: medicalAudit, score: medicalAudit.score_medico, durationMs: Date.now() - medStart });
    } catch (err) {
      await insertAgentLog(sb, { requestId, userId, agentName: "auditor_medico", executionOrder: 2, status: "failed", inputJson: { payload, generated }, outputJson: {}, durationMs: Date.now() - medStart, errorMessage: String(err) });
      throw err;
    }

    let approvedVersion = generated;
    if (medicalAudit.versao_corrigida && medicalAudit.score_medico < 90) {
      approvedVersion = medicalAudit.versao_corrigida;
    }

    // ── 3) AUDITOR PEDAGÓGICO ──
    const pedStart = Date.now();
    let pedagogicalAudit: PedagogicalAuditOutput;
    try {
      pedagogicalAudit = await callAI<PedagogicalAuditOutput>(apiKey, PEDAGOGICAL_AUDITOR_SYSTEM,
        `Avalie pedagogicamente:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO:\n${JSON.stringify(approvedVersion, null, 2)}`);
      agents.auditor_pedagogico = pedagogicalAudit;
      await insertAgentLog(sb, { requestId, userId, agentName: "auditor_pedagogico", executionOrder: 3, status: "completed", inputJson: { payload, approvedVersion }, outputJson: pedagogicalAudit, score: pedagogicalAudit.score_pedagogico, durationMs: Date.now() - pedStart });
    } catch (err) {
      await insertAgentLog(sb, { requestId, userId, agentName: "auditor_pedagogico", executionOrder: 3, status: "failed", inputJson: { payload, approvedVersion }, outputJson: {}, durationMs: Date.now() - pedStart, errorMessage: String(err) });
      throw err;
    }

    // ── 4) VISUAL ──
    const visStart = Date.now();
    let visualOutput: VisualOutput;
    try {
      visualOutput = await callAI<VisualOutput>(apiKey, VISUAL_SYSTEM,
        `Crie a parte visual:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO APROVADA:\n${JSON.stringify(approvedVersion, null, 2)}\n\nSUGESTÕES:\n${JSON.stringify(pedagogicalAudit, null, 2)}`);
      agents.visual = visualOutput;
      await insertAgentLog(sb, { requestId, userId, agentName: "visual", executionOrder: 4, status: "completed", inputJson: { payload, approvedVersion }, outputJson: visualOutput, durationMs: Date.now() - visStart });
    } catch (err) {
      await insertAgentLog(sb, { requestId, userId, agentName: "visual", executionOrder: 4, status: "failed", inputJson: { payload, approvedVersion }, outputJson: {}, durationMs: Date.now() - visStart, errorMessage: String(err) });
      throw err;
    }

    // ── 5) CONSOLIDADOR ──
    const consStart = Date.now();
    let consolidated: ConsolidatedOutput;
    try {
      consolidated = await callAI<ConsolidatedOutput>(apiKey, CONSOLIDATOR_SYSTEM,
        `Consolide:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO:\n${JSON.stringify(approvedVersion, null, 2)}\n\nMÉDICO:\n${JSON.stringify(medicalAudit, null, 2)}\n\nPEDAGÓGICO:\n${JSON.stringify(pedagogicalAudit, null, 2)}\n\nVISUAL:\n${JSON.stringify(visualOutput, null, 2)}`);
      agents.consolidador = consolidated;
      await insertAgentLog(sb, { requestId, userId, agentName: "consolidador", executionOrder: 5, status: "completed", inputJson: { approvedVersion, medicalAudit, pedagogicalAudit, visualOutput }, outputJson: consolidated, durationMs: Date.now() - consStart });
    } catch (err) {
      await insertAgentLog(sb, { requestId, userId, agentName: "consolidador", executionOrder: 5, status: "failed", inputJson: { approvedVersion, medicalAudit, pedagogicalAudit, visualOutput }, outputJson: {}, durationMs: Date.now() - consStart, errorMessage: String(err) });
      throw err;
    }

    const scoreFinal = Math.round(((medicalAudit.score_medico ?? 0) + (pedagogicalAudit.score_pedagogico ?? 0)) / 2);

    const resultId = await insertResult(sb, {
      requestId, userId, payload, consolidated, approvedVersion,
      medicalAudit, pedagogicalAudit, visualOutput, scoreFinal,
    });

    await updateRequestStatus(sb, requestId, "completed");

    return json({
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
        score_medico: medicalAudit.score_medico,
        score_pedagogico: pedagogicalAudit.score_pedagogico,
        score_final: scoreFinal,
        alertas: consolidated.alertas ?? [],
        associacoes: approvedVersion.associacoes ?? [],
        associacoes_visuais: visualOutput.associacoes_visuais ?? [],
        image_url: null,
        items_map: (approvedVersion.associacoes ?? []).map(a => ({
          letter: a.letra,
          word: a.representacao_no_mnemonico,
          original_item: a.termo_original,
          symbol: null,
          symbol_reason: null,
        })),
        agent_logs: [
          { agent: "gerador", attempt: 1, status: "ok", details: `Sigla: ${generated.sigla}` },
          { agent: "auditor_medico", attempt: 1, status: medicalAudit.score_medico >= 90 ? "approved" : "rejected", details: `Score: ${medicalAudit.score_medico}` },
          { agent: "auditor_pedagogico", attempt: 1, status: pedagogicalAudit.score_pedagogico >= 85 ? "approved" : "rejected", details: `Score: ${pedagogicalAudit.score_pedagogico}` },
          { agent: "visual", attempt: 1, status: "ok", details: "Cena visual gerada" },
          { agent: "consolidador", attempt: 1, status: "ok", details: `Score final: ${scoreFinal}` },
        ],
        agentes: agents,
      },
    });
  } catch (error) {
    console.error("generate-medical-mnemonic error:", error);
    try {
      if (requestId) await updateRequestStatus(sb, requestId, "failed");
    } catch { /* don't mask original error */ }

    return json({
      success: false,
      error: "Erro ao gerar mnemônico médico.",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
