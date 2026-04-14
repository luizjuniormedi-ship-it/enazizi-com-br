import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ══════════════════════════════════════════════════
// CORS & CONFIG
// ══════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const SCORE_MEDICO_MIN = 90;
const SCORE_PEDAGOGICO_MIN = 85;

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
  associacoes: Associacao[];
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

interface AgentLogEntry {
  agent: string;
  attempt: number;
  status: string;
  details: string;
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
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function extractJSON(raw: string): unknown | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    const cleaned = m[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

async function callAI<T>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2,
): Promise<T> {
  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
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
    throw new Error(`AI error ${status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJSON(content);
  if (!parsed) throw new Error("Failed to parse AI JSON response");
  return parsed as T;
}

function validatePayload(p: MnemonicRequest): string | null {
  if (!p) return "Body ausente.";
  if (!p.tema || typeof p.tema !== "string" || p.tema.trim().length < 2)
    return "Campo 'tema' é obrigatório (mín. 2 caracteres).";
  if (!Array.isArray(p.termos) || p.termos.length === 0)
    return "Campo 'termos' deve ser um array com pelo menos 1 item.";
  if (p.termos.some((t) => typeof t !== "string" || !t.trim()))
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

function buildCtx(p: MnemonicRequest): string {
  return `Tema: ${p.tema}\nTermos: ${JSON.stringify(p.termos)}\nEstilo: ${p.estilo ?? "frase + imagem mental"}\nPúblico: ${p.publico ?? "graduação médica"}`;
}

// ══════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Authorization header ausente.");

  const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Não foi possível identificar o usuário.");
  return data.user.id;
}

// ══════════════════════════════════════════════════
// DB OPERATIONS
// ══════════════════════════════════════════════════

function getDB() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createRequest(db: ReturnType<typeof createClient>, userId: string, p: MnemonicRequest): Promise<string> {
  const { data, error } = await db
    .from("mnemonic_requests")
    .insert({
      user_id: userId,
      tema: p.tema,
      termos_json: p.termos,
      estilo: p.estilo ?? "frase + imagem mental",
      publico: p.publico ?? "graduação médica",
      status: "processing",
      source: "lovable-ui",
    })
    .select("id")
    .single();
  if (error) throw new Error(`DB mnemonic_requests: ${error.message}`);
  return data.id;
}

async function updateStatus(db: ReturnType<typeof createClient>, id: string, status: string) {
  await db.from("mnemonic_requests").update({ status }).eq("id", id);
}

async function logAgent(db: ReturnType<typeof createClient>, params: {
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
  await db.from("mnemonic_agent_logs").insert({
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

async function saveResult(db: ReturnType<typeof createClient>, params: {
  requestId: string;
  userId: string;
  payload: MnemonicRequest;
  consolidated: ConsolidatedOutput;
  approved: GeneratorOutput;
  med: MedicalAuditOutput;
  ped: PedagogicalAuditOutput;
  vis: VisualOutput;
  scoreFinal: number;
  imageUrl: string | null;
}): Promise<string> {
  const medOk = (params.med.score_medico ?? 0) >= SCORE_MEDICO_MIN;
  const pedOk = (params.ped.score_pedagogico ?? 0) >= SCORE_PEDAGOGICO_MIN;

  const { data: existing } = await db
    .from("mnemonic_results")
    .select("versao")
    .eq("request_id", params.requestId)
    .eq("is_latest", true)
    .order("versao", { ascending: false })
    .limit(1);
  const nextVer = existing?.length ? Number(existing[0].versao || 1) + 1 : 1;

  const { data, error } = await db
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
      associacoes_json: params.approved.associacoes ?? [],
      associacoes_visuais_json: params.vis.associacoes_visuais ?? [],
      alertas_json: params.consolidated.alertas ?? [],
      score_medico: params.med.score_medico ?? 0,
      score_pedagogico: params.ped.score_pedagogico ?? 0,
      score_final: params.scoreFinal,
      aprovado: medOk && pedOk,
      aprovado_medico: medOk,
      aprovado_pedagogico: pedOk,
      versao: nextVer,
      is_latest: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`DB mnemonic_results: ${error.message}`);
  return data.id;
}

// ══════════════════════════════════════════════════
// AGENT PROMPTS
// ══════════════════════════════════════════════════

const PROMPT_GERADOR = `Você é um professor de medicina e especialista em memorização clínica.
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

const PROMPT_AUDITOR_MEDICO = `Você é um auditor médico extremamente rigoroso.
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

const PROMPT_AUDITOR_PEDAGOGICO = `Você é especialista em educação médica e neuroaprendizado.
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

const PROMPT_VISUAL = `Você é especialista em memória visual aplicada à medicina.
Crie: cena visual forte e memorável, associação visual item por item, prompt de imagem didática.
Regras: representar todos os termos, manter fidelidade médica.

Retorne JSON com:
{
  "cena_visual": "string",
  "associacoes_visuais": [{"termo":"string","elemento_visual":"string"}],
  "prompt_imagem": "string"
}`;

const PROMPT_CONSOLIDADOR = `Você é o consolidador final do sistema de mnemônicos médicos.
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
// IMAGE GENERATION
// ══════════════════════════════════════════════════

async function generateImage(
  apiKey: string,
  prompt: string,
  db: ReturnType<typeof createClient>,
  requestId: string,
  sigla: string,
): Promise<string | null> {
  try {
    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{
          role: "user",
          content: `Create a single cohesive medical mnemonic illustration. Style: clean medical infographic/cartoon, high contrast, saturated colors, white background. NO text, letters, labels or words in the image. Each element must be a distinct visual symbol.\n\n${prompt}`,
        }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      console.error("Image gen error:", resp.status);
      return null;
    }

    const data = await resp.json();
    const base64Url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!base64Url) return null;

    // Upload to storage
    const base64Clean = base64Url.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64Clean), (c) => c.charCodeAt(0));
    const safeSigla = sigla
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 40);
    const filePath = `mnemonics/${requestId}_${safeSigla}.png`;

    const { error } = await db.storage
      .from("question-images")
      .upload(filePath, bytes, { contentType: "image/png", upsert: true });

    if (error) {
      console.error("Image upload error:", error);
      return null;
    }

    const { data: urlData } = db.storage.from("question-images").getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (err) {
    console.error("Image generation failed:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════
// AGENT RUNNER (with timing & logging)
// ══════════════════════════════════════════════════

async function runAgent<T>(
  apiKey: string,
  db: ReturnType<typeof createClient>,
  requestId: string,
  userId: string,
  agentName: string,
  order: number,
  systemPrompt: string,
  userPrompt: string,
  scoreExtractor?: (result: T) => number | null,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await callAI<T>(apiKey, systemPrompt, userPrompt);
    await logAgent(db, {
      requestId, userId, agentName, executionOrder: order,
      status: "completed",
      inputJson: { prompt_preview: userPrompt.slice(0, 200) },
      outputJson: result,
      score: scoreExtractor ? scoreExtractor(result) : null,
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    await logAgent(db, {
      requestId, userId, agentName, executionOrder: order,
      status: "failed",
      inputJson: { prompt_preview: userPrompt.slice(0, 200) },
      outputJson: {},
      durationMs: Date.now() - start,
      errorMessage: String(err),
    });
    throw err;
  }
}

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido." }, 405);

  let requestId: string | null = null;
  const db = getDB();

  try {
    const apiKey = getEnv("LOVABLE_API_KEY");
    const payload = (await req.json()) as MnemonicRequest;
    const valErr = validatePayload(payload);
    if (valErr) return json({ success: false, error: valErr }, 400);

    payload.tema = payload.tema.trim();
    payload.termos = normalizeTerms(payload.termos);
    const ctx = buildCtx(payload);

    const userId = await getUserId(req);
    requestId = await createRequest(db, userId, payload);

    const agentLogs: AgentLogEntry[] = [];
    let order = 0;

    // ── 1) GERADOR ──
    order++;
    const generated = await runAgent<GeneratorOutput>(
      apiKey, db, requestId, userId, "gerador", order,
      PROMPT_GERADOR,
      `Gere o mnemônico médico inicial:\n\n${ctx}`,
    );
    agentLogs.push({ agent: "gerador", attempt: 1, status: "ok", details: `Sigla: ${generated.sigla}` });

    // ── 2) AUDITOR MÉDICO ──
    order++;
    let medAudit = await runAgent<MedicalAuditOutput>(
      apiKey, db, requestId, userId, "auditor_medico", order,
      PROMPT_AUDITOR_MEDICO,
      `Audite clinicamente:\n\nCONTEXTO:\n${ctx}\n\nMNEMÔNICO:\n${JSON.stringify(generated, null, 2)}`,
      (r) => r.score_medico,
    );
    agentLogs.push({ agent: "auditor_medico", attempt: 1, status: medAudit.score_medico >= SCORE_MEDICO_MIN ? "approved" : "rejected", details: `Score: ${medAudit.score_medico}` });

    let approved = generated;
    if (medAudit.versao_corrigida && medAudit.score_medico < SCORE_MEDICO_MIN) {
      approved = medAudit.versao_corrigida;
    }

    // ── RETRY MÉDICO (if score < 90) ──
    if (medAudit.score_medico < SCORE_MEDICO_MIN) {
      order++;
      const retryGen = await runAgent<GeneratorOutput>(
        apiKey, db, requestId, userId, "retry_gerador", order,
        PROMPT_GERADOR,
        `O mnemônico anterior teve score médico ${medAudit.score_medico}/100.\nErros: ${medAudit.erros_encontrados.join(", ")}\n\nGere uma versão melhor:\n\n${ctx}`,
      );
      agentLogs.push({ agent: "retry_gerador", attempt: 2, status: "ok", details: `Retry sigla: ${retryGen.sigla}` });

      order++;
      const retryMed = await runAgent<MedicalAuditOutput>(
        apiKey, db, requestId, userId, "retry_auditor_medico", order,
        PROMPT_AUDITOR_MEDICO,
        `Audite clinicamente a versão corrigida:\n\nCONTEXTO:\n${ctx}\n\nMNEMÔNICO:\n${JSON.stringify(retryGen, null, 2)}`,
        (r) => r.score_medico,
      );
      agentLogs.push({ agent: "retry_auditor_medico", attempt: 2, status: retryMed.score_medico >= SCORE_MEDICO_MIN ? "approved" : "rejected", details: `Score: ${retryMed.score_medico}` });

      // Use the better version
      if (retryMed.score_medico > medAudit.score_medico) {
        medAudit = retryMed;
        approved = retryMed.versao_corrigida ?? retryGen;
      }
    }

    // ── 3) AUDITOR PEDAGÓGICO ──
    order++;
    let pedAudit = await runAgent<PedagogicalAuditOutput>(
      apiKey, db, requestId, userId, "auditor_pedagogico", order,
      PROMPT_AUDITOR_PEDAGOGICO,
      `Avalie pedagogicamente:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO:\n${JSON.stringify(approved, null, 2)}`,
      (r) => r.score_pedagogico,
    );
    agentLogs.push({ agent: "auditor_pedagogico", attempt: 1, status: pedAudit.score_pedagogico >= SCORE_PEDAGOGICO_MIN ? "approved" : "rejected", details: `Score: ${pedAudit.score_pedagogico}` });

    // ── RETRY PEDAGÓGICO (if score < 85) ──
    if (pedAudit.score_pedagogico < SCORE_PEDAGOGICO_MIN) {
      order++;
      const retryPed = await runAgent<PedagogicalAuditOutput>(
        apiKey, db, requestId, userId, "retry_auditor_pedagogico", order,
        PROMPT_AUDITOR_PEDAGOGICO,
        `A versão anterior teve score pedagógico ${pedAudit.score_pedagogico}/100.\nPontos fracos: ${pedAudit.pontos_fracos.join(", ")}\n\nReavalie com foco em melhoria:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO:\n${JSON.stringify(approved, null, 2)}`,
        (r) => r.score_pedagogico,
      );
      agentLogs.push({ agent: "retry_auditor_pedagogico", attempt: 2, status: retryPed.score_pedagogico >= SCORE_PEDAGOGICO_MIN ? "approved" : "rejected", details: `Score: ${retryPed.score_pedagogico}` });

      if (retryPed.score_pedagogico > pedAudit.score_pedagogico) {
        pedAudit = retryPed;
      }
    }

    // ── 4) VISUAL ──
    order++;
    const visual = await runAgent<VisualOutput>(
      apiKey, db, requestId, userId, "visual", order,
      PROMPT_VISUAL,
      `Crie a parte visual:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO:\n${JSON.stringify(approved, null, 2)}\n\nSUGESTÕES:\n${JSON.stringify(pedAudit, null, 2)}`,
    );
    agentLogs.push({ agent: "visual", attempt: 1, status: "ok", details: "Cena visual gerada" });

    // ── 5) CONSOLIDADOR ──
    order++;
    const consolidated = await runAgent<ConsolidatedOutput>(
      apiKey, db, requestId, userId, "consolidador", order,
      PROMPT_CONSOLIDADOR,
      `Consolide:\n\nCONTEXTO:\n${ctx}\n\nVERSÃO:\n${JSON.stringify(approved, null, 2)}\n\nMÉDICO:\n${JSON.stringify(medAudit, null, 2)}\n\nPEDAGÓGICO:\n${JSON.stringify(pedAudit, null, 2)}\n\nVISUAL:\n${JSON.stringify(visual, null, 2)}`,
    );
    agentLogs.push({ agent: "consolidador", attempt: 1, status: "ok", details: "Consolidação final" });

    const scoreFinal = Math.round(((medAudit.score_medico ?? 0) + (pedAudit.score_pedagogico ?? 0)) / 2);

    // ── 6) GERAÇÃO DE IMAGEM ──
    const imagePrompt = consolidated.prompt_imagem || visual.prompt_imagem;
    let imageUrl: string | null = null;
    if (imagePrompt) {
      console.log("Generating mnemonic image...");
      imageUrl = await generateImage(apiKey, imagePrompt, db, requestId, consolidated.sigla);
      agentLogs.push({
        agent: "image_generator", attempt: 1,
        status: imageUrl ? "ok" : "failed",
        details: imageUrl ? "Imagem gerada" : "Falha na geração (text-only fallback)",
      });
    }

    // ── PERSIST ──
    const resultId = await saveResult(db, {
      requestId, userId, payload, consolidated, approved,
      med: medAudit, ped: pedAudit, vis: visual, scoreFinal, imageUrl,
    });

    await updateStatus(db, requestId, "completed");

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
        score_medico: medAudit.score_medico,
        score_pedagogico: pedAudit.score_pedagogico,
        score_final: scoreFinal,
        alertas: consolidated.alertas ?? [],
        associacoes: approved.associacoes ?? [],
        associacoes_visuais: visual.associacoes_visuais ?? [],
        image_url: imageUrl,
        items_map: (approved.associacoes ?? []).map((a) => ({
          letter: a.letra,
          word: a.representacao_no_mnemonico,
          original_item: a.termo_original,
          symbol: null,
          symbol_reason: null,
        })),
        agent_logs: agentLogs,
      },
    });
  } catch (error) {
    console.error("generate-medical-mnemonic error:", error);
    try {
      if (requestId) await updateStatus(db, requestId, "failed");
    } catch { /* don't mask */ }

    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "RATE_LIMIT") {
      return json({ success: false, error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    }
    if (msg === "CREDITS_EXHAUSTED") {
      return json({ success: false, error: "Créditos de IA esgotados." }, 402);
    }

    return json({
      success: false,
      error: "Erro ao gerar mnemônico médico.",
      details: msg,
    }, 500);
  }
});
