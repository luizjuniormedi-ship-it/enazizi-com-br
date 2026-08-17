import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_COLLECTION_ROOT,
  OFFICIAL_REVALIDA_ROOT,
  isOfficialAnswerKeyUrl,
  normalizeExamYear,
  normalizeOfficialQuestion,
  policyForDriveRoot,
  retryDelayMs,
  sha256Hex,
} from "../../supabase/functions/_shared/drive-corpus-governance";

describe("Drive corpus governance behavior", () => {
  it("classifies only the REVALIDA allowlist as an official exam", () => {
    expect(policyForDriveRoot(OFFICIAL_REVALIDA_ROOT)).toMatchObject({
      sourceKind: "official_public",
      sourcePurpose: "official_exam",
      rightsStatus: "official_public",
    });
    expect(policyForDriveRoot(COMMERCIAL_COLLECTION_ROOT)).toMatchObject({
      sourceKind: "commercial",
      sourcePurpose: "unclassified",
      rightsStatus: "blocked",
    });
    expect(policyForDriveRoot("arbitrary-root")).toMatchObject({
      sourceKind: "unknown",
      rightsStatus: "unverified",
    });
  });

  it("computes a stable SHA-256 checksum", async () => {
    const value = await sha256Hex(new TextEncoder().encode("ENAZIZI"));
    expect(value).toBe("148b2d20c79f54487fb12395468fd3206ec3fbf3edcb1007ecf39ca1a3c9aa15");
  });

  it("backs off exponentially and caps retries at six hours", () => {
    expect(retryDelayMs(1)).toBe(15 * 60 * 1000);
    expect(retryDelayMs(2)).toBe(30 * 60 * 1000);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60 * 1000);
  });

  it("accepts answer keys only from HTTPS government hosts", () => {
    expect(isOfficialAnswerKeyUrl("https://download.inep.gov.br/prova/gabarito.pdf")).toBe(true);
    expect(isOfficialAnswerKeyUrl("http://download.inep.gov.br/gabarito.pdf")).toBe(false);
    expect(isOfficialAnswerKeyUrl("https://gov.br.attacker.example/gabarito.pdf")).toBe(false);
    expect(isOfficialAnswerKeyUrl("https://drive.google.com/gabarito.pdf")).toBe(false);
  });

  it("rejects incomplete or answerless extracted questions", () => {
    const valid = normalizeOfficialQuestion({
      question_number: 7,
      statement: "Paciente com quadro clínico suficientemente descrito para uma questão oficial.",
      options: ["A", "B", "C", "D"],
      correct_index: 2,
    });
    expect(valid).toMatchObject({ question_number: 7, correct_index: 2 });
    expect(normalizeOfficialQuestion({ ...valid, correct_index: -1 })).toBeNull();
    expect(normalizeOfficialQuestion({ ...valid, options: ["A", "B", "C"] })).toBeNull();
  });

  it("derives a valid exam year without accepting arbitrary values", () => {
    expect(normalizeExamYear(2023, "prova.pdf")).toBe(2023);
    expect(normalizeExamYear("unknown", "REVALIDA 2021.pdf")).toBe(2021);
    expect(normalizeExamYear(1999, "sem-ano.pdf")).toBeNull();
  });
});
