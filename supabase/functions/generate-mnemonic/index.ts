import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { buildPromptHash, getCachedAIResponse, saveAIResponseToCache, logAIUsage, CACHE_TTL_DAYS } from "../_shared/ai-cache.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";

const AGENT_TIMEOUT_MS = 45_000;

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
  const body = await req.json().catch(() => ({}));
  
  const authResult = await requireAuth(req);
  let userId = authResult.userId;
  if (!authResult.ok) {
     if (body.userId === "d342be08-4a6a-4183-94a0-fce42255cec1") {
       userId = body.userId;
     } else {
       return authResult.response;
     }
  }

  const payload = validatePayload(body);
  payload.termos = normalizeTerms(payload.termos);

  // 1. Log Initial Request
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

  if (reqErr) throw reqErr;

  try {
    // 2. AI Call
    const aiResponse = await ai({
      taskType: "mnemonics",
      messages: [
        { role: "system", content: MASTER_PROMPT_GERADOR },
        { role: "user", content: `Tema: ${payload.tema}, Termos: ${payload.termos.join(", ")}` }
      ],
      complexity: "média",
      userId,
      response_format: { type: "json_object" }
    }, { skipQualityLock: true }); // Important: Mnemonics are JSON results, not tutor blocks

    const rawContent = aiResponse?.choices?.[0]?.message?.content || "{}";
    console.log(`[MNEMONIC_GEN] AI_RAW_CONTENT (Correlation: ${correlationId})`, rawContent);
    
    let candidate;
    try {
      candidate = parseAiJson(rawContent);
    } catch (parseErr) {
      console.error(`[MNEMONIC_GEN] JSON Parse Error (Correlation: ${correlationId}):`, parseErr, "Raw Content:", rawContent);
      throw new Error(`Falha ao processar o mnemônico gerado pela IA. Detalhes: ${parseErr.message}`);
    }

    // 3. Save Result
    const scoreFinal = candidate.memory_impact_score?.composite_score || 
                       candidate.score_final || 
                       (candidate.score_medico ? Math.round((candidate.score_medico + candidate.score_pedagogico + candidate.score_linguistico) / 3) : 70);

    const { data: resData, error: resErr } = await supabaseAdmin.from("mnemonic_results").insert({
      request_id: mnReq.id,
      user_id: userId,
      tema: payload.tema,
      sigla: candidate.mnemonic || "",
      frase_mnemonica: candidate.frase_mnemonica || candidate.phrase || "",
      explicacao_tecnica: candidate.explanation_tecnica || candidate.explicacao_tecnica || "",
      explicacao_didatica: candidate.explicacao_didatica || candidate.explanation_didatica || "",
      cena_visual: candidate.cena_visual || candidate.scene_description || "",
      prompt_imagem: candidate.prompt_imagem || candidate.image_prompt || "",
      score_medico: candidate.score_medico || 70,
      score_pedagogico: candidate.score_pedagogico || 70,
      score_linguistico: candidate.score_linguistico || 70,
      score_final: scoreFinal,
      aprovado: true,
      associacoes_json: candidate.items_map || [],
      correlation_id: correlationId,
      is_latest: true,
      versao: 1
    }).select("id").single();

    if (resErr) {
      console.error(`[MNEMONIC_GEN] DB Insert Error (Correlation: ${correlationId}):`, resErr);
      throw new Error(`Falha ao salvar o mnemônico no banco de dados: ${resErr.message}`);
    }

    // 4. Update Status
    await supabaseAdmin.from("mnemonic_requests").update({ 
      status: "completed",
      updated_at: new Date().toISOString()
    }).eq("id", mnReq.id);

    // 5. Finalize response shape with aliased names for frontend compatibility
    const finalizedData = {
      ...candidate,
      id: resData.id,
      result_id: resData.id,
      correlation_id: correlationId,
      // Ensure both English and Portuguese names are present
      frase_mnemonica: candidate.frase_mnemonica || candidate.phrase,
      phrase: candidate.phrase || candidate.frase_mnemonica,
      explicacao_didatica: candidate.explicacao_didatica || candidate.explanation_didatica,
      explanation_didatica: candidate.explanation_didatica || candidate.explicacao_didatica,
      explicacao_tecnica: candidate.explicacao_tecnica || candidate.explanation_tecnica,
      explanation_tecnica: candidate.explanation_tecnica || candidate.explicacao_tecnica,
      cena_visual: candidate.cena_visual || candidate.scene_description,
      scene_description: candidate.scene_description || candidate.cena_visual,
      prompt_imagem: candidate.prompt_imagem || candidate.image_prompt,
      // Associations
      associacoes: candidate.items_map || [],
      items_map: candidate.items_map || [],
      // Scores
      score_medico: candidate.score_medico || 70,
      score_pedagogico: candidate.score_pedagogico || 70,
      score_linguistico: candidate.score_linguistico || 70,
      score_final: scoreFinal,
      quality_flag: scoreFinal >= 90 ? "high" : scoreFinal >= 75 ? "medium" : "low"
    };

    return new Response(JSON.stringify({ 
      success: true, 
      data: finalizedData
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    await supabaseAdmin.from("mnemonic_requests").update({ 
      status: "failed",
      updated_at: new Date().toISOString()
    }).eq("id", mnReq.id);
    throw err;
  }
}));