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

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
