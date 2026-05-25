import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";
import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { buildPromptHash, getCachedAIResponse, saveAIResponseToCache, logAIUsage } from "../_shared/ai-cache.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { getDeterministicFallback, safeParseMnemonic } from "./mnemonics-hardener.ts";

// ═══ CONFIG ═══
const AI_MODEL = ALLOWED_MODELS.generation;
const IMAGE_MODEL = "openai/gpt-4o-mini";
const MODULE_NAME = "mnemonic";

interface MnemonicRequest { 
  tema: string; 
  termos: string[]; 
  estilo?: string; 
  publico?: string; 
  regenerate_image_only?: boolean; 
  original_result_id?: string; 
  auto_extract_terms?: boolean; 
}

// ═══ MASTER PROMPT ═══
const MASTER_PROMPT = `
Você é o ENAZIZI COGNITIVE ARCHITECT — Especialista em Retenção Médica de Longo Prazo.
Transforme o conceito médico em um sistema de memória blindado (Hardened Mnemonic).

REGRA DE OURO: O mnemônico deve ser ÚTIL, ABSURDAMENTE MEMORÁVEL e CLINICAMENTE PRECISO.
Utilize o modelo de 5 CAMADAS COGNITIVAS:
1. LAYER 1 (Clínico): Conceito e mecanismo médico exato.
2. LAYER 2 (Cognitivo): Frase natural + Acrônimo + Emoção.
3. LAYER 3 (Visual): Reforço Pixar-style (Cena exagerada, cinematográfica, SEM TEXTO).
4. LAYER 4 (SRS): Estruturado para repetição espaçada.
5. LAYER 5 (Recuperação): Focado em Active Recall.

PIXAR-STYLE MEMORY ENGINE:
As cenas visuais devem ser exageradas, surrealistas e ligadas ao mecanismo clínico.
SEM TEXTO, RÓTULOS OU LETRAS.

FORMATO JSON OBRIGATÓRIO:
{
  "mnemonic": "SIGLA",
  "phrase": "Frase natural com gatilhos emocionais",
  "items_map": [
    { "letter": "A", "word": "Gatilho", "original_item": "Termo Médico", "symbol": "Emoji" }
  ],
  "scene_description": "Cena cinematográfica detalhada Pixar-style.",
  "image_prompt": "Ultra-detailed 3D render, Pixar style, vivid colors, medical setting, NO text, NO labels, surreal action.",
  "explanation_tecnica": "Explicação clínica densa.",
  "explanation_didatica": "Por que funciona cognitivamente.",
  "active_recall": [
    { "q": "Pergunta", "a": "Resposta", "pitfall": "Pegadinha" }
  ],
  "memory_impact_score": {
    "visual_strength": 0-100,
    "emotional_strength": 0-100,
    "clinical_relevance": 0-100,
    "composite_score": 0-100
  }
}
APENAS O JSON.`;

// ═══ HELPERS ═══
async function generateImage(prompt: string, logger: any, supabase: SupabaseClient): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  try {
    const payload = {
      model: IMAGE_MODEL.replace("openai/", ""),
      messages: [{ role: "user", content: `Generate this image: ${prompt}. IMPORTANT: NO text, labels, letters, or words anywhere in the image.` }],
      max_tokens: 4000,
    };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) return null;
    const j = await r.json();
    let imgData: string | null = null;
    const images = j?.choices?.[0]?.message?.images;
    if (Array.isArray(images) && images.length > 0) imgData = images[0]?.image_url?.url ?? null;

    if (!imgData) return null;
    
    // Upload to storage
    const mimeMatch = imgData.match(/^data:(image\/\w+);base64,/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const ext = mime === "image/jpeg" ? "jpg" : "png";
    const data = imgData.replace(/^data:image\/\w+;base64,/, "");
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    
    const name = `mnemonics/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(name, bytes, { contentType: mime, upsert: false });
    if (error) return null;
    
    return supabase.storage.from("question-images").getPublicUrl(name).data.publicUrl;
  } catch (e) {
    logger.error("IMAGE_GEN_ERROR", e.message);
    return null;
  }
}

// ═══ HANDLER ═══
Deno.serve(enterpriseEdgeHandler("generate-mnemonic", async (ctx: EnterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = ctx;

  logger.info("MNEMONIC_BOOT", "Starting mnemonic generation pipeline");

  // 1. Auth
  const auth = await requireAuth(req);
  if (!auth.ok) {
    logger.warn("AUTH_FAILED", "Unauthorized request");
    return auth.response;
  }
  const userId = auth.userId;
  logger.info("MNEMONIC_AUTH_OK", `User ${userId} authenticated`);

  // 2. Parse Payload
  let body: MnemonicRequest;
  try {
    body = await req.json();
    if (!body.tema) throw new Error("Campo 'tema' obrigatório");
  } catch (e) {
    return corsResponse({ success: false, error: "Payload inválido: " + e.message }, 400);
  }

  const tema = body.tema.trim();
  const termos = (body.termos || []).map(t => String(t).trim()).filter(Boolean);
  const estilo = body.estilo || "frase + imagem mental";
  
  // 3. Cache Check
  const cachePayload = { tema, termos, estilo, version: "v16" };
  const semanticHash = await buildPromptHash(cachePayload);
  
  if (!body.regenerate_image_only) {
    const cached = await getCachedAIResponse({
      module: MODULE_NAME,
      scope: "global",
      semanticHash
    });

    if (cached.hit && cached.content) {
      logger.info("MNEMONIC_CACHE_HIT", "Returning cached result");
      await logAIUsage({ userId, module: MODULE_NAME, cacheStatus: "hit", success: true });
      return corsResponse({ success: true, data: cached.content, response_source: "cache" });
    }
  }

  // 4. Handle Regeneration Only
  if (body.regenerate_image_only && body.original_result_id) {
    logger.info("MNEMONIC_REGEN_IMAGE", `Regenerating image for ${body.original_result_id}`);
    const { data: result } = await supabaseAdmin.from("mnemonic_results").select("prompt_imagem").eq("id", body.original_result_id).single();
    if (result) {
      const url = await generateImage(result.prompt_imagem, logger, supabaseAdmin);
      if (url) {
        await supabaseAdmin.from("mnemonic_results").update({ image_url: url }).eq("id", body.original_result_id);
        return corsResponse({ success: true, image_url: url });
      }
    }
    return corsResponse({ success: false, error: "Falha ao regenerar imagem" }, 500);
  }

  // 5. AI Generation
  logger.info("MNEMONIC_PROVIDER_START", `Requesting AI for theme: ${tema}`);
  const startTime = Date.now();
  let aiResult: any;

  try {
    const aiResponse = await ai({
      taskType: "creative",
      messages: [
        { role: "system", content: MASTER_PROMPT },
        { role: "user", content: `Tema: ${tema}\nItens: ${termos.join(", ")}\nEstilo: ${estilo}` }
      ],
      model: AI_MODEL,
    });

    const content = aiResponse.choices?.[0]?.message?.content || aiResponse.content;
    aiResult = safeParseMnemonic(content);
    logger.info("MNEMONIC_PARSER_OK", "AI response parsed successfully");
  } catch (e) {
    logger.error("MNEMONIC_PROVIDER_FAIL", e.message);
    // FALLBACK
    const fallback = getDeterministicFallback(tema);
    logger.info("MNEMONIC_FALLBACK_OK", "Returning deterministic fallback");
    return corsResponse({ success: true, data: fallback, response_source: "fallback" });
  }

  // 6. Image Generation (Parallel/Background if possible, but for UX we wait or return placeholder)
  const imageUrl = await generateImage(aiResult.image_prompt || aiResult.prompt_imagem, logger, supabaseAdmin);

  // 7. Format & Persist
  const finalData = {
    ...aiResult,
    tema,
    image_url: imageUrl,
    response_source: "master_pipeline",
    correlation_id: correlation.correlationId
  };

  // Persist result in DB
  try {
    const { data: res, error: resErr } = await supabaseAdmin.from("mnemonic_results").insert({
      user_id: userId,
      tema,
      sigla: aiResult.mnemonic,
      frase_mnemonica: aiResult.phrase || aiResult.frase_mnemonica,
      explicacao_tecnica: aiResult.explanation_tecnica,
      explicacao_didatica: aiResult.explanation_didatica,
      cena_visual: aiResult.scene_description,
      prompt_imagem: aiResult.image_prompt || aiResult.prompt_imagem,
      image_url: imageUrl,
      score_final: aiResult.memory_impact_score?.composite_score || 85,
      items_map: aiResult.items_map,
      is_latest: true
    }).select("id").single();

    if (res) finalData.result_id = res.id;
  } catch (e) {
    logger.error("DB_PERSIST_ERROR", e.message);
  }

  // 8. Cache result
  await saveAIResponseToCache({
    module: MODULE_NAME,
    scope: "global",
    semanticHash,
    response: finalData,
    modelUsed: AI_MODEL
  });

  logger.info("MNEMONIC_FINAL_RENDER", "Mnemonic generation complete");
  return corsResponse({ success: true, data: finalData });
}));
