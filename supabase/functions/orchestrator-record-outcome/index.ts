/**
 * orchestrator-record-outcome — P0 minimal viable
 *
 * Closes the adaptive loop: links a recommendation (assistant_decisions row)
 * to the real result of executing it (acerto/erro/abandono).
 *
 * This endpoint is intentionally tiny — the canonical writer of outcomes is
 * `study-complete`, which calls this internally when metadata.decisionId is
 * present. We expose a public POST so any consumer (CockpitHero, future
 * Tutor drawer, image_quiz, etc.) can also report outcomes without going
 * through study-complete.
 *
 * Body:
 *   decisionId: string (required) — id from assistant_decisions
 *   followed?: boolean
 *   wasCorrect?: boolean   → maps to outcome ("correct"/"wrong"/"unknown")
 *   topic?: string
 *   subtopic?: string
 *   modality?: string      → next_action of the original recommendation
 *   phase?: string
 *   exploration?: boolean
 *   improvementDelta?: number   (-1..+1)
 *   retentionDelta?: number     (-1..+1)
 *   errorReduction?: number     (-1..+1)
 *   timeToFollowSeconds?: number
 *   preSignals?: object
 *   postSignals?: object
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest,
} from "../_shared/assistant-helpers.ts";
import { updatePerformanceMetrics } from "../_shared/performance-engine.ts";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const decisionId = body.decisionId as string | undefined;
    if (!decisionId) return errorResponse("decisionId is required");

    const db = getServiceClient();

    // Resolve the original decision so we can default modality/topic from it
    let nextAction: string | null = null;
    let resolvedTopic: string | null = body.topic ?? null;
    let resolvedSubtopic: string | null = body.subtopic ?? null;
    let resolvedModality: string | null = body.modality ?? null;
    let resolvedPhase: string | null = body.phase ?? null;
    let resolvedExploration: boolean = !!body.exploration;

    const { data: decision } = await db
      .from("assistant_decisions")
      .select("decision_output, input_snapshot")
      .eq("id", decisionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (decision) {
      const out = (decision.decision_output ?? {}) as Record<string, unknown>;
      const inSnap = (decision.input_snapshot ?? {}) as Record<string, unknown>;
      const adaptive = (inSnap.adaptiveState ?? {}) as Record<string, unknown>;
      nextAction = (out.nextAction as string) ?? null;
      if (!resolvedModality) resolvedModality = nextAction;
      if (!resolvedTopic) {
        const payload = (out.payload ?? {}) as Record<string, unknown>;
        resolvedTopic = (payload.topic as string) ?? null;
      }
      if (!resolvedPhase) resolvedPhase = (adaptive.studyPhase as string) ?? null;
      if (typeof body.exploration !== "boolean" && Array.isArray(out.badges)) {
        resolvedExploration = (out.badges as string[]).includes("exploring");
      }
    }

    if (!nextAction) {
      // Cannot link to an unknown decision — still allow insert with provided modality
      nextAction = resolvedModality ?? "unknown";
    }

    const wasCorrect = typeof body.wasCorrect === "boolean" ? body.wasCorrect : null;
    const outcome = wasCorrect === null
      ? (body.outcome as string | undefined) ?? null
      : (wasCorrect ? "correct" : "wrong");

    const insertRow = {
      user_id: userId,
      decision_id: decisionId,
      next_action: nextAction,
      topic: resolvedTopic,
      subtopic: resolvedSubtopic,
      followed: typeof body.followed === "boolean" ? body.followed : true,
      outcome,
      pre_signals: body.preSignals ?? {},
      post_signals: body.postSignals ?? {},
      improvement_delta: typeof body.improvementDelta === "number" ? body.improvementDelta : null,
      retention_delta: typeof body.retentionDelta === "number" ? body.retentionDelta : null,
      error_reduction: typeof body.errorReduction === "number" ? body.errorReduction : null,
      time_to_follow_seconds: typeof body.timeToFollowSeconds === "number" ? body.timeToFollowSeconds : null,
      modality: resolvedModality,
      phase: resolvedPhase,
      exploration: resolvedExploration,
    };

    const { data: inserted, error } = await db
      .from("orchestrator_outcomes")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error("[orchestrator-record-outcome] insert failed:", error.message);
      return errorResponse(error.message, 500);
    }

    // --- INTEGRATION: Update Performance Metrics ---
    if (outcome !== "unknown" && resolvedTopic) {
      try {
        await updatePerformanceMetrics(db, {
          userId,
          specialty: (decision as any)?.input_snapshot?.specialty || "Geral",
          topic: resolvedTopic,
          isCorrect: outcome === "correct",
          responseTimeSeconds: body.timeToFollowSeconds,
          difficulty: (decision as any)?.input_snapshot?.difficulty
        });
      } catch (perfErr) {
        console.warn("[orchestrator-record-outcome] Metrics update failed:", perfErr);
      }
    }

    return jsonResponse({ success: true, outcomeId: (inserted as { id: string }).id });

  } catch (e) {
    console.error("[orchestrator-record-outcome]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
