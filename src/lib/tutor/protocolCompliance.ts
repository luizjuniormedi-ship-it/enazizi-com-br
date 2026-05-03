/**
 * Protocol Compliance Validator — ENAZIZI 15-block pedagogical sequence.
 * Detects which canonical phases are present in a Tutor IA assistant message
 * (combining JSON cognitive blocks + textual markers from the master prompt).
 *
 * Used by:
 *  - Roadmap UI (PedagogicalMissionHero) to color completed steps
 *  - Telemetry (telemetry_events) to log incomplete responses
 *  - Auto-retry layer to request missing complements from the model
 */
import { supabase } from "@/integrations/supabase/client";
import {
  PEDAGOGICAL_STAGES,
  type MissionStage,
} from "@/components/tutor/pedagogical/PedagogicalMissionHero";
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";

export interface ComplianceReport {
  score: number; // 0-100
  presentStageIds: string[];
  missingStageIds: string[];
  missingStageLabels: string[];
  isComplete: boolean;
  shouldRetry: boolean;
}

export function evaluateProtocolCompliance(
  assistantContent: string
): ComplianceReport {
  const { blocks } = extractInlineTutorBlocks(assistantContent || "");
  const seenTypes = new Set(blocks.map((b) => b.type));
  const lower = (assistantContent || "").toLowerCase();

  const presentStageIds: string[] = [];
  const missingStageIds: string[] = [];
  const missingStageLabels: string[] = [];

  for (const stage of PEDAGOGICAL_STAGES) {
    const byBlock = stage.blockTypes.some((t) => seenTypes.has(t as any));
    const byText = stage.textMarkers.some((m) => lower.includes(m));
    if (byBlock || byText) {
      presentStageIds.push(stage.id);
    } else {
      missingStageIds.push(stage.id);
      missingStageLabels.push(stage.label);
    }
  }

  const total = PEDAGOGICAL_STAGES.length;
  const score = Math.round((presentStageIds.length / total) * 100);
  const isComplete = missingStageIds.length === 0;
  // Retry threshold: more than 3 phases missing is considered structurally broken.
  const shouldRetry = missingStageIds.length > 3;

  return {
    score,
    presentStageIds,
    missingStageIds,
    missingStageLabels,
    isComplete,
    shouldRetry,
  };
}

export function buildComplementPrompt(report: ComplianceReport): string {
  return [
    "Sua última resposta não cobriu o protocolo obrigatório das 15 fases ENAZIZI.",
    `Faltaram as fases: ${report.missingStageLabels.join(", ")}.`,
    "Continue de onde parou e gere APENAS as fases faltantes, mantendo o mesmo tema, profundidade científica e formato em blocos didáticos.",
  ].join(" ");
}

/** Fire-and-forget telemetry log. Never throws. */
export async function logComplianceTelemetry(params: {
  conversationId?: string | null;
  topic?: string | null;
  report: ComplianceReport;
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    await supabase.from("telemetry_events").insert({
      user_id: auth.user.id,
      event_type: "tutor_protocol_compliance",
      payload: {
        conversation_id: params.conversationId ?? null,
        topic: params.topic ?? null,
        score: params.report.score,
        present: params.report.presentStageIds,
        missing: params.report.missingStageIds,
        is_complete: params.report.isComplete,
        should_retry: params.report.shouldRetry,
      },
    });
  } catch {
    /* silent */
  }
}
