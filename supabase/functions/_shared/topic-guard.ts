export interface TopicGuardResult {
  allowed: boolean;
  reason: string;
  matched_fields: string[];
  requested_topic: string;
  question_topic: string;
  question_subtopic: string;
  question_competency: string;
  score: number;
}

/**
 * FINAL TOPIC GUARD
 * Mandatory validation for every question in a thematic simulation.
 */
export function validateFinalQuestionTopic(
  question: any,
  requestedTopic: string,
  requestedCompetency?: string,
  minScore = 90
): TopicGuardResult {
  const qTopic = (question.topic || "").toLowerCase();
  const qSubtopic = (question.subtopic || "").toLowerCase();
  const qTheme = (question.curriculum_theme || "").toLowerCase();
  const qSubtheme = (question.curriculum_subtheme || "").toLowerCase();
  const qCompetency = (question.curriculum_competency || "").toLowerCase();
  
  const reqTopicLower = requestedTopic.toLowerCase();
  const reqCompLower = (requestedCompetency || "").toLowerCase();

  const matchedFields: string[] = [];
  let score = 0;

  // 1. Exact Competency Match (Priority 1)
  if (reqCompLower && [qCompetency, qSubtopic, qSubtheme].some(val => val === reqCompLower)) {
    matchedFields.push("curriculum_competency");
    score = 100;
  }

  // 2. Exact Topic/Theme Match (Priority 2)
  if (score < 100) {
    if ([qTopic, qTheme].some(val => val === reqTopicLower)) {
      matchedFields.push("topic");
      score = 100;
    } else if ([qSubtopic, qSubtheme].some(val => val === reqTopicLower)) {
      matchedFields.push("subtopic");
      score = 95;
    }
  }

  // 3. Partial/Alias Match (Internal check via score if provided from TopicEngine, but Guard is autonomous)
  // If score wasn't set by exact matches, check inclusion
  if (score === 0) {
    if ([qTopic, qTheme, qSubtopic, qSubtheme, qCompetency].some(val => val.includes(reqTopicLower))) {
      matchedFields.push("partial_inclusion");
      score = 80; // Lower than default minScore 90 for strict adherence
    }
  }

  const allowed = score >= minScore;

  return {
    allowed,
    reason: allowed ? "MATCH_CONFIRMED" : (score === 0 ? "TOPIC_MISMATCH" : "INSUFFICIENT_SPECIFICITY"),
    matched_fields: matchedFields,
    requested_topic: requestedTopic,
    question_topic: question.topic,
    question_subtopic: question.subtopic,
    question_competency: question.curriculum_competency,
    score
  };
}
