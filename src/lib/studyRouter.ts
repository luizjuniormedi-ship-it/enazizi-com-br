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
  rec: any, // flexible for direct task objects
  source: StudySource = "mission"
): string {
  const ctx = buildStudyContext(rec, source);
  const params = encodeStudyContext(ctx);

  if (rec.id) params.set("sc_task_id", rec.id);
  params.set("sc_origin", source);
  params.set("origin", "guided");
  if (rec.topic) params.set("topic", rec.topic);
  if (rec.specialty) params.set("specialty", rec.specialty);

  // New task types mapping from Coordenador Adaptativo
  const taskType = rec.task_type || rec.type;
  
  switch (taskType) {
    case "tutor_lesson":
    case "theory":
      params.set("tutor_mode", "mission");
      params.set("phase", "lesson");
      return `/dashboard/sessao-estudo?${params}`;

    case "question_practice":
    case "practice":
      return `/dashboard/banco-questoes?${params}`;

    case "fsrs_review":
    case "review":
    case "flashcards":
      return `/dashboard/flashcards?${params}`;

    case "error_recovery":
    case "error_fix":
      return `/dashboard/banco-erros?${params}`;

    case "mini_simulado":
    case "simulation":
    case "simulado":
      return `/dashboard/simulados?${params}`;

    case "summary":
      return `/dashboard/plano-dia?sc_view=summary`;

    default:
      // Backward compatibility for TargetModule string
      if (rec.targetModule === "tutor-v2" || rec.targetModule === "tutor") {
        return `/dashboard/sessao-estudo?${params}`;
      }
      return rec.targetPath || `/dashboard/${rec.targetModule || 'cockpit'}?${params}`;
  }
}

