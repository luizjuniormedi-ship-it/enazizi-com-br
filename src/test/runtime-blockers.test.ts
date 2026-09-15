import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isSessionExpired,
  MAX_RESUMABLE_SESSION_AGE_MS,
} from "@/hooks/useSessionPersistence";

describe("runtime blocker regressions", () => {
  it("expires resumable sessions after 72 hours", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");

    expect(isSessionExpired(now - MAX_RESUMABLE_SESSION_AGE_MS, now)).toBe(false);
    expect(isSessionExpired(now - MAX_RESUMABLE_SESSION_AGE_MS - 1, now)).toBe(true);
    expect(isSessionExpired("invalid-date", now)).toBe(true);
  });

  it("connects the Incidentes quick action to its existing panel", () => {
    const adminSource = readFileSync(resolve(process.cwd(), "src/pages/Admin.tsx"), "utf8");

    expect(adminSource).toContain('handleTabChange("incidents")');
    expect(adminSource).toContain('activeSection === "incidents"');
    expect(adminSource).toContain("<CMEIncidentsPage />");
  });
});
