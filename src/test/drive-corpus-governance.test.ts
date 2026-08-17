import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const scan = read("supabase/functions/drive-corpus-scan/index.ts");
const ingest = read("supabase/functions/drive-corpus-ingest/index.ts");
const governance = read("supabase/functions/_shared/drive-corpus-governance.ts");
const migration = read("supabase/migrations/20260817004606_harden_drive_corpus_ingestion.sql");
const config = read("supabase/config.toml");

describe("Drive corpus fail-closed governance", () => {
  it("requires JWT plus an admin role in both existing routes", () => {
    expect(scan).toContain("requireAdmin(req, supabase)");
    expect(ingest).toContain("requireAdmin(req, supabase)");
    expect(config).toMatch(/\[functions\.drive-corpus-scan\][\s\S]*?verify_jwt = true/);
    expect(config).toMatch(/\[functions\.drive-corpus-ingest\][\s\S]*?verify_jwt = true/);
  });

  it("awaits the recursive scan and blocks every newly discovered source", () => {
    expect(scan).toContain("await crawl(");
    expect(scan).not.toMatch(/\(async \(\) =>[\s\S]*crawl/);
    expect(scan).toContain('status: "blocked"');
    expect(governance).toContain("commercial_rights_evidence_required");
    expect(governance).toContain("answer_key_and_ingestion_review_required");
  });

  it("claims jobs atomically with bounded concurrency and backoff", () => {
    expect(ingest).toContain('rpc("claim_drive_corpus_jobs"');
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("LIMIT LEAST(GREATEST(p_limit, 1), 2)");
    expect(ingest).toContain('status: exhausted ? "failed" : "retry_wait"');
    expect(ingest).toContain("next_retry_at:");
  });

  it("stages Drive RAG unpublished and excludes it from semantic search", () => {
    expect(ingest).toContain("is_published: false");
    expect(ingest).toContain('status: "staged"');
    expect(migration).toContain("rd.is_published IS TRUE");
    expect(migration).toContain("enforce_drive_rag_publication_gate");
    expect(migration).toContain("editorial_review_status <> 'approved'");
  });

  it("uses SHA-256 source idempotency and service-role-only claims", () => {
    expect(governance).toContain('crypto.subtle.digest("SHA-256"');
    expect(migration).toContain("drive_corpus_queue_source_checksum_version_uniq");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.claim_drive_corpus_jobs");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });
});
