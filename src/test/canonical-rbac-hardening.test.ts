import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const onboarding = fs.readFileSync(
  path.join(root, "src/components/auth/OnboardingGate.tsx"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260827000100_harden_canonical_rbac.sql"),
  "utf8",
);

describe("canonical RBAC hardening", () => {
  it("does not let onboarding assign professor roles from the browser", () => {
    expect(onboarding).not.toContain('.from("user_roles").upsert');
    expect(onboarding).not.toContain('role: "professor" as any');
  });

  it("removes legacy profile-role authorization policies fail closed", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Admins have full access to profiles"');
    expect(migration).toContain("COALESCE(qual, '') ~* 'profiles[.]role'");
    expect(migration).toContain("COALESCE(with_check, '') ~* 'profiles[.]role'");
  });

  it("protects privileged profile fields from non-admin client updates", () => {
    for (const field of [
      "NEW.id",
      "NEW.user_id",
      "NEW.email",
      "NEW.role",
      "NEW.status",
      "NEW.approved_by",
      "NEW.approved_at",
      "NEW.is_blocked",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("NOT public.has_role('admin')");
  });

  it("keeps role mutation behind service role for admin-actions", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Admins can manage roles"');
    expect(migration).toContain('CREATE POLICY "Service role can manage roles"');
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated");
  });
});
