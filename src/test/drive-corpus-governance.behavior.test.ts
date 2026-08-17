import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_COLLECTION_ROOT,
  OFFICIAL_REVALIDA_ROOT,
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
});
