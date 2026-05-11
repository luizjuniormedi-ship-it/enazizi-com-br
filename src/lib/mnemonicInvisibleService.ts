/**
 * Invisible Mnemonic Service — Auto-triggers mnemonic generation based on
 * student behavior (errors, CLS, RFS) without any manual click.
 *
 * Uses the EXISTING pipeline:
 *   suggest-mnemonic-items → generateOrReuseMnemonicForUser (with normalization + auditors)
 *
 * Fail-closed: any stage failure → silently abort, user sees nothing.
 */
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";
import { generateOrReuseMnemonicForUser, type MnemonicResult } from "./mnemonicUnifiedService";
import { type InterventionDecision, type CLSResult, type RFSResult } from "./mnemonicIntelligence";

// ══════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════

export interface InvisibleTriggerParams {
  userId: string;
  topic: string;
  subtopic?: string;
  sourceContext?: {
    questionId?: string;
    attemptId?: string;
    sessionId?: string;
    triggerReason?: string;
  };
  decision?: InterventionDecision;
  cls?: CLSResult;
  rfs?: RFSResult;
}

export interface InvisibleMnemonicEvent {
  event: string;
  userId: string;
  topic: string;
  subtopic?: string;
  triggerReason?: string;
  cls?: number;
  rfs?: number;
  success?: boolean;
  cached?: boolean;
  responseTimeMs?: number;
}

export interface ServableMnemonic {
  assetId: string;
  linkId: string;
  topic: string;
  mnemonic: string;
  phrase: string;
  itemsMap: any[];
  imageUrl: string | null;
  qualityScore: number;
  reviewQuestion: string | null;
  reason: "post_error" | "pre_session" | "spaced_review";
  timesShown: number;
}

// ══════════════════════════════════════════════════
// CONSTANTS (anti-spam)
// ══════════════════════════════════════════════════

const MAX_INVISIBLE_PER_TOPIC_DAYS = 7;
const MAX_INVISIBLE_ACTIVE = 3;
const BLOCKED_KEYWORDS = [
  "dosagem", "posologia", "dose", "mg/kg", "mg/dl",
  "protocolo de emergência", "reanimação", "pcr",
  "timing", "intervalo de tempo", "contraindicação absoluta",
];

// ══════════════════════════════════════════════════
// TELEMETRY
// ══════════════════════════════════════════════════

function logInvisibleEvent(evt: InvisibleMnemonicEvent) {
  console.log(`[InvisibleMnemonic] ${evt.event}`, {
    topic: evt.topic,
    reason: evt.triggerReason,
    cls: evt.cls,
    rfs: evt.rfs,
    success: evt.success,
  });

  // Fire-and-forget: persist telemetry to study_action_events
  supabase
    .from("study_action_events")
    .insert({
      user_id: evt.userId,
      task_type: `invisible_mnemonic_${evt.event}`,
      origin_module: "mnemonic_invisible",
      topic: evt.topic,
      subtopic: evt.subtopic || null,
      status: evt.success === false ? "error" : "success",
      payload_json: {
        trigger_reason: evt.triggerReason,
        cls: evt.cls,
        rfs: evt.rfs,
        cached: evt.cached,
        response_time_ms: evt.responseTimeMs,
      },
    })
    .then(() => {});
}

// ══════════════════════════════════════════════════
// ANTI-SPAM CHECKS
// ══════════════════════════════════════════════════

async function passesAntiSpam(userId: string, topic: string): Promise<boolean> {
  // 1. Check recent invisible mnemonic for same topic
  const { data: recentLink } = await supabase
    .from("user_mnemonic_links")
    .select("id")
    .eq("user_id", userId)
    .eq("topic", topic)
    .gte("created_at", new Date(Date.now() - MAX_INVISIBLE_PER_TOPIC_DAYS * 86400000).toISOString())
    .limit(1);

  if (recentLink && recentLink.length > 0) return false;

  // 2. Check total active invisible mnemonics
  const { count } = await supabase
    .from("user_mnemonic_links")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("mnemonic_not_helping", false)
    .lte("next_review_at", new Date(Date.now() + 7 * 86400000).toISOString());

  if ((count || 0) >= MAX_INVISIBLE_ACTIVE) return false;

  // 3. Check if we already showed an invisible mnemonic in this session (last 30 min)
  const { data: recentEvents } = await supabase
    .from("study_action_events")
    .select("id")
    .eq("user_id", userId)
    .eq("task_type", "invisible_mnemonic_shown")
    .gte("created_at", new Date(Date.now() - 30 * 60000).toISOString())
    .limit(1);

  if (recentEvents && recentEvents.length > 0) return false;

  return true;
}

function isTopicEligible(topic: string): boolean {
  const lower = topic.toLowerCase();
  return !BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

// ══════════════════════════════════════════════════
// MAIN: triggerInvisibleMnemonic
// Fire-and-forget — called from completeStudyAction orchestrator
// ══════════════════════════════════════════════════

export function triggerInvisibleMnemonic(params: InvisibleTriggerParams) {
  const { userId, topic, subtopic, sourceContext, decision, cls, rfs } = params;

  // Start async pipeline — never throws to caller
  (async () => {
    const startMs = Date.now();

    // 1. Eligibility
    if (!isTopicEligible(topic)) return;

    logInvisibleEvent({
      event: "triggered",
      userId, topic, subtopic,
      triggerReason: decision?.reason || sourceContext?.triggerReason,
      cls: cls?.score,
      rfs: rfs?.score,
    });

    // 2. Anti-spam
    const allowed = await passesAntiSpam(userId, topic);
    if (!allowed) {
      console.log(`[InvisibleMnemonic] Anti-spam blocked for "${topic}"`);
      return;
    }

    // 3. Get subtopic from curriculum if not provided
    let effectiveSubtopic = subtopic;
    if (!effectiveSubtopic) {
      const { data: matrixRows } = await supabase
        .from("curriculum_matrix")
        .select("subtema")
        .ilike("tema", `%${topic}%`)
        .eq("ativo", true)
        .limit(1);

      effectiveSubtopic = matrixRows?.[0]?.subtema || undefined;
    }

    // 4. Suggest items via edge function (same as manual flow)
    const effectiveTopic = effectiveSubtopic
      ? `${topic.trim()} - ${effectiveSubtopic.trim()}`
      : topic.trim();

    const { data: suggestData, error: suggestError } = await supabase.functions.invoke(
      "suggest-mnemonic-items",
      { body: { topic: effectiveTopic, contentType: "lista" } }
    );

    if (suggestError || !suggestData?.items || suggestData.items.length < 3) {
      console.log(`[InvisibleMnemonic] Item suggestion failed or insufficient for "${topic}"`);
      return; // fail-closed
    }

    const items: string[] = suggestData.items.slice(0, 7);

    // 5. Determine contentType from curriculum
    const { data: matrixType } = await supabase
      .from("curriculum_matrix")
      .select("tipo_cobranca")
      .ilike("tema", `%${topic}%`)
      .eq("ativo", true)
      .limit(1);

    const tipoCobranca = Array.isArray(matrixType?.[0]?.tipo_cobranca) ? matrixType[0].tipo_cobranca : [];
    const contentType = tipoCobranca.includes("criterios") ? "criterios"
      : tipoCobranca.includes("causas") ? "causas"
      : tipoCobranca.includes("classificacao") ? "classificacao"
      : "lista";

    logInvisibleEvent({
      event: "generating",
      userId, topic, subtopic: effectiveSubtopic,
      triggerReason: decision?.reason,
      cls: cls?.score,
      rfs: rfs?.score,
    });

    // 6. Generate via unified pipeline (includes normalization + auditors)
    const result = await generateOrReuseMnemonicForUser({
      userId,
      topic,
      contentType,
      items,
      source: "adaptive",
      sourceContext: {
        ...sourceContext,
        topicId: undefined,
      },
    });

    const elapsed = Date.now() - startMs;

    if (!result.success) {
      logInvisibleEvent({
        event: "failed",
        userId, topic, subtopic: effectiveSubtopic,
        triggerReason: decision?.reason,
        cls: cls?.score,
        rfs: rfs?.score,
        success: false,
        responseTimeMs: elapsed,
      });
      return; // fail-closed
    }

    logInvisibleEvent({
      event: "generated",
      userId, topic, subtopic: effectiveSubtopic,
      triggerReason: decision?.reason,
      cls: cls?.score,
      rfs: rfs?.score,
      success: true,
      cached: result.result?.cached,
      responseTimeMs: elapsed,
    });
  })().catch((err) => {
    console.error("[InvisibleMnemonic] Pipeline error (fail-closed):", err);
  });
}

// ══════════════════════════════════════════════════
// SERVING: getInvisibleMnemonicToShow
// Called by UI hook to check if there's a mnemonic to display
// ══════════════════════════════════════════════════

export async function getInvisibleMnemonicToShow(
  userId: string,
  currentTopic?: string,
  resetAt?: string | null
): Promise<ServableMnemonic | null> {
  const now = new Date().toISOString();
  const fence = resetAt || "1900-01-01T00:00:00Z";

  // Priority 1: topic-relevant, recently generated
  if (currentTopic) {
    const { data: topicLinks } = await supabase
      .from("user_mnemonic_links")
      .select("*, mnemonic_assets(*)")
      .eq("user_id", userId)
      .eq("topic", currentTopic)
      .eq("mnemonic_not_helping", false)
      .gt("created_at", fence)
      .lte("next_review_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    const match = topicLinks?.[0];
    if (match) {
      const asset = (match as any).mnemonic_assets;
      if (asset && asset.verdict !== "rejected") {
        return mapToServable(asset, match, "post_error");
      }
    }
  }

  // Priority 2: any due mnemonic
  const { data: dueLinks } = await supabase
    .from("user_mnemonic_links")
    .select("*, mnemonic_assets(*)")
    .eq("user_id", userId)
    .eq("mnemonic_not_helping", false)
    .gt("created_at", fence)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(1);

  const due = dueLinks?.[0];
  if (due) {
    const asset = (due as any).mnemonic_assets;
    if (asset && asset.verdict !== "rejected") {
      return mapToServable(asset, due, "spaced_review");
    }
  }

  return null;
}

function mapToServable(asset: any, link: any, reason: ServableMnemonic["reason"]): ServableMnemonic {
  return {
    assetId: asset.id,
    linkId: link.id,
    topic: asset.topic,
    mnemonic: asset.mnemonic,
    phrase: asset.phrase,
    itemsMap: Array.isArray(asset.items_map_json) ? asset.items_map_json : [],
    imageUrl: asset.image_url,
    qualityScore: asset.quality_score,
    reviewQuestion: asset.review_question,
    reason,
    timesShown: link.times_shown || 0,
  };
}

// ══════════════════════════════════════════════════
// MARK AS SHOWN (increment counter)
// ══════════════════════════════════════════════════

export async function markInvisibleShown(linkId: string, userId: string) {
  const { data } = await supabase
    .from("user_mnemonic_links")
    .select("times_shown")
    .eq("id", linkId)
    .single();

  await supabase
    .from("user_mnemonic_links")
    .update({
      times_shown: (data?.times_shown || 0) + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", linkId);

  logInvisibleEvent({ event: "shown", userId, topic: "" });
}

// ══════════════════════════════════════════════════
// MARK IGNORED (user dismissed)
// ══════════════════════════════════════════════════

export function markInvisibleIgnored(userId: string, topic: string) {
  logInvisibleEvent({ event: "ignored", userId, topic });
}
