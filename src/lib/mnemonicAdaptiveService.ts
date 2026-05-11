import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";
import { generateOrReuseMnemonicForUser } from "./mnemonicUnifiedService";

// ══════════════════════════════════════════════════
// TYPES (re-exported for consumers)
// ══════════════════════════════════════════════════

export type { MnemonicResult } from "./mnemonicUnifiedService";

type MnemonicStatus = "approved_visual" | "rejected";

interface MnemonicAsset {
  id: string;
  hash: string;
  topic: string;
  mnemonic: string;
  phrase: string;
  items_map_json: any;
  scene_description: string | null;
  image_url: string | null;
  quality_score: number;
  verdict: MnemonicStatus;
  review_question: string | null;
}

interface UserMnemonicLink {
  id: string;
  mnemonic_asset_id: string;
  topic: string;
  next_review_at: string;
  times_shown: number;
  helped_after_error: boolean | null;
  improvement_delta: number | null;
  mnemonic_not_helping: boolean;
  accuracy_before?: number | null;
  accuracy_after?: number | null;
  mnemonic_assets?: MnemonicAsset;
}

export interface PendingMnemonic {
  asset: MnemonicAsset;
  link: UserMnemonicLink;
  reason: "post_error" | "pre_session" | "spaced_review";
}

// ══════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════

const MIN_ERRORS_TRIGGER = 2;
const MAX_ACTIVE_MNEMONICS = 3;
const COOLDOWN_DAYS = 7;

const BLOCKED_KEYWORDS = [
  "dosagem", "posologia", "dose", "mg/kg", "mg/dl",
  "protocolo de emergência", "reanimação", "pcr",
  "timing", "intervalo de tempo", "contraindicação absoluta",
];

function isTopicEligibleForMnemonic(topic: string, content?: string): boolean {
  const combined = `${topic} ${content || ""}`.toLowerCase();
  return !BLOCKED_KEYWORDS.some(kw => combined.includes(kw));
}

// ══════════════════════════════════════════════════
// TRIGGER DETECTION
// ══════════════════════════════════════════════════

interface TriggerCheckResult {
  shouldTrigger: boolean;
  reason?: string;
  topic?: string;
}

export async function checkMnemonicTrigger(
  userId: string, topic: string
): Promise<TriggerCheckResult> {
  if (!isTopicEligibleForMnemonic(topic)) return { shouldTrigger: false };

  const { data: errors } = await supabase
    .from("error_bank")
    .select("id, vezes_errado, conteudo, subtema, dificuldade")
    .eq("user_id", userId)
    .eq("tema", topic)
    .eq("dominado", false)
    .order("vezes_errado", { ascending: false })
    .limit(5);

  const totalErrors = errors?.reduce((sum, e) => sum + (e.vezes_errado || 1), 0) || 0;

  // Read accuracy from unified view (read-only). Only 'simulado' source carries
  // a real measured 0-100 accuracy — 'error_bank' is hardcoded to 0 (would
  // always trigger), 'fsrs' uses tema='fsrs' literal. tempo_gasto is not exposed
  // by the view, so we keep a separate legacy lookup limited to recent rows.
  const { data: perf } = await supabase
    .from("performance_unified" as any)
    .select("taxa_acerto, data_registro")
    .eq("user_id", userId)
    .eq("source", "simulado")
    .order("data_registro", { ascending: false })
    .limit(5);

  const { data: legacyTime } = await supabase
    .from("desempenho_questoes")
    .select("tempo_gasto")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Default avgAccuracy=1 (neutral, no trigger) when no real samples exist.
  const avgAccuracy = perf && perf.length > 0
    ? perf.reduce((s: number, p: any) => {
        const v = Number(p.taxa_acerto);
        return s + (Number.isFinite(v) ? v : 0);
      }, 0) / perf.length / 100
    : 1;
  const avgTime = legacyTime && legacyTime.length > 0
    ? legacyTime.reduce((s, p) => s + (p.tempo_gasto || 0), 0) / legacyTime.length
    : 0;

  const meetsThreshold =
    totalErrors >= MIN_ERRORS_TRIGGER ||
    avgAccuracy < 0.6 ||
    avgTime > 180;

  if (!meetsThreshold) return { shouldTrigger: false };

  const { count: activeCount } = await supabase
    .from("user_mnemonic_links")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("mnemonic_not_helping", false)
    .lte("next_review_at", new Date(Date.now() + 7 * 86400000).toISOString());

  if ((activeCount || 0) >= MAX_ACTIVE_MNEMONICS) return { shouldTrigger: false };

  const { data: recentLink } = await supabase
    .from("user_mnemonic_links")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("topic", topic)
    .gte("created_at", new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString())
    .limit(1);

  if (recentLink && recentLink.length > 0) return { shouldTrigger: false };

  const reason = totalErrors >= MIN_ERRORS_TRIGGER
    ? `${totalErrors} erros no tema "${topic}"`
    : avgAccuracy < 0.6
    ? `Mastery baixo (${Math.round(avgAccuracy * 100)}%) no tema "${topic}"`
    : `Tempo de resposta alto (${Math.round(avgTime)}s) no tema "${topic}"`;

  return { shouldTrigger: true, reason, topic };
}

// ══════════════════════════════════════════════════
// SERVING: Get pending mnemonics
// ══════════════════════════════════════════════════

export async function getPendingMnemonics(
  userId: string, currentTopic?: string
): Promise<PendingMnemonic[]> {
  const now = new Date().toISOString();
  const results: PendingMnemonic[] = [];

  const { data: dueLinks } = await supabase
    .from("user_mnemonic_links")
    .select("*, mnemonic_assets(*)")
    .eq("user_id", userId)
    .eq("mnemonic_not_helping", false)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(3);

  if (dueLinks) {
    for (const link of dueLinks) {
      const asset = (link as any).mnemonic_assets as MnemonicAsset;
      if (asset && asset.verdict !== "rejected") {
        results.push({ asset, link: link as unknown as UserMnemonicLink, reason: "spaced_review" });
      }
    }
  }

  if (currentTopic && results.length < MAX_ACTIVE_MNEMONICS) {
    const { data: topicLinks } = await supabase
      .from("user_mnemonic_links")
      .select("*, mnemonic_assets(*)")
      .eq("user_id", userId)
      .eq("topic", currentTopic)
      .eq("mnemonic_not_helping", false)
      .limit(1);

    if (topicLinks) {
      for (const link of topicLinks) {
        const asset = (link as any).mnemonic_assets as MnemonicAsset;
        if (asset && asset.verdict !== "rejected" && !results.find(r => r.asset.id === asset.id)) {
          results.push({ asset, link: link as unknown as UserMnemonicLink, reason: "pre_session" });
        }
      }
    }
  }

  return results.slice(0, MAX_ACTIVE_MNEMONICS);
}

// ══════════════════════════════════════════════════
// MARK AS SHOWN
// ══════════════════════════════════════════════════

export async function markMnemonicShown(linkId: string) {
  const { data } = await supabase.from("user_mnemonic_links").select("times_shown").eq("id", linkId).single();
  await supabase
    .from("user_mnemonic_links")
    .update({
      times_shown: (data?.times_shown || 0) + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", linkId);
}

// ══════════════════════════════════════════════════
// EFFICACY MEASUREMENT
// ══════════════════════════════════════════════════

export async function updateMnemonicEfficacy(
  userId: string, topic: string, wasCorrect: boolean
) {
  const { data: links } = await supabase
    .from("user_mnemonic_links")
    .select("id, times_shown, helped_after_error, accuracy_before, accuracy_after, mnemonic_not_helping")
    .eq("user_id", userId)
    .eq("topic", topic)
    .eq("mnemonic_not_helping", false);

  if (!links || links.length === 0) return;

  for (const link of links) {
    if (link.times_shown === 0) continue;

    const newAccuracyAfter = link.accuracy_after !== null
      ? (Number(link.accuracy_after) * 0.7 + (wasCorrect ? 100 : 0) * 0.3)
      : (wasCorrect ? 100 : 0);

    const improvementDelta = link.accuracy_before !== null
      ? newAccuracyAfter - Number(link.accuracy_before)
      : null;

    const helped = improvementDelta !== null ? improvementDelta > 0 : null;

    let nextReviewAt: string;
    if (helped) {
      const intervalDays = link.times_shown <= 1 ? 3 : 7;
      nextReviewAt = new Date(Date.now() + intervalDays * 86400000).toISOString();
    } else {
      nextReviewAt = new Date(Date.now() + 86400000).toISOString();
    }

    const markNotHelping = link.times_shown >= 2 && improvementDelta !== null && improvementDelta <= 0;

    await supabase
      .from("user_mnemonic_links")
      .update({
        accuracy_after: newAccuracyAfter,
        improvement_delta: improvementDelta,
        helped_after_error: helped,
        next_review_at: nextReviewAt,
        mnemonic_not_helping: markNotHelping || link.mnemonic_not_helping,
      })
      .eq("id", link.id);
  }
}

export async function recordBaselineAccuracy(
  userId: string, topic: string, accuracy: number
) {
  await supabase
    .from("user_mnemonic_links")
    .update({ accuracy_before: accuracy })
    .eq("user_id", userId)
    .eq("topic", topic)
    .is("accuracy_before", null);
}

// ══════════════════════════════════════════════════
// FIRE-AND-FORGET TRIGGER (legacy compatibility)
// ══════════════════════════════════════════════════

export function triggerAdaptiveMnemonicCheck(userId: string, topic: string) {
  checkMnemonicTrigger(userId, topic).then(async (result) => {
    if (!result.shouldTrigger) return;
    console.log(`[MnemonicAdaptive] Triggering for "${topic}":`, result.reason);

    const { data: matrixRows } = await supabase
      .from("curriculum_matrix")
      .select("gatilhos_clinicos, palavras_chave, subtema, tipo_cobranca")
      .ilike("tema", `%${topic}%`)
      .eq("ativo", true)
      .limit(1);

    if (!matrixRows || matrixRows.length === 0) {
      console.log(`[MnemonicAdaptive] No canonical list found for "${topic}" — skipping generation`);
      return;
    }

    const matrix = matrixRows[0];
    const canonicalItems = Array.isArray(matrix.gatilhos_clinicos) ? matrix.gatilhos_clinicos : [];

    if (canonicalItems.length < 3 || canonicalItems.length > 7) {
      console.log(`[MnemonicAdaptive] Canonical list has ${canonicalItems.length} items — not in valid range (3-7)`);
      return;
    }

    const tipoCobranca = Array.isArray(matrix.tipo_cobranca) ? matrix.tipo_cobranca : [];
    const contentType = tipoCobranca.includes("criterios") ? "criterios"
      : tipoCobranca.includes("causas") ? "causas"
      : tipoCobranca.includes("classificacao") ? "classificacao"
      : "lista";

    await generateOrReuseMnemonicForUser({
      userId,
      topic,
      contentType,
      items: canonicalItems,
      source: "adaptive",
    });
  }).catch(err => {
    console.error("[MnemonicAdaptive] Trigger check failed:", err);
  });
}
