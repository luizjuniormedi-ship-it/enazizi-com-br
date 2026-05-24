/**
 * Mnemonic Module — Service layer (Supabase client-side queries + edge function calls).
 */
import { supabase } from "@/integrations/supabase/client";
import { aiRouter } from "@/lib/ai/router";

import type {
  MnemonicRequest,
  MnemonicApiResponse,
  MnemonicResultData,
  MnemonicHistoryItem,
  FeedbackPayload,
  RegeneratePayload,
  RegenerateStyle,
  AgentLog,
} from "@/types/mnemonics";

// ══════════════════════════════════════════════════
// RESPONSE MAPPING
// ══════════════════════════════════════════════════

function mapEdgeFunctionResponse(raw: Record<string, unknown>, inputTermos?: string[]): MnemonicResultData {
  // The Edge Function returns { success, data: { ... } }
  const d = (raw.success && raw.data && typeof raw.data === "object")
    ? raw.data as Record<string, unknown>
    : raw;

  const agentes = d.agentes as Record<string, unknown> | undefined;
  const gerador = agentes?.gerador as Record<string, unknown> | undefined;
  const visual = agentes?.visual as Record<string, unknown> | undefined;
  const auditorMedico = agentes?.auditor_medico as Record<string, unknown> | undefined;
  const auditorPedagogico = agentes?.auditor_pedagogico as Record<string, unknown> | undefined;

  // Build items_map from canonical backend field or generator associations
  const sigla = String(d.sigla ?? "");
  const backendItemsMap = Array.isArray(d.items_map) ? d.items_map as Array<Record<string, string>> : [];
  const rawAssociacoes = (gerador?.associacoes ?? d.associacoes) as Array<Record<string, string>> | undefined;
  let itemsMap: MnemonicResultData["items_map"] = [];

  if (backendItemsMap.length > 0) {
    itemsMap = backendItemsMap
      .filter((a) =>
        a && String(a.original_item ?? a.termo_original ?? "").trim() &&
        String(a.word ?? a.representacao_no_mnemonico ?? "").trim()
      )
      .map((a) => ({
        letter: String(a.letter ?? a.letra ?? "").trim(),
        word: String(a.word ?? a.representacao_no_mnemonico ?? "").trim(),
        original_item: String(a.original_item ?? a.termo_original ?? "").trim(),
        symbol: String(a.symbol ?? "").trim() || null,
        symbol_reason: String(a.symbol_reason ?? "").trim() || null,
      }));
  } else if (Array.isArray(rawAssociacoes) && rawAssociacoes.length > 0) {
    itemsMap = rawAssociacoes
      .filter((a) =>
        a && String(a.termo_original ?? a.original_item ?? "").trim() &&
        String(a.representacao_no_mnemonico ?? a.word ?? "").trim()
      )
      .map((a) => ({
        letter: String(a.letra ?? a.letter ?? "").trim(),
        word: String(a.representacao_no_mnemonico ?? a.word ?? "").trim(),
        original_item: String(a.termo_original ?? a.original_item ?? "").trim(),
        symbol: String(a.symbol ?? "").trim() || null,
        symbol_reason: String(a.symbol_reason ?? "").trim() || null,
      }));
  }

  const associacoes = Array.isArray(rawAssociacoes) && rawAssociacoes.length > 0
    ? rawAssociacoes
    : itemsMap.map((item) => ({
      letra: item.letter,
      termo_original: item.original_item,
      representacao_no_mnemonico: item.word,
    }));

  const memoryImpact = d.memory_impact_score && typeof d.memory_impact_score === "object"
    ? d.memory_impact_score as Record<string, unknown>
    : {};

  // Build agent_logs from agentes object
  const agentLogs: AgentLog[] = [];
  if (agentes) {
    const agentEntries: Array<[string, string]> = [
      ["gerador", "Gerador"],
      ["auditor_linguistico_ptbr", "Auditor Linguístico PT-BR"],
      ["auditor_medico", "Auditor Médico"],
      ["auditor_pedagogico", "Auditor Pedagógico"],
      ["visual", "Visual"],
      ["consolidador", "Consolidador"],
    ];
    for (const [key, label] of agentEntries) {
      const agentData = agentes[key] as Record<string, unknown> | undefined;
      if (!agentData) continue;
      const score = typeof agentData.score_medico === "number"
        ? agentData.score_medico
        : typeof agentData.score_pedagogico === "number"
          ? agentData.score_pedagogico
          : typeof agentData.score_linguistico === "number"
            ? agentData.score_linguistico
            : null;
      agentLogs.push({
        agent: label,
        attempt: 1,
        status: "ok",
        details: score != null ? `Score: ${score}` : "Concluído",
      });
    }
  }

  const associacoesVisuais = (visual?.associacoes_visuais ?? d.associacoes_visuais ?? []) as Array<{ termo: string; elemento_visual: string; associacao_fonetica?: string; acao_na_cena?: string }>;

  const scoreMedico = Number(d.score_medico ?? memoryImpact.clinical_relevance ?? 0);
  const scorePedagogico = Number(d.score_pedagogico ?? memoryImpact.visual_strength ?? 0);
  const scoreLinguistico = Number(d.score_linguistico ?? memoryImpact.simplicity ?? 0);
  const scoreFinal = Number(d.score_final ?? memoryImpact.composite_score ?? 0);

  const qualityFlag = (() => {
    if (scoreFinal >= 90) return "high" as const;
    if (scoreFinal >= 70 || scoreMedico >= 80 || scorePedagogico >= 80) return "medium" as const;
    return "low" as const;
  })();

  const imageUrl = typeof d.image_url === "string" && d.image_url.trim() && d.image_url !== "null"
    ? d.image_url
    : null;

  // Map cena_memoravel
  const cenaMemoravel = d.cena_memoravel && typeof d.cena_memoravel === "object"
    ? d.cena_memoravel as MnemonicResultData["cena_memoravel"]
    : null;

  // Map pontos_de_prova
  const pontosDeProva = Array.isArray(d.pontos_de_prova)
    ? d.pontos_de_prova as MnemonicResultData["pontos_de_prova"]
    : [];

  return {
    request_id: String(d.request_id ?? ""),
    result_id: String(d.result_id ?? ""),
    tema: String(d.tema ?? ""),
    sigla,
    frase_mnemonica: String(d.frase_mnemonica ?? d.phrase ?? ""),
    explicacao_tecnica: String(d.explicacao_tecnica ?? d.explanation_tecnica ?? ""),
    explicacao_didatica: String(d.explicacao_didatica ?? d.explanation_didatica ?? ""),
    cena_visual: String(d.cena_visual ?? d.scene_description ?? ""),
    prompt_imagem: String(d.prompt_imagem ?? d.image_prompt ?? ""),
    score_medico: scoreMedico,
    score_pedagogico: scorePedagogico,
    score_linguistico: scoreLinguistico,
    score_final: scoreFinal,
    quality_flag: typeof d.quality_flag === "string" ? d.quality_flag as MnemonicResultData["quality_flag"] : qualityFlag,
    alertas: Array.isArray(d.alertas) ? d.alertas.map(String) : [],
    associacoes: Array.isArray(associacoes) ? associacoes.map((a: any) => ({
      letra: String(a.letra ?? ""),
      termo_original: String(a.termo_original ?? ""),
      representacao_no_mnemonico: String(a.representacao_no_mnemonico ?? ""),
    })) : [],
    associacoes_visuais: Array.isArray(associacoesVisuais) ? associacoesVisuais : [],
    image_url: imageUrl,
    items_map: itemsMap,
    agent_logs: agentLogs,
    cena_memoravel: cenaMemoravel,
    pontos_de_prova: pontosDeProva,
  };
}

// ══════════════════════════════════════════════════
// GENERATE (calls edge function)
// ══════════════════════════════════════════════════

export async function generateMnemonic(input: MnemonicRequest & { onStatus?: (status: any) => void }): Promise<MnemonicApiResponse> {
  try {
    console.log("[MNEMONIC_03_INVOKE_START]", { tema: input.tema, termsCount: input.termos?.length });
    
    const response = await aiGateway.invoke("generate-mnemonic", input, {
      tier: 'REASONING',
      ttlDays: 30,
      onStatus: input.onStatus
    });

    if (!response.success) {
      console.error("[MNEMONIC_04_RESPONSE_ERROR] AI Gateway error:", response.error);
      return { success: false, error: response.error || "Falha ao gerar mnemônico." };
    }

    const data = response.data;
    if (!data || typeof data !== "object") {
      console.error("[MNEMONIC_04_RESPONSE_INVALID] data=", data);
      return { success: false, error: "Resposta inválida do servidor." };
    }

    console.log("[MNEMONIC_04_RESPONSE_SUCCESS]", data);

    const raw = data as Record<string, unknown>;


    // Check for explicit error response from edge function
    if (raw.success === false) {
      const requestId = raw.requestId ? ` [ID: ${raw.requestId}]` : "";
      return { 
        success: false, 
        error: String(raw.message || raw.error || "Erro ao gerar mnemônico.") + requestId 
      };
    }
    try {
      const mapped = mapEdgeFunctionResponse(raw, input.termos);

      // Guardrail final: rejeita resultado vazio/incoerente vindo da edge
      const fraseOk = (mapped.frase_mnemonica || "").trim().length >= 8;
      const expOk = (mapped.explicacao_didatica || "").trim().length >= 20;
      const scoreOk = Number(mapped.score_final) > 0;
      if (!fraseOk || !expOk || !scoreOk) {
        return {
          success: false,
          error: "Resultado inválido recebido do servidor.",
        };
      }

      return { success: true, data: mapped };
    } catch (e) {
      console.error("[mnemonics] Failed to map response:", e);
      return { success: false, error: "Erro ao processar resposta do servidor." };
    }
  } catch (err: any) {
    console.error("[mnemonics] generateMnemonic catch-all:", err);
    return { success: false, error: err?.message || "Erro inesperado ao gerar mnemônico." };
  }
}

// ══════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════

export interface HistoryFilters {
  tema?: string;
  favoritesOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface HistoryPage {
  items: MnemonicHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchMnemonicHistory(filters: HistoryFilters = {}): Promise<HistoryPage> {
  const { tema, favoritesOnly = false, page = 1, pageSize = 10 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  // Get favorites set for this user
  const { data: favs } = await supabase
    .from("mnemonic_favorites")
    .select("result_id")
    .eq("user_id", user.id);
  const favoriteResultIds = new Set((favs || []).map(f => f.result_id));

  let query = supabase
    .from("mnemonic_results")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_latest", true)
    .order("created_at", { ascending: false });

  if (tema) {
    query = query.ilike("tema", `%${tema}%`);
  }

  if (favoritesOnly) {
    const ids = Array.from(favoriteResultIds);
    if (ids.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
    query = query.in("id", ids);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const items: MnemonicHistoryItem[] = (data || []).map((row: any) => ({
    ...row,
    associacoes_json: row.associacoes_json || [],
    associacoes_visuais_json: row.associacoes_visuais_json || [],
    alertas_json: row.alertas_json || [],
    is_favorite: favoriteResultIds.has(row.id),
  }));

  const total = count ?? 0;
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ══════════════════════════════════════════════════
// FAVORITES
// ══════════════════════════════════════════════════

export async function toggleFavorite(resultId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data: existing } = await supabase
    .from("mnemonic_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("result_id", resultId)
    .maybeSingle();

  if (existing) {
    await supabase.from("mnemonic_favorites").delete().eq("id", existing.id);
    return false;
  } else {
    const { error } = await supabase.from("mnemonic_favorites").insert({
      user_id: user.id,
      result_id: resultId,
    });
    if (error) throw new Error(error.message);
    return true;
  }
}

// ══════════════════════════════════════════════════
// FEEDBACK
// ══════════════════════════════════════════════════

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { error } = await supabase.from("mnemonic_feedback").insert({
    user_id: user.id,
    result_id: payload.result_id,
    request_id: payload.request_id || null,
    rating_general: payload.rating_general,
    rating_medical: payload.rating_medical,
    rating_pedagogical: payload.rating_pedagogical,
    comentario: payload.comentario || null,
  });
  if (error) throw new Error(error.message);
}

// ══════════════════════════════════════════════════
// REGENERATION
// ══════════════════════════════════════════════════

const STYLE_HINTS: Record<RegenerateStyle, string> = {
  mais_facil: "engraçado",
  mais_tecnico: "acronimo",
  mais_visual: "visual",
  mais_curto: "acronimo",
};

export async function regenerateMnemonic(payload: RegeneratePayload): Promise<MnemonicApiResponse> {
  const mappedEstilo = STYLE_HINTS[payload.style_hint] || payload.estilo;
  return generateMnemonic({
    tema: payload.tema,
    termos: payload.termos,
    estilo: mappedEstilo,
    publico: payload.publico,
    original_result_id: payload.original_result_id,
  });
}
