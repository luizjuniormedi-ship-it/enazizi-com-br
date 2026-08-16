import { describe, expect, it } from "vitest";
import { EXAM_PROFILES } from "@/lib/realExamDistribution";
import { getOfficialBoardAvailability } from "../../supabase/functions/_shared/banca-profiles";

describe("official board governance", () => {
  it("blocks every official board until its runtime is homologated", () => {
    const officialProfiles = Object.entries(EXAM_PROFILES).filter(([key]) => key !== "GERAL");
    const enabled = officialProfiles.filter(([, profile]) => profile.canGenerate);

    expect(enabled.map(([key]) => key)).toEqual([]);
    expect(EXAM_PROFILES.ENARE.availability).toBe("suspended");
    expect(getOfficialBoardAvailability("ENARE")).toMatchObject({
      status: "suspended",
      canGenerateOfficialExam: false,
    });
  });

  it.each(["USP-SP", "CEBRASPE", "FGV", "FCC", "ENAMED"])(
    "blocks %s consistently in frontend and generator",
    (board) => {
      expect(EXAM_PROFILES[board].canGenerate).toBe(false);
      expect(getOfficialBoardAvailability(board)?.canGenerateOfficialExam).toBe(false);
    },
  );

  it("treats GERAL as a non-official simulation", () => {
    expect(EXAM_PROFILES.GERAL.name).toBe("Simulado Geral");
    expect(EXAM_PROFILES.GERAL.availability).toBe("general");
    expect(getOfficialBoardAvailability("GERAL")).toBeNull();
  });

  it("fails closed for unknown official boards", () => {
    expect(getOfficialBoardAvailability("BANCA_DESCONHECIDA")).toMatchObject({
      status: "draft",
      canGenerateOfficialExam: false,
    });
  });
});
