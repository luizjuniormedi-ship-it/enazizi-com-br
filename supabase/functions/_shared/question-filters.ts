/**
 * Shared filters for question quality enforcement across all edge functions.
 */

/** Rejects questions that reference images/figures we cannot display */
export const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia abaixo|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir|vide imagem|conforme a imagem|conforme a figura|de acordo com a imagem|de acordo com a figura|analise a imagem|segundo a imagem|segundo a figura|com base na imagem|com base na figura|a partir da imagem|a partir da figura)\b/i;

/** Rejects English-language questions */
export const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female|diagnosis is|management of|regarding the|concerning the|history of presenting|laboratory findings|clinical presentation|what is the|correct answer|following statements|chest x-ray shows|blood pressure is|heart rate is|all of the following|except which|best describes|chief complaint|past medical history|social history|family history|review of systems)\b/i;

/** Validates a question meets minimum quality standards */
export function isValidQuestion(q: { statement?: string; options?: any[]; correct_index?: number }): boolean {
  if (!q.statement || !Array.isArray(q.options) || typeof q.correct_index !== "number") return false;
  // Enforce Gold Standard: 450+ chars
  if (q.statement.length < 450) return false;
  // Enforce Standard: Exactly 4 options (A-D)
  if (q.options.length !== 4) return false;
  if (IMAGE_REF_PATTERN.test(q.statement)) return false;
  if (ENGLISH_PATTERN.test(q.statement)) return false;
  return true;
}

/** Checks if statement has minimum clinical context (age/time pattern + length) */
export function hasMinimumContext(statement: string): boolean {
  if (!statement || statement.length < 400) return false;
  return /\d+\s*(anos?|meses|dias|horas|semanas)/i.test(statement);
}

/** Context-aware validation: checks if question matches expected specialty/topic */
export function validateQuestionContext(
  question: { statement?: string; topic?: string; options?: any[]; correct_index?: number; explanation?: string },
  expectedContext: { specialty?: string; topic?: string; subtopic?: string }
): { valid: boolean; reason?: string } {
  const stmt = question.statement || "";
  const qTopic = question.topic || "";

  // Reject English
  if (ENGLISH_PATTERN.test(stmt)) {
    return { valid: false, reason: "english_content" };
  }

  // Reject image references
  if (IMAGE_REF_PATTERN.test(stmt)) {
    return { valid: false, reason: "image_reference" };
  }

  // Structure validation
  if (!stmt || stmt.length < 50) return { valid: false, reason: "statement_too_short" };
  if (!Array.isArray(question.options) || question.options.length !== 4) return { valid: false, reason: "invalid_options_count" };
  if (typeof question.correct_index !== "number") return { valid: false, reason: "no_correct_index" };

  // Specialty match (loose)
  if (expectedContext.specialty) {
    const specLower = expectedContext.specialty.toLowerCase();
    const isBroad = ["clínica médica", "clinica medica"].some(s => specLower.includes(s));
    if (!isBroad) {
      const specWords = specLower.split(/\s+/).filter(w => w.length > 3);
      const textLower = `${qTopic} ${stmt}`.toLowerCase();
      const matches = specWords.some(w => textLower.includes(w));
      if (!matches) return { valid: false, reason: "specialty_mismatch" };
    }
  }

  return { valid: true };
}

/** Log structured rejection for debugging */
export function logGenerationRejection(reason: string, expected: { specialty?: string; topic?: string }, snippet: string): void {
  console.warn(`[QuestionFilter] REJECTED | reason=${reason} | expected=${expected.specialty || "?"}/${expected.topic || "?"} | snippet="${snippet.slice(0, 100)}"`);
}

export interface QuestionGovernanceAudit {
  allowed: boolean;
  blockers: string[];
  nearDuplicateIds: string[];
}

const normalizeForComparison = (value: unknown) => String(value ?? "")
  .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const tokenBigrams = (value: unknown) => {
  const tokens = normalizeForComparison(value).split(" ").filter((token) => token.length > 2);
  return new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`));
};

const comparisonTokens = (value: unknown) => new Set(
  normalizeForComparison(value).split(" ").filter((token) => token.length > 2),
);

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / (a.size + b.size - intersection);
};

export function nearDuplicateScore(left: unknown, right: unknown): number {
  const a = tokenBigrams(left);
  const b = tokenBigrams(right);
  return Math.max(jaccard(a, b), jaccard(comparisonTokens(left), comparisonTokens(right)));
}

export function auditQuestionGovernance(
  question: { statement: string; options: any[]; correct_index: number; explanation: string },
  corpus: Array<{ id: string; statement?: string }>,
): QuestionGovernanceAudit {
  const blockers: string[] = [];
  const nearDuplicateIds = corpus.filter((candidate) => nearDuplicateScore(question.statement, candidate.statement) >= 0.82).map((candidate) => candidate.id);
  if (nearDuplicateIds.length > 0) blockers.push("near_duplicate_cluster");
  const correctIndex = Number(question.correct_index);
  const correctOption = Array.isArray(question.options) ? question.options[correctIndex] : null;
  const explanation = normalizeForComparison(question.explanation);
  const optionEvidence = normalizeForComparison(correctOption).split(" ").filter((token) => token.length > 4);
  const supportsCorrectOption = optionEvidence.length > 0 && optionEvidence.some((token) => explanation.includes(token));
  const claimedLetters = [...String(question.explanation ?? "").matchAll(/(?:alternativa|op[cç][aã]o)\s*([a-e])\s+(?:e|é|esta|está)\s+(?:a\s+)?correta/gi)].map((match) => match[1].toUpperCase());
  const correctLetter = Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < 5 ? String.fromCharCode(65 + correctIndex) : null;
  if (!correctLetter || !supportsCorrectOption || claimedLetters.some((letter) => letter !== correctLetter)) blockers.push("answer_explanation_contradiction");
  return { allowed: blockers.length === 0, blockers, nearDuplicateIds };
}
