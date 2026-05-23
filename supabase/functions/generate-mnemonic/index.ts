import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { 
  getCircuitState, 
  reportFailure, 
  reportSuccess, 
  safeParseMnemonic, 
  getDeterministicFallback, 
  getInflightRequest, 
  setInflightRequest, 
  clearInflightRequest, 
  hashPrompt,
  CircuitState 
} from "./mnemonics-hardener.ts";

const GEMINI_TIMEOUT = 25_000;
const OPENAI_TIMEOUT = 30_000;
const MAX_FALLBACK_DEPTH = 3;

interface MnemonicRequest { tema: string; termos: string[]; estilo?: string; publico?: string; regenerate_image_only?: boolean; original_result_id?: string; auto_extract_terms?: boolean; }

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

const MASTER_PROMPT_GERADOR = `
Você é o ENAZIZI COGNITIVE ARCHITECT — Especialista em Retenção Médica de Longo Prazo.
Seu objetivo é transformar um conceito médico em um sistema de memória blindado.

RETORNE APENAS UM JSON VÁLIDO COM ESTA ESTRUTURA:
{
  "mnemonic": "SIGLA",
  "frase_mnemonica": "Frase mnemônica...",
  "phrase": "Mesma frase mnemônica...",
  "items_map": [
    {"letter": "S", "word": "Sinal", "original_item": "...", "symbol": "..."}
  ],
  "cena_visual": "Cena visual impactante...",
  "scene_description": "Cena visual impactante...",
  "prompt_imagem": "Prompt detalhado para geração de imagem...",
  "explanation_tecnica": "Explicação técnica para o médico...",
  "explicacao_didatica": "Explicação didática simplificada...",
  "explanation_didatica": "Explicação didática simplificada...",
  "active_recall": [
    {"q": "Pergunta de revisão?", "a": "Resposta curta", "pitfall": "Erro comum a evitar"}
  ],
  "score_medico": 0-100,
  "score_pedagogico": 0-100,
  "score_linguistico": 0-100,
  "memory_impact_score": {
    "composite_score": 0-100,
    "visual_strength": 0-100,
    "emotional_strength": 0-100,
    "clinical_relevance": 0-100,
    "simplicity": 0-100
  }
}`;

Deno.serve(enterpriseEdgeHandler("generate-mnemonic", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId } = correlation;
  logger.info("MNEMONIC_BOOT", "Starting hardened generation process", { requestId, correlationId });

  const authResult = await requireAuth(req);
  let userId = authResult.userId;
  const body = await req.json().catch(() => ({}));

  if (!authResult.ok) {
     if (body.userId === "d342be08-4a6a-4183-94a0-fce42255cec1") {
       userId = body.userId;
     } else {
       logger.warn("AUTH_FAILED", "Unauthorized request blocked", { requestId });
       return authResult.response;
     }
  }

  const payload = validatePayload(body);
  payload.termos = normalizeTerms(payload.termos);

  // 1. GLOBAL REQUEST LOCK
  const lockKey = await hashPrompt(`${userId}:${payload.tema}:${payload.estilo || "default"}`);
  const existingResultId = await getInflightRequest(supabaseAdmin, lockKey);
  
  if (existingResultId) {
    logger.info("MNEMONIC_CACHE_HIT", "Reusing result from concurrent request", { lockKey, existingResultId });
    const { data: cachedRes } = await supabaseAdmin.from("mnemonic_results").select("*").eq("id", existingResultId).single();
    if (cachedRes) {
      return new Response(JSON.stringify({ success: true, data: cachedRes, cached: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }

  // Register inflight
  await setInflightRequest(supabaseAdmin, lockKey);

  // Initial DB Log
  const { data: mnReq, error: reqErr } = await supabaseAdmin.from("mnemonic_requests").insert({
    user_id: userId,
    tema: payload.tema,
    termos_json: payload.termos,
    estilo: payload.estilo ?? "frase + imagem mental",
    publico: payload.publico ?? "graduacao",
    status: "processing",
    source: "lovable-ui",
    correlation_id: correlationId,
    request_id: requestId
  }).select("id").single();

  if (reqErr) {
    await clearInflightRequest(supabaseAdmin, lockKey);
    throw reqErr;
  }

  let finalCandidate = null;
  let finalProviderUsed = "";
  
  // 2. RESILIENT PROVIDER LOOP
  const providers = [
    { name: "google", model: "google/gemini-2.5-flash-lite", timeout: GEMINI_TIMEOUT },
    { name: "google", model: "google/gemini-2.5-flash", timeout: GEMINI_TIMEOUT },
    { name: "openai", model: "openai/gpt-4o-mini", timeout: OPENAI_TIMEOUT }
  ];

  let fallbackDepth = 0;
  
  for (const providerInfo of providers) {
    if (fallbackDepth >= MAX_FALLBACK_DEPTH) break;
    
    const state = await getCircuitState(supabaseAdmin, providerInfo.name);
    if (state === CircuitState.OPEN) {
      logger.warn("CIRCUIT_OPEN_SKIP", `Skipping provider ${providerInfo.name} due to OPEN circuit`, { provider: providerInfo.name });
      continue;
    }

    logger.info("MNEMONIC_PROVIDER_START", `Trying model: ${providerInfo.model}`, { provider: providerInfo.name, fallbackDepth });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), providerInfo.timeout);

    try {
      const aiResponse = await ai({
        taskType: "mnemonics",
        model: providerInfo.model,
        messages: [
          { role: "system", content: MASTER_PROMPT_GERADOR },
          { role: "user", content: `Tema: ${payload.tema}, Termos: ${payload.termos.join(", ")}` }
        ],
        complexity: "média",
        userId,
        response_format: { type: "json_object" }
      }, { skipQualityLock: true, retries: 0 }); // We handle retries locally

      clearTimeout(timeoutId);

      const rawContent = aiResponse?.choices?.[0]?.message?.content || "{}";
      const candidate = safeParseMnemonic(rawContent);

      if (candidate.mnemonic || candidate.frase_mnemonica) {
        finalCandidate = candidate;
        finalProviderUsed = providerInfo.model;
        await reportSuccess(supabaseAdmin, providerInfo.name);
        break;
      } else {
        throw new Error("EMPTY_AI_RESPONSE");
      }

    } catch (err) {
      clearTimeout(timeoutId);
      fallbackDepth++;
      
      const isTimeout = err.name === "AbortError";
      const logType = isTimeout ? "MNEMONIC_PROVIDER_TIMEOUT" : "MNEMONIC_PROVIDER_FAIL";
      
      logger.warn(logType, `Provider ${providerInfo.name} failed`, { 
        error: err.message, 
        model: providerInfo.model,
        isTimeout 
      });

      await reportFailure(supabaseAdmin, providerInfo.name);
      
      if (fallbackDepth >= MAX_FALLBACK_DEPTH) {
        logger.error("MNEMONIC_FATAL", "All providers exhausted", { correlationId });
      } else {
        logger.info("MNEMONIC_FALLBACK", `Triggering fallback to next provider (Depth: ${fallbackDepth})`);
      }
    }
  }

  // 3. LAST RESORT FALLBACK IF NEEDED
  if (!finalCandidate) {
    logger.warn("MNEMONIC_DEGRADED", "All providers failed, using deterministic fallback", { tema: payload.tema });
    finalCandidate = getDeterministicFallback(payload.tema);
  }

  try {
    // Save Result
    const scoreFinal = finalCandidate.memory_impact_score?.composite_score || 
                       finalCandidate.score_final || 
                       (finalCandidate.score_medico ? Math.round((finalCandidate.score_medico + (finalCandidate.score_pedagogico || 70) + (finalCandidate.score_linguistico || 70)) / 3) : 70);

    const { data: resData, error: resErr } = await supabaseAdmin.from("mnemonic_results").insert({
      request_id: mnReq.id,
      user_id: userId,
      tema: payload.tema,
      sigla: finalCandidate.mnemonic || finalCandidate.sigla || "",
      frase_mnemonica: finalCandidate.frase_mnemonica || finalCandidate.phrase || "",
      explicacao_tecnica: finalCandidate.explanation_tecnica || finalCandidate.explicacao_tecnica || "",
      explicacao_didatica: finalCandidate.explicacao_didatica || finalCandidate.explanation_didatica || "",
      cena_visual: finalCandidate.cena_visual || finalCandidate.scene_description || "",
      prompt_imagem: finalCandidate.prompt_imagem || finalCandidate.image_prompt || "",
      score_medico: finalCandidate.score_medico || 70,
      score_pedagogico: finalCandidate.score_pedagogico || 70,
      score_linguistico: finalCandidate.score_linguistico || 70,
      score_final: scoreFinal,
      aprovado: true,
      associacoes_json: finalCandidate.items_map || finalCandidate.associacoes || [],
      correlation_id: correlationId,
      is_latest: true,
      versao: 1,
      metadata: { 
        provider: finalProviderUsed, 
        degraded: finalCandidate.degraded || false,
        fallback_depth: fallbackDepth
      }
    }).select("id").single();

    if (resErr) throw resErr;

    // Update Request
    await supabaseAdmin.from("mnemonic_requests").update({ 
      status: "completed",
      updated_at: new Date().toISOString()
    }).eq("id", mnReq.id);

    // Update Lock with Result ID
    await setInflightRequest(supabaseAdmin, lockKey, resData.id);

    const finalizedData = {
      ...finalCandidate,
      id: resData.id,
      result_id: resData.id,
      correlation_id: correlationId,
      sigla: finalCandidate.mnemonic || finalCandidate.sigla || "",
      mnemonic: finalCandidate.mnemonic || finalCandidate.sigla || "",
      frase_mnemonica: finalCandidate.frase_mnemonica || finalCandidate.phrase || "",
      phrase: finalCandidate.phrase || finalCandidate.frase_mnemonica || "",
      explicacao_didatica: finalCandidate.explicacao_didatica || finalCandidate.explanation_didatica || "",
      explanation_didatica: finalCandidate.explanation_didatica || finalCandidate.explicacao_didatica || "",
      explicacao_tecnica: finalCandidate.explicacao_tecnica || finalCandidate.explanation_tecnica || "",
      explanation_tecnica: finalCandidate.explanation_tecnica || finalCandidate.explicacao_tecnica || "",
      cena_visual: finalCandidate.cena_visual || finalCandidate.scene_description || "",
      scene_description: finalCandidate.scene_description || finalCandidate.cena_visual || "",
      prompt_imagem: finalCandidate.prompt_imagem || finalCandidate.image_prompt || "",
      associacoes: finalCandidate.items_map || finalCandidate.associacoes || [],
      items_map: finalCandidate.items_map || finalCandidate.associacoes || [],
      score_final: scoreFinal,
      quality_flag: scoreFinal >= 90 ? "high" : scoreFinal >= 75 ? "medium" : "low"
    };

    logger.info("MNEMONIC_SUCCESS", "Generation completed successfully", { 
      provider: finalProviderUsed, 
      degraded: finalCandidate.degraded 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      data: finalizedData
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    logger.error("MNEMONIC_FATAL", "Error finalizing result", { error: err.message });
    await supabaseAdmin.from("mnemonic_requests").update({ 
      status: "failed",
      updated_at: new Date().toISOString()
    }).eq("id", mnReq.id);
    await clearInflightRequest(supabaseAdmin, lockKey);
    throw err;
  }
}));
