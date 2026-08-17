import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const ingest = read("supabase/functions/drive-corpus-ingest/index.ts");
const extractor = read("supabase/functions/_shared/google-drive.ts");
const pipeline = read("supabase/functions/question-review-pipeline/index.ts");
const migration = read("supabase/migrations/20260817015629_stage_official_drive_questions.sql");

describe("official Drive question staging contract", () => {
  it("requires an official answer-key PDF during paged extraction", () => {
    expect(ingest).toContain("downloadOfficialAnswerKey(row.answer_key_url)");
    expect(ingest).toContain("ANSWER_KEY_NOT_PDF");
    expect(extractor).toContain("answerKeyBytes?: Uint8Array");
    expect(extractor).toContain("onChunk?: (index: number, total: number)");
  });

  it("writes only quarantined, non-generatable review candidates", () => {
    expect(ingest).toContain('quality_tier: "needs_upgrade"');
    expect(ingest).toContain('review_status: "needs_review"');
    expect(ingest).toContain('lifecycle_state: "quarantined"');
    expect(ingest).toContain("approved_for_generation: false");
    expect(migration).toContain("OFFICIAL_DRIVE_QUESTION_MUST_ENTER_QUARANTINE");
  });

  it("persists source and answer-key provenance with idempotency", () => {
    expect(ingest).toContain("answer_key_checksum_sha256: answerKeyChecksum");
    expect(ingest).toContain("source_document_checksum: checksum");
    expect(ingest).toContain("source_question_hash: questionHash");
    expect(migration).toContain("questions_bank_drive_source_question_uniq");
    expect(migration).toContain("OFFICIAL_DRIVE_PROVENANCE_REQUIRED");
  });

  it("does not automatically run AI review on official transcripts", () => {
    expect(ingest).not.toContain("/functions/v1/question-review-pipeline");
    expect(ingest).toContain('review_pipeline_role: "enrichment_only"');
    expect(migration).toContain("OFFICIAL_DRIVE_CONTENT_IMMUTABLE");
    expect(pipeline).toContain("preserveOfficialQuestionContent");
    expect(pipeline).toContain('q.lifecycle_state === "quarantined"');
    expect(pipeline).toContain('? "needs_review"');
    expect(pipeline).toContain("approved_for_generation: false");
  });

  it("requires human editorial evidence before any later promotion", () => {
    expect(migration).toContain("OFFICIAL_DRIVE_EDITORIAL_APPROVAL_REQUIRED");
    expect(migration).toContain("OFFICIAL_DRIVE_SOURCE_TYPE_IMMUTABLE");
    expect(migration).toContain("g.quality_score_method IN ('manual', 'hybrid')");
    expect(migration).toContain("g.reviewed_by IS NOT NULL");
  });
});
