/**
 * Unified Mnemonic Service — Single entry point for both manual and adaptive flows.
 * Both modes use the same edge function pipeline (eligibility + dual auditor + fail-closed).
 */
import { supabase } from "@/integrations/supabase/client";

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
}

async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  const response =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context?: Response }).context
      : undefined;

  const extractFromPayload = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") return null;

    const maybePayload = payload as {
      error?: unknown;
      message?: unknown;
      rejected?: unknown;
      audit?: { medical_score?: unknown; pedagogical_score?: unknown; combined_score?: unknown };
    };

    const baseMessage = typeof maybePayload.error === "string"
      ? maybePayload.error
      : typeof maybePayload.message === "string"
      ? maybePayload.message
      : null;

    if (!baseMessage) return null;

    const audit = maybePayload.audit;
    const suffix = audit && typeof audit === "object"
      ? [audit.medical_score, audit.pedagogical_score, audit.combined_score].some((value) => typeof value === "number")
        ? ` (auditoria: médico ${audit.medical_score ?? "-"}, pedagógico ${audit.pedagogical_score ?? "-"}, combinado ${audit.combined_score ?? "-"})`
        : ""
      : "";

    return `${baseMessage}${suffix}`;
  };

  if (response) {
    try {
      const payload = await response.clone().json();
      return extractFromPayload(payload) || JSON.stringify(payload);
    } catch {
      try {
        const text = await response.text();
        if (!text) return "Erro ao gerar mnemônico.";

        try {
          const payload = JSON.parse(text);
          return extractFromPayload(payload) || text;
        } catch {
          return text;
        }
      } catch {
        // Fall through to generic message
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Erro ao gerar mnemônico.";
}

async function extractRejectionPayload(
  error: unknown
): Promise<{ rejected: true; error: string; audit?: { medical_score: number; pedagogical_score: number; combined_score?: number } } | null> {
  const response =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context?: Response }).context
      : undefined;

  if (!response) return null;

  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object" && payload.rejected === true) {
      return {
        rejected: true,
        error: typeof payload.error === "string" ? payload.error : "Rejeitado pelos auditores.",
        audit: payload.audit && typeof payload.audit === "object" ? payload.audit : undefined,
      };
    }
  } catch {
    // not JSON or not rejection
  }
  return null;
}

// ══════════════════════════════════════════════════
// CENTRAL FUNCTION — generateOrReuseMnemonicForUser
// Used by: manual button, adaptive trigger, MnemonicGenerator page
// ══════════════════════════════════════════════════

export interface MnemonicResponse {
  success: boolean;
  result?: MnemonicResult;
  error?: string;
  rejected?: boolean;
  audit?: {
    medical_score: number;
    pedagogical_score: number;
    combined_score?: number;
  };
}

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

  let data: unknown = null;
  let invokeError: unknown = null;

  try {
    const response = await supabase.functions.invoke("generate-mnemonic", {
      body: { topic: topic.trim(), items, contentType, userId, source, sourceContext },
    });

    data = response.data;
    invokeError = response.error;
  } catch (error) {
    const message = await extractFunctionErrorMessage(error);
    console.warn("[MnemonicUnified] Edge function threw:", message);
    return { success: false, error: message };
  }

  // When the edge function returns 422, supabase-js puts the body in error.context
  // We need to extract the rejection payload from it
  if (invokeError) {
    const rejectionPayload = await extractRejectionPayload(invokeError);
    if (rejectionPayload) {
      console.warn("[MnemonicUnified] Mnemonic rejected by audit:", rejectionPayload.error);
      return {
        success: false,
        rejected: true,
        error: rejectionPayload.error || "Rejeitado pelos auditores.",
        audit: rejectionPayload.audit,
      };
    }
    const message = await extractFunctionErrorMessage(invokeError);
    console.warn("[MnemonicUnified] Edge function error:", message);
    return { success: false, error: message };
  }

  const payload = data as Record<string, unknown> | null;

  if (payload?.rejected) {
    return {
      success: false,
      rejected: true,
      error: typeof payload.error === "string" ? payload.error : "Rejeitado pelos auditores.",
      audit: payload.audit as any,
    };
  }

  if (!payload) {
    return { success: false, error: "Resposta inválida ao gerar mnemônico." };
  }

  // Handle response from the multi-agent Edge Function (generate-mnemonic)
  // which returns { success, data: { sigla, frase_mnemonica, ... } }
  const inner = (payload.success && payload.data && typeof payload.data === "object")
    ? payload.data as Record<string, unknown>
    : payload;

  const result = mapToMnemonicResult(inner, topic, items);

  if (result.assetId && userId) {
    await linkMnemonicToUser(userId, result.assetId, topic, source);
  }

  return { success: true, result };
}

// ══════════════════════════════════════════════════
// RESPONSE MAPPING
// ══════════════════════════════════════════════════

function mapToMnemonicResult(
  payload: Record<string, unknown>,
  fallbackTopic: string,
  fallbackItems: string[],
): MnemonicResult {
  // If already in the expected shape (has items_map), return directly
  if (Array.isArray(payload.items_map)) {
    return payload as unknown as MnemonicResult;
  }

  // Map from Edge Function shape (sigla, frase_mnemonica, agentes, etc.)
  const sigla = String(payload.sigla ?? payload.mnemonic ?? "");
  const frase = String(payload.frase_mnemonica ?? payload.phrase ?? "");
  const agentes = payload.agentes as Record<string, unknown> | undefined;
  const gerador = agentes?.gerador as Record<string, unknown> | undefined;
  const visual = agentes?.visual as Record<string, unknown> | undefined;
  const auditorMedico = agentes?.auditor_medico as Record<string, unknown> | undefined;
  const auditorPedagogico = agentes?.auditor_pedagogico as Record<string, unknown> | undefined;

  // Build items_map from generator associations or fallback
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
    // Fallback: build from sigla letters + items
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

  return {
    topic: String(payload.tema ?? fallbackTopic),
    mnemonic: sigla,
    phrase: frase,
    items_map: itemsMap,
    scene_description: String(payload.cena_visual ?? visual?.cena_visual ?? ""),
    image_url: null,
    quality_score: scoreFinal,
    warning: null,
    review_question: `Quais são os ${fallbackItems.length} itens do mnemônico "${sigla}"?`,
    audit: auditorMedico || auditorPedagogico ? {
      medical_score: scoreMedico,
      pedagogical_score: scorePedagogico,
      medical_summary: Array.isArray((auditorMedico as any)?.erros_encontrados)
        ? (auditorMedico as any).erros_encontrados.join("; ") || "Sem erros"
        : "Avaliado",
      pedagogical_summary: Array.isArray((auditorPedagogico as any)?.pontos_fortes)
        ? (auditorPedagogico as any).pontos_fortes.join("; ") || "Avaliado"
        : "Avaliado",
      verdict: scoreMedico >= 90 && scorePedagogico >= 85 ? "approve" : "reject",
    } : undefined,
    assetId: payload.result_id ? String(payload.result_id) : null,
    cached: false,
  };
}

// ══════════════════════════════════════════════════
// LINK MANAGEMENT
// ══════════════════════════════════════════════════

async function linkMnemonicToUser(
  userId: string,
  assetId: string,
  topic: string,
  source: string
) {
  const { error } = await supabase
    .from("user_mnemonic_links")
    .upsert({
      user_id: userId,
      mnemonic_asset_id: assetId,
      topic,
      trigger_source: source === "adaptive" ? "error_bank" : "manual",
      next_review_at: new Date(Date.now() + 86400000).toISOString(),
    }, { onConflict: "user_id,mnemonic_asset_id" });

  if (error) {
    console.error("[MnemonicUnified] Link failed:", error.message);
  }
}
