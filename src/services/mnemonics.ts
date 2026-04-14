/**
 * Mnemonic Module — Service layer (Supabase client-side queries + edge function calls).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  MnemonicRequest,
  MnemonicApiResponse,
  MnemonicHistoryItem,
  FeedbackPayload,
  RegeneratePayload,
  RegenerateStyle,
} from "@/types/mnemonics";

// ══════════════════════════════════════════════════
// GENERATE (calls edge function)
// ══════════════════════════════════════════════════

export async function generateMnemonic(input: MnemonicRequest): Promise<MnemonicApiResponse> {
  const { data, error } = await supabase.functions.invoke("generate-medical-mnemonic", {
    body: input,
  });

  if (error) {
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.json();
        return { success: false, error: payload?.error || "Erro ao gerar mnemônico." };
      } catch { /* fall through */ }
    }
    return { success: false, error: "Erro ao gerar mnemônico." };
  }

  if (!data || typeof data !== "object") {
    return { success: false, error: "Resposta inválida do servidor." };
  }

  return data as MnemonicApiResponse;
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
  let favoriteResultIds = new Set<string>();
  if (favoritesOnly) {
    const { data: favs } = await supabase
      .from("mnemonic_favorites")
      .select("result_id")
      .eq("user_id", user.id);
    favoriteResultIds = new Set((favs || []).map(f => f.result_id));
  } else {
    const { data: favs } = await supabase
      .from("mnemonic_favorites")
      .select("result_id")
      .eq("user_id", user.id);
    favoriteResultIds = new Set((favs || []).map(f => f.result_id));
  }

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
  });
}
