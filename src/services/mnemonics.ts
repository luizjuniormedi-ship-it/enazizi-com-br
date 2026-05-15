/**
 * Mnemonic Module — Service layer (Supabase client-side queries + edge function calls).
 */
import { supabase } from "@/integrations/supabase/client";
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

  // Build items_map from generator associations
  const sigla = String(d.sigla ?? "");
  const associacoes = (gerador?.associacoes ?? d.associacoes) as Array<Record<string, string>> | undefined;
  let itemsMap: MnemonicResultData["items_map"] = [];

  // items_map só a partir de associações REAIS — NUNCA inventado dos termos (sem fallback termo→termo)
  if (Array.isArray(associacoes) && associacoes.length > 0) {
    itemsMap = associacoes
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

  const qualityFlag = (() => {
    const sl = Number(d.score_linguistico ?? 0);
    const sm = Number(d.score_medico ?? 0);
    const sf = Number(d.score_final ?? 0);
    if (sl < 80 || sm < 85) return "low" as const;
    if (sf >= 90) return "high" as const;
    return "medium" as const;
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
    frase_mnemonica: String(d.frase_mnemonica ?? ""),
    explicacao_tecnica: String(d.explicacao_tecnica ?? ""),
    explicacao_didatica: String(d.explicacao_didatica ?? ""),
    cena_visual: String(d.cena_visual ?? ""),
    prompt_imagem: String(d.prompt_imagem ?? ""),
    score_medico: Number(d.score_medico ?? 0),
    score_pedagogico: Number(d.score_pedagogico ?? 0),
    score_linguistico: Number(d.score_linguistico ?? 0),
    score_final: Number(d.score_final ?? 0),
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

export async function generateMnemonic(input: MnemonicRequest): Promise<MnemonicApiResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-mnemonic", {
      body: input,
      headers: { "x-timeout-ms": "115000" }, // Signal to backend
    });

    if (error) {
      console.error("[mnemonics] Edge function error:", error);
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const payload = await ctx.json();
          const requestId = payload?.requestId ? ` [ID: ${payload.requestId}]` : "";
          return { 
            success: false, 
            error: (payload?.message || payload?.error || "Erro ao gerar mnemônico.") + requestId 
          };
        } catch { /* fall through */ }
      }
      return { success: false, error: "Falha na conexão com o servidor de mnemônicos." };
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "Resposta inválida do servidor." };
    }

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
