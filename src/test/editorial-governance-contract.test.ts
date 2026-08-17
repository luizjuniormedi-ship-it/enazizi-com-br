import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const accessMigration = read("supabase/migrations/20260817003817_admin_editorial_queue_access.sql");
const barrierMigration = read("supabase/migrations/20260817004208_enforce_editorial_gold_governance.sql");
const panel = read("src/components/admin/AdminQuestionReviewPanel.tsx");
const pipeline = read("supabase/functions/question-review-pipeline/index.ts");

describe("editorial question governance", () => {
  it("grants queue visibility only through the canonical admin role", () => {
    expect(accessMigration).toContain("FOR SELECT");
    expect(accessMigration).toContain("public.has_role((SELECT auth.uid()), 'admin'::public.app_role)");
    expect(accessMigration).not.toMatch(/FOR\s+(UPDATE|INSERT|DELETE)/);
    expect(accessMigration).not.toContain("user_metadata");
  });

  it("revokes direct execution of trigger-only security definers", () => {
    expect(barrierMigration.match(/REVOKE ALL ON FUNCTION/g)).toHaveLength(3);
    expect(barrierMigration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("prevents generated questions from self-promoting", () => {
    expect(pipeline).toContain("approved_for_generation: false");
    expect(barrierMigration).toContain("EDITORIAL_EVIDENCE_REQUIRED");
    expect(barrierMigration).toContain("gold_status = 'ouro'");
  });

  it("requires editorial metadata before the question promotion trigger can pass", () => {
    expect(barrierMigration.indexOf("enforce_gold_editorial_evidence_trigger")).toBeGreaterThan(-1);
    expect(barrierMigration.indexOf("enforce_question_generation_editorial_gate_trigger"))
      .toBeGreaterThan(barrierMigration.indexOf("enforce_gold_editorial_evidence_trigger"));
    expect(barrierMigration).toContain("g.reviewed_at IS NOT NULL");
  });

  it("routes the existing admin queue through review instead of direct approval", () => {
    expect(panel).toContain('functions.invoke("question-review-pipeline"');
    expect(panel).toContain('<SelectItem value="quarantined">Quarentena</SelectItem>');
    expect(panel).not.toContain('update({ review_status: "approved" })');
  });
});
