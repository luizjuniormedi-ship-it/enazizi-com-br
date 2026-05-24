// Tutor V2 — Sprint 5
// Hook que enriquece o envio do Tutor com contexto adaptativo do cérebro
// do ENAZIZI, via edge function `tutor-context-builder`.
//
// Comportamento:
//  - Se a flag `tutor_adaptive_context_enabled` estiver OFF → retorna null
//    e o Tutor segue exatamente como hoje (V1).
//  - Se ON → consulta a edge function de forma silenciosa (timeout curto,
//    falha tolerada) e devolve `adaptiveContext | null`.
//  - Telemetria local apenas via console (sem writeback em banco nesta sprint).

import { useCallback, useRef } from "react";
import { callTutorV3 } from "@/lib/tutor/tutorClient";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export interface AdaptiveContext {
  weak_topics: Array<{ tema: string; subtema: string | null; vezes_errado: number }>;
  fsrs_due: Array<{ id: string; topic: string | null; due_at: string | null }>;
  current_mission: {
    plan_date: string;
    objective: string | null;
    phase: string | null;
    completed: number;
    total: number;
    pending_tasks: Array<{ title: string; task_type: string; topic: string | null }>;
  } | null;
  prep_index: {
    score: number;
    prep_index: number | null;
    chance_score: number | null;
    accuracy: number;
  } | null;
  target_banca: string | null;
  last_orchestrator_decision: Record<string, unknown> | null;
  session_context: { topic: string | null; subtopic: string | null } | null;
  meta: {
    generated_at: string;
    source: string;
    flags_evaluated: Record<string, boolean>;
  };
}

export type AdaptiveStatus = "off" | "ok" | "failed" | "skipped";

export interface FetchAdaptiveArgs {
  message: string;
  topic?: string | null;
  subtopic?: string | null;
  conversationId?: string | null;
}

export interface FetchAdaptiveResult {
  context: AdaptiveContext | null;
  status: AdaptiveStatus;
  latency_ms: number;
}

const ADAPTIVE_TIMEOUT_MS = 2500;

export function useTutorAdaptiveContext() {
  const { isEnabled } = useFeatureFlags();
  const lastStatusRef = useRef<AdaptiveStatus>("off");
  const lastContextRef = useRef<AdaptiveContext | null>(null);

  const fetchAdaptive = useCallback(
    async (args: FetchAdaptiveArgs): Promise<FetchAdaptiveResult> => {
      const enabled = isEnabled("tutor_adaptive_context_enabled");
      if (!enabled) {
        lastStatusRef.current = "off";
        return { context: null, status: "off", latency_ms: 0 };
      }

      const started = performance.now();
      try {
        // Timeout guard — se a edge função demorar, seguimos sem contexto.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ADAPTIVE_TIMEOUT_MS);

        const response = await callTutorV3({
          message: args.message,
          topic: args.topic ?? null,
          subtopic: args.subtopic ?? null,
          conversation_id: args.conversationId ?? null,
        }, {
          functionName: "tutor-context-builder",
          stream: false,
          signal: controller.signal
        });

        const data = await response.json();
        clearTimeout(timer);

        const latency = Math.round(performance.now() - started);

        if (!data) {
          lastStatusRef.current = "failed";
          console.warn("[TutorAdaptive] failed: no data", `${latency}ms`);
          return { context: null, status: "failed", latency_ms: latency };
        }

        const ctx = data as AdaptiveContext;
        lastStatusRef.current = "ok";
        lastContextRef.current = ctx;
        console.info(
          "[TutorAdaptive] ok:",
          `weak=${ctx.weak_topics?.length ?? 0}`,
          `fsrs=${ctx.fsrs_due?.length ?? 0}`,
          `mission=${ctx.current_mission ? "yes" : "no"}`,
          `${latency}ms`
        );
        return { context: ctx, status: "ok", latency_ms: latency };
      } catch (e) {
        const latency = Math.round(performance.now() - started);
        lastStatusRef.current = "failed";
        console.warn("[TutorAdaptive] exception:", e, `${latency}ms`);
        return { context: null, status: "failed", latency_ms: latency };
      }
    },
    [isEnabled]
  );

  return {
    fetchAdaptive,
    isAdaptiveEnabled: isEnabled("tutor_adaptive_context_enabled"),
    lastStatusRef,
    lastContextRef,
  };
}
