import type { StudyNextRecommendation, MnemonicMode } from "@/hooks/useStudyNext";

/**
 * Central recommendation router.
 * Decides whether a recommendation should run inline (study loop)
 * or navigate to a dedicated module page.
 */

export type RecommendationAction =
  | { mode: "loop" }
  | { mode: "navigate"; path: string };

/**
 * Given a study-next recommendation, returns the action the Dashboard should take.
 *
 * - review / error_review / daily_task / free_study → inline loop
 * - image_quiz → navigate to /dashboard/image-quiz with context
 * - mnemonic  → navigate to /dashboard/mnemonico with context (mode-aware)
 */
export function resolveRecommendationAction(
  rec: StudyNextRecommendation
): RecommendationAction {
  const ctx = rec.contextPayload as Record<string, any> | undefined;

  switch (rec.type) {
    case "image_quiz": {
      const params = new URLSearchParams();
      params.set("origin", "mission");
      if (ctx?.topic) params.set("topic", ctx.topic);
      if (ctx?.subtopic) params.set("subtopic", ctx.subtopic);
      if (rec.targetId) params.set("targetId", rec.targetId);
      if (rec.targetType) params.set("targetType", rec.targetType);
      return { mode: "navigate", path: `/dashboard/image-quiz?${params}` };
    }

    case "mnemonic": {
      const params = new URLSearchParams();
      params.set("origin", "mission");
      if (ctx?.topic) params.set("topic", ctx.topic);
      if (ctx?.subtopic) params.set("subtopic", ctx.subtopic);
      if (rec.targetId) params.set("targetId", rec.targetId);
      if (rec.targetType) params.set("targetType", rec.targetType);

      // Mode-aware routing: review_existing, regenerate, create_new
      const mnemonicMode = ctx?.mnemonicMode as MnemonicMode | undefined;
      if (mnemonicMode) params.set("mode", mnemonicMode);
      if (ctx?.preferredStyle) params.set("style", ctx.preferredStyle);
      if (ctx?.resultId) params.set("resultId", ctx.resultId);
      if (ctx?.utilityScore !== undefined) params.set("utilityScore", String(ctx.utilityScore));

      return { mode: "navigate", path: `/dashboard/mnemonico?${params}` };
    }

    default:
      return { mode: "loop" };
  }
}
