import type { StudyRecommendation } from "@/lib/studyEngine";
import {
  type StudyContext,
  type StudySource,
  encodeStudyContext,
  objectiveFromTaskType,
} from "@/lib/studyContext";

/**
 * Build a StudyContext from a StudyRecommendation + source info.
 */
export function buildStudyContext(
  rec: StudyRecommendation,
  source: StudySource = "mission"
): StudyContext {
  return {
    source,
    specialty: rec.specialty,
    topic: rec.topic,
    subtopic: rec.subtopic,
    taskType: rec.type,
    objective: rec.objective || objectiveFromTaskType(rec.type),
    difficulty: rec.difficulty,
    priority: rec.priority,
    reason: rec.reason,
  };
}

/**
 * Builds the navigation path for a study recommendation,
 * including query params so the target module can auto-start.
 */
export function buildStudyPath(
  rec: StudyRecommendation,
  source: StudySource = "mission"
): string {
  const ctx = buildStudyContext(rec, source);
  const params = encodeStudyContext(ctx);

  // Mission context — allows module to report back completion
  if (rec.id) params.set("sc_task_id", rec.id);
  params.set("sc_origin", source);

  // Legacy compat params
  params.set("origin", "guided");
  if (rec.topic) params.set("topic", rec.topic);
  if (rec.specialty) params.set("specialty", rec.specialty);

  switch (rec.targetModule) {
    case "tutor": {
      // Inject tutor-specific context for mission integration
      params.set("tutor_mode", source === "mission" ? "mission" : "free");

      // Map task type → tutor phase
      const phaseMap: Record<string, string> = {
        error_review: "correction",
        review: "fixation",
        new: "lesson",
        practice: "fixation",
        clinical: "fixation",
      };
      const phase = phaseMap[rec.type] || "lesson";
      params.set("phase", phase);
      params.set("tutor_origin", rec.type);

      return `/dashboard/mentor?${params}`;
    }

    case "questoes":
      return `/dashboard/banco-questoes?${params}`;

    case "flashcards":
      return `/dashboard/flashcards?${params}`;

    case "simulado":
      return `/dashboard/simulados?${params}`;

    case "plantao":
      params.set("difficulty", "intermediário");
      return `/dashboard/simulacao-clinica?${params}`;

    case "anamnese":
      params.set("difficulty", "intermediário");
      return `/dashboard/anamnese?${params}`;

    case "banco-erros":
      return `/dashboard/banco-erros?${params}`;

    case "cronograma":
      return `/dashboard/planner?${params}`;

    default:
      return rec.targetPath;
  }
}
