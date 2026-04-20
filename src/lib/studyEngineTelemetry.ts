/**
 * studyEngineTelemetry — Snapshot defensivo das decisões do motor
 * ─────────────────────────────────────────────────────────────────
 * Reaproveita a tabela `assistant_decisions` (já em uso) para gravar
 * uma decisão consolidada do Study Engine V3.
 *
 * NÃO cria tabela nova. NÃO altera RLS. Fire-and-forget — qualquer
 * falha é apenas logada como warning.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RecommendationLike {
  topic?: string;
  type?: string;
  priority?: number;
  reason?: string;
  basePriority?: number;
}

export interface StudyEngineTelemetryInput {
  userId: string;
  examDate?: string | Date | null;
  daysToExam?: number | null;
  coveragePct?: number | null;
  monthlyQuestions30d?: number | null;
  monthlyBacklog?: number | null;
  dailyQuestionTarget?: number | null;
  paceStatus?: "ok" | "behind" | "ahead" | "on_track" | null;
  examMultiplier?: number | null;
  recommendations: RecommendationLike[];
}

const SOURCE_MODULE = "study-engine-v3";
const DECISION_TYPE = "engine_snapshot";

// Selos visuais usados pelos boosts no studyEngine.ts (ver bloco V3)
const COVERAGE_TAG = "🎯";
const GOAL_TAG = "📊";
const PACE_TAG = "📈";
const EXAM_TAG = "⏱️";

function detectBoosts(reason: string | undefined) {
  const r = reason || "";
  return {
    boosted_by_coverage: r.includes(COVERAGE_TAG),
    boosted_by_goal: r.includes(GOAL_TAG) || r.includes(PACE_TAG),
    boosted_by_exam_pressure: r.includes(EXAM_TAG),
  };
}

export async function logStudyEngineDecision(input: StudyEngineTelemetryInput): Promise<void> {
  try {
    const top = (input.recommendations || []).slice(0, 5).map((rec) => ({
      topic: rec.topic ?? null,
      type: rec.type ?? null,
      base_priority: rec.basePriority ?? null,
      final_priority: rec.priority ?? null,
      ...detectBoosts(rec.reason),
    }));

    const totals = top.reduce(
      (acc, r) => {
        if (r.boosted_by_coverage) acc.coverageBoosts++;
        if (r.boosted_by_goal) acc.goalBoosts++;
        if (r.boosted_by_exam_pressure) acc.examPressureBoosts++;
        return acc;
      },
      { coverageBoosts: 0, goalBoosts: 0, examPressureBoosts: 0 }
    );

    await supabase.from("assistant_decisions").insert({
      user_id: input.userId,
      source_module: SOURCE_MODULE,
      decision_type: DECISION_TYPE,
      justification: "Study Engine V3 snapshot",
      confidence_score: null,
      input_snapshot: {
        exam_date: input.examDate ?? null,
        days_to_exam: input.daysToExam ?? null,
        coverage_pct: input.coveragePct ?? null,
        monthly_questions_30d: input.monthlyQuestions30d ?? null,
        monthly_backlog: input.monthlyBacklog ?? null,
        daily_question_target: input.dailyQuestionTarget ?? null,
        pace_status: input.paceStatus ?? null,
        exam_multiplier: input.examMultiplier ?? null,
      },
      decision_output: {
        engine_version: "v3",
        top_recommendations: top,
        boost_totals: totals,
      },
    });
  } catch (e) {
    console.warn("[studyEngineTelemetry] log skipped:", e);
  }
}
