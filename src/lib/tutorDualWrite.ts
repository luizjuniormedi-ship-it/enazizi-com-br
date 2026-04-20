/**
 * Tutor dual-write: fire-and-forget writes to new tutor tables
 * (tutor_sessions, tutor_messages, tutor_context_snapshots)
 * while legacy chat_conversations/chat_messages remain the primary source.
 *
 * STATUS: TRANSITIONAL — dual-write active.
 * Next step: migrate READ path to tutor_sessions/tutor_messages,
 * then deprecate chat_conversations/chat_messages for tutor agent_type.
 *
 * Uses persistent DB lookups + unique constraint for dedup safety.
 */
import { supabase } from "@/integrations/supabase/client";

/** In-memory cache to avoid repeated DB lookups within the same page session */
const sessionCache = new Map<string, string>();

/**
 * Resolve or create a tutor_session for a conversation.
 * Uses unique constraint on conversation_id for dedup.
 */
async function resolveSessionId(
  userId: string,
  conversationId: string,
  extra?: { mode?: string; topic?: string; specialty?: string; missionId?: string; phase?: string }
): Promise<string | null> {
  // 1. In-memory cache
  const cached = sessionCache.get(conversationId);
  if (cached) return cached;

  try {
    // 2. DB lookup
    const { data: existing } = await supabase
      .from("tutor_sessions" as any)
      .select("id")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (existing) {
      const id = (existing as any).id;
      sessionCache.set(conversationId, id);
      return id;
    }

    // 3. Insert (unique constraint prevents dupes from concurrent calls)
    // NOTE: schema default = 'livre'. Mantemos alinhamento explícito para evitar drift.
    const { data: created, error } = await supabase
      .from("tutor_sessions" as any)
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        mode: extra?.mode || "livre",
        topic: extra?.topic || null,
        specialty: extra?.specialty || null,
        mission_id: extra?.missionId || null,
        current_phase: extra?.phase || null,
        source_context: "dual-write",
      })
      .select("id")
      .single();

    if (error) {
      // Likely unique constraint violation — re-fetch
      const { data: retry } = await supabase
        .from("tutor_sessions" as any)
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (retry) {
        const id = (retry as any).id;
        sessionCache.set(conversationId, id);
        return id;
      }
      // Telemetria leve: erro real (não unique-violation) precisa ser visível
      // para evitar fragmentação silenciosa do dual-write.
      if (typeof console !== "undefined") {
        console.warn("[tutorDualWrite] tutor_sessions insert failed:", error.message);
      }
      return null;
    }

    if (created) {
      const id = (created as any).id;
      sessionCache.set(conversationId, id);
      return id;
    }
    return null;
  } catch (e: any) {
    if (typeof console !== "undefined") {
      console.warn("[tutorDualWrite] resolveSessionId exception:", e?.message ?? e);
    }
    return null;
  }
}

/**
 * Create a tutor_session mirroring a chat_conversation.
 */
export function dualWriteTutorSession(params: {
  userId: string;
  conversationId: string;
  mode?: "free" | "mission";
  topic?: string;
  specialty?: string;
  missionId?: string;
  phase?: string;
}): void {
  const { userId, conversationId, ...extra } = params;
  // Fire-and-forget — resolveSessionId handles dedup
  resolveSessionId(userId, conversationId, extra);
}

/**
 * Write a message to tutor_messages mirroring chat_messages.
 */
export function dualWriteTutorMessage(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  tokensUsed?: number;
}): void {
  const { userId, conversationId, role, content, modelUsed, tokensUsed } = params;

  (async () => {
    try {
      const sessionId = await resolveSessionId(userId, conversationId);
      if (!sessionId) return;

      await supabase.from("tutor_messages" as any).insert({
        tutor_session_id: sessionId,
        user_id: userId,
        role,
        content: content.slice(0, 50000),
        model_used: modelUsed || null,
        tokens_used: tokensUsed || null,
      });
    } catch {
      // Silent — legacy flow continues
    }
  })();
}

/**
 * Save a context snapshot linked to a tutor session.
 */
export function dualWriteTutorContextSnapshot(params: {
  userId: string;
  conversationId?: string;
  missionId?: string;
  mainError?: string;
  currentGoal?: string;
  pendingReviews?: number;
  accuracy?: number;
  phase?: string;
  examFocus?: string;
  extraContext?: Record<string, unknown>;
}): void {
  const {
    userId, conversationId, missionId, mainError, currentGoal,
    pendingReviews, accuracy, phase, examFocus, extraContext,
  } = params;

  (async () => {
    try {
      let sessionId: string | null = null;
      if (conversationId) {
        sessionId = await resolveSessionId(userId, conversationId);
      }

      await supabase.from("tutor_context_snapshots" as any).insert({
        user_id: userId,
        tutor_session_id: sessionId,
        mission_id: missionId || null,
        main_error: mainError || null,
        current_goal: currentGoal || null,
        pending_reviews: pendingReviews ?? null,
        accuracy: accuracy ?? null,
        phase: phase || null,
        exam_focus: examFocus || null,
        context_json: extraContext ? JSON.stringify(extraContext) : null,
      });
    } catch {
      // Silent
    }
  })();
}
