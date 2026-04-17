/**
 * parseStudySignal — extracts a structured pedagogical signal from a
 * study-session assistant message.
 *
 * The edge function `study-session` is instructed (in correction-style phases)
 * to append a hidden block at the END of the message:
 *
 *   <!--SIGNAL-->
 *   {"wasCorrect":true,"correctLetter":"B","detectedAnswer":"A",
 *    "errorCategory":"conceitual","subtopic":"...","topic":"...",
 *    "confidence":0.9,"feedbackShort":"...","feedbackDetailed":"...",
 *    "shouldReinforce":true,"recommendedNextStep":"review"}
 *   <!--/SIGNAL-->
 *
 * This module is the SINGLE place where we read that block. The frontend must
 * never depend on emoji/regex to know if the student was right.
 */
export type StudySignalNextStep =
  | "review"
  | "tutor"
  | "mnemonic"
  | "image_quiz"
  | "continue";

export type StudySignalErrorCategory =
  | "conceitual"
  | "memorizacao"
  | "interpretacao"
  | "atencao"
  | "desconhecido";

export interface StudySignal {
  wasCorrect: boolean;
  correctLetter?: string;
  detectedAnswer?: string;
  errorCategory: StudySignalErrorCategory;
  subtopic?: string;
  topic?: string;
  confidence: number; // 0..1
  feedbackShort?: string;
  feedbackDetailed?: string;
  shouldReinforce: boolean;
  recommendedNextStep: StudySignalNextStep;
}

const SIGNAL_REGEX = /<!--\s*SIGNAL\s*-->([\s\S]*?)<!--\s*\/SIGNAL\s*-->/i;

const ALLOWED_CATEGORIES: StudySignalErrorCategory[] = [
  "conceitual",
  "memorizacao",
  "interpretacao",
  "atencao",
  "desconhecido",
];

const ALLOWED_NEXT: StudySignalNextStep[] = [
  "review",
  "tutor",
  "mnemonic",
  "image_quiz",
  "continue",
];

function clamp01(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, v));
}

function asEnum<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === "string" && (allowed as string[]).includes(v)
    ? (v as T)
    : fallback;
}

/**
 * Extract and validate the SIGNAL block. Returns null if absent/invalid.
 * Never throws.
 */
export function parseStudySignal(rawAssistantMessage: string): StudySignal | null {
  if (!rawAssistantMessage) return null;
  const m = rawAssistantMessage.match(SIGNAL_REGEX);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return null;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(inner);
  } catch {
    console.warn("[parseStudySignal] invalid JSON in SIGNAL block");
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  if (typeof obj.wasCorrect !== "boolean") {
    console.warn("[parseStudySignal] missing wasCorrect");
    return null;
  }

  const signal: StudySignal = {
    wasCorrect: obj.wasCorrect,
    correctLetter:
      typeof obj.correctLetter === "string" ? obj.correctLetter.toUpperCase().slice(0, 1) : undefined,
    detectedAnswer:
      typeof obj.detectedAnswer === "string" ? obj.detectedAnswer.toUpperCase().slice(0, 1) : undefined,
    errorCategory: asEnum<StudySignalErrorCategory>(obj.errorCategory, ALLOWED_CATEGORIES, "desconhecido"),
    subtopic: typeof obj.subtopic === "string" ? obj.subtopic.slice(0, 200) : undefined,
    topic: typeof obj.topic === "string" ? obj.topic.slice(0, 200) : undefined,
    confidence: clamp01(obj.confidence),
    feedbackShort: typeof obj.feedbackShort === "string" ? obj.feedbackShort.slice(0, 500) : undefined,
    feedbackDetailed:
      typeof obj.feedbackDetailed === "string" ? obj.feedbackDetailed.slice(0, 2000) : undefined,
    shouldReinforce: typeof obj.shouldReinforce === "boolean" ? obj.shouldReinforce : !obj.wasCorrect,
    recommendedNextStep: asEnum<StudySignalNextStep>(
      obj.recommendedNextStep,
      ALLOWED_NEXT,
      obj.wasCorrect ? "continue" : "review"
    ),
  };
  return signal;
}

/** Strip the SIGNAL block from a message before rendering it to the user. */
export function stripStudySignal(rawAssistantMessage: string): string {
  if (!rawAssistantMessage) return rawAssistantMessage;
  return rawAssistantMessage.replace(SIGNAL_REGEX, "").trimEnd();
}
