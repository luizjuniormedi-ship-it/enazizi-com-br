export const OFFICIAL_REVALIDA_ROOT = "19FoLm6xHe3wwoyo1Y5OfJD_DKB0hdvRo";
export const COMMERCIAL_COLLECTION_ROOT = "1JeOYpLlB-GqJqody5Rebv9-q704bT4OP";
export const INEP_REVALIDA_SOURCE =
  "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida/provas-e-gabaritos";

export type DriveSourcePolicy = {
  sourceKind: "official_public" | "commercial" | "unknown";
  sourcePurpose: "official_exam" | "unclassified";
  rightsStatus: "official_public" | "blocked" | "unverified";
  rightsEvidenceUrl: string | null;
  defaultReason: string;
};

export function policyForDriveRoot(folderId: string): DriveSourcePolicy {
  if (folderId === OFFICIAL_REVALIDA_ROOT) {
    return {
      sourceKind: "official_public",
      sourcePurpose: "official_exam",
      rightsStatus: "official_public",
      rightsEvidenceUrl: INEP_REVALIDA_SOURCE,
      defaultReason: "answer_key_and_ingestion_review_required",
    };
  }
  if (folderId === COMMERCIAL_COLLECTION_ROOT) {
    return {
      sourceKind: "commercial",
      sourcePurpose: "unclassified",
      rightsStatus: "blocked",
      rightsEvidenceUrl: null,
      defaultReason: "commercial_rights_evidence_required",
    };
  }
  return {
    sourceKind: "unknown",
    sourcePurpose: "unclassified",
    rightsStatus: "unverified",
    rightsEvidenceUrl: null,
    defaultReason: "source_provenance_and_rights_review_required",
  };
}

export function retryDelayMs(attempt: number): number {
  return Math.min(6 * 60 * 60 * 1000, 15 * 60 * 1000 * 2 ** Math.max(attempt - 1, 0));
}

export function isOfficialAnswerKeyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "gov.br" || url.hostname.endsWith(".gov.br"));
  } catch {
    return false;
  }
}

export function normalizeExamYear(value: unknown, fileName: string): number | null {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 2011 && parsed <= 2100) return parsed;
  const match = fileName.match(/20(?:1[1-9]|2\d)/);
  return match ? Number(match[0]) : null;
}

export function normalizeOfficialQuestion(raw: any) {
  const statement = typeof raw?.statement === "string" ? raw.statement.trim() : "";
  const options = Array.isArray(raw?.options)
    ? raw.options.map((option: unknown) => String(option).trim()).filter(Boolean).slice(0, 5)
    : [];
  const correctIndex = Number(raw?.correct_index);
  const questionNumber = Number(raw?.question_number);
  if (statement.length < 30 || ![4, 5].includes(options.length)) return null;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
  if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > 500) return null;
  return { ...raw, statement, options, correct_index: correctIndex, question_number: questionNumber };
}

export function preserveOfficialQuestionContent(original: any, proposed: any) {
  if (original?.source_type !== "official_exam_drive") return proposed;
  return {
    ...proposed,
    statement: original.statement,
    options: original.options,
    correct_index: original.correct_index,
    board: original.board,
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
