/**
 * Unified Mnemonic Service — Single entry point for both manual and adaptive flows.
 * Now integrated with AI Gateway for enterprise resilience.
 */
import { supabase } from "@/integrations/supabase/client";
import { aiGateway } from "./ai/aiGateway";

// ══════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════

export interface MnemonicResult {
  topic: string;
  mnemonic: string;
  phrase: string;
  items_map: Array<{
    letter: string;
    word: string;
    original_item: string;
    symbol: string | null;
    symbol_reason: string | null;
  }>;
  scene_description: string;
  image_url: string | null;
  quality_score: number;
  warning: string | null;
  review_question: string;
  audit?: {
    medical_score: number;
    pedagogical_score: number;
    medical_summary: string;
    pedagogical_summary: string;
    verdict: string;
  };
  assetId: string | null;
  cached: boolean;
}

export interface GenerateMnemonicParams {
  userId: string;
  topic: string;
  contentType: string;
  items: string[];
  source: "adaptive" | "manual";
  sourceContext?: {
    topicId?: string;
    questionId?: string;
    attemptId?: string;
  };
  onStatus?: (status: string) => void;
}


export interface MnemonicResponse {
  success: boolean;
  result?: MnemonicResult;
  error?: string;
  rejected?: boolean;
  isFallback?: boolean;
  audit?: {
    medical_score: number;
    pedagogical_score: number;
    combined_score?: number;
  };
}

// ══════════════════════════════════════════════════
// CENTRAL FUNCTION — generateOrReuseMnemonicForUser
// ══════════════════════════════════════════════════

export async function generateOrReuseMnemonicForUser(
  params: GenerateMnemonicParams
): Promise<MnemonicResponse> {
  const { userId, topic, contentType, items, source, sourceContext } = params;

  if (items.length < 3 || items.length > 7) {
    return { success: false, error: "Informe entre 3 e 7 itens." };
  }

  if (!topic.trim()) {
    return { success: false, error: "Informe o tema." };
  }

  try {
    const response = await aiGateway.invoke("generate-mnemonic", {
      topic: topic.trim(), 
      items, 
      contentType, 
      userId, 
      source, 
      sourceContext 
    }, { 
      tier: 'REASONING', 
      ttlDays: 30,
      onStatus: params.onStatus as any
    }); 



    if (!response.success) {
      return { success: false, error: response.error || "Erro ao gerar mnemônico." };
    }

    const payload = response.data;
    if (!payload) return { success: false, error: "Resposta vazia." };

    const inner = (payload.success && payload.data && typeof payload.data === "object")
      ? payload.data as Record<string, unknown>
      : payload;

    const result = mapToMnemonicResult(inner, topic, items);
    result.cached = response.isCached || false;

    if (result.assetId && userId) {
      await linkMnemonicToUser(userId, result.assetId, topic, source);
    }

    return { 
      success: true, 
      result,
      isFallback: response.isFallback
    };

  } catch (error: any) {
    console.warn("[MnemonicUnified] Gateway error:", error.message);
    return { success: false, error: error.message };
  }
}

function mapToMnemonicResult(
  payload: Record<string, unknown>,
  fallbackTopic: string,
  fallbackItems: string[],
): MnemonicResult {
  if (Array.isArray(payload.items_map)) {
    return { ...payload, cached: !!payload.cached } as unknown as MnemonicResult;
  }

  const sigla = String(payload.sigla ?? payload.mnemonic ?? "");
  const frase = String(payload.frase_mnemonica ?? payload.phrase ?? "");
  const agentes = payload.agentes as Record<string, unknown> | undefined;
  const gerador = agentes?.gerador as Record<string, unknown> | undefined;
  const visual = agentes?.visual as Record<string, unknown> | undefined;
  const auditorMedico = agentes?.auditor_medico as Record<string, unknown> | undefined;
  const auditorPedagogico = agentes?.auditor_pedagogico as Record<string, unknown> | undefined;

  let itemsMap: MnemonicResult["items_map"] = [];
  const associacoes = (gerador?.associacoes ?? payload.associacoes_json) as Array<Record<string, string>> | undefined;
  if (Array.isArray(associacoes) && associacoes.length > 0) {
    itemsMap = associacoes.map((a) => ({
      letter: String(a.letra ?? a.letter ?? ""),
      word: String(a.representacao_no_mnemonico ?? a.word ?? ""),
      original_item: String(a.termo_original ?? a.original_item ?? ""),
      symbol: null,
      symbol_reason: null,
    }));
  } else {
    const letters = sigla.split("");
    itemsMap = fallbackItems.map((item, i) => ({
      letter: letters[i] ?? "",
      word: item,
      original_item: item,
      symbol: null,
      symbol_reason: null,
    }));
  }

  const scoreMedico = Number(payload.score_medico ?? 0);
  const scorePedagogico = Number(payload.score_pedagogico ?? 0);
  const scoreFinal = Number(payload.score_final ?? Math.round((scoreMedico + scorePedagogico) / 2));
  const resolvedImageUrl = typeof payload.image_url === "string" && payload.image_url.trim() && payload.image_url !== "null"
    ? payload.image_url
    : null;

  return {
    topic: String(payload.tema ?? fallbackTopic),
    mnemonic: sigla,
    phrase: frase,
    items_map: itemsMap,
    scene_description: String(payload.cena_visual ?? visual?.cena_visual ?? ""),
    image_url: resolvedImageUrl,
    quality_score: scoreFinal,
    warning: typeof payload.warning === "string" ? payload.warning : null,
    review_question: `Quais são os ${fallbackItems.length} itens do mnemônico "${sigla}"?`,
    audit: auditorMedico || auditorPedagogico ? {
      medical_score: scoreMedico,
      pedagogical_score: scorePedagogico,
      medical_summary: "Avaliado",
      pedagogical_summary: "Avaliado",
      verdict: scoreMedico >= 90 && scorePedagogico >= 85 ? "approve" : "reject",
    } : undefined,
    assetId: payload.result_id ? String(payload.result_id) : null,
    cached: false,
  };
}

async function linkMnemonicToUser(userId: string, assetId: string, topic: string, source: string) {
  await supabase
    .from("user_mnemonic_links")
    .upsert({
      user_id: userId,
      mnemonic_asset_id: assetId,
      topic,
      trigger_source: source === "adaptive" ? "error_bank" : "manual",
      next_review_at: new Date(Date.now() + 86400000).toISOString(),
    }, { onConflict: "user_id,mnemonic_asset_id" });
}
